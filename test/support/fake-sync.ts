import { ApiError } from '../../src/domain/model/api-error';
import type { ConnectionState, ConnectionStatus } from '../../src/domain/model/connection';
import type { NewOperation, QueuedOperation, SyncResult } from '../../src/domain/model/outbox';
import type { ConnectionMonitor } from '../../src/domain/ports/in/connection-monitor';
import type { Clock } from '../../src/domain/ports/out/clock';
import type { ExclusiveRunner } from '../../src/domain/ports/out/exclusive-runner';
import type { Random } from '../../src/domain/ports/out/random';
import type { Scheduler } from '../../src/domain/ports/out/scheduler';
import type { SyncApi, SyncResponse } from '../../src/domain/ports/out/sync-api';
import { SyncEngineUseCase } from '../../src/application/usecases/sync-engine.usecase';
import { createTestLocal, type TestLocal } from './local';
import { testMe } from './auth';

// Dobles en memoria de lo que rodea al motor de sincronizacion: el servidor, la conexion, el reloj, el tiempo y las otras
// pestañas. El motor y el espacio de trabajo local son los REALES; todo lo demas se controla a mano.

/** Un reloj que solo se mueve cuando la prueba lo mueve. */
export class MutableClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(at: Date): void {
    this.current = at;
  }
}

/** El tiempo de las esperas: nada espera de verdad, la prueba lo adelanta. */
export class ManualScheduler implements Scheduler {
  /** Cada espera que se pidio, en milisegundos y en el orden en que se pidio. */
  readonly delays: number[] = [];
  private elapsed = 0;
  private readonly tasks = new Set<{ at: number; callback: () => void }>();

  schedule(callback: () => void, delayMs: number): () => void {
    this.delays.push(delayMs);
    const task = { at: this.elapsed + delayMs, callback };
    this.tasks.add(task);
    return () => {
      this.tasks.delete(task);
    };
  }

  /** Cuantas esperas siguen sin cumplirse. */
  get waiting(): number {
    return this.tasks.size;
  }

  /** Deja pasar el tiempo y cumple lo que venza, en orden. */
  advance(ms: number): void {
    this.elapsed += ms;
    const due = [...this.tasks]
      .filter((task) => task.at <= this.elapsed)
      .sort((a, b) => a.at - b.at);
    for (const task of due) {
      this.tasks.delete(task);
      task.callback();
    }
  }
}

/** La conexion que la prueba cambia a mano. */
export class FakeConnection implements ConnectionMonitor {
  retries = 0;
  private state: ConnectionState;
  private readonly listeners = new Set<(state: ConnectionState) => void>();

  constructor(status: ConnectionStatus = 'online') {
    this.state = { status, confirmedAt: null };
  }

  current(): ConnectionState {
    return this.state;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {}

  stop(): void {}

  retry(): Promise<void> {
    this.retries += 1;
    return Promise.resolve();
  }

  /** El servidor responde (o deja de hacerlo). */
  go(status: ConnectionStatus): void {
    this.state = { status, confirmedAt: this.state.confirmedAt };
    for (const listener of [...this.listeners]) listener(this.state);
  }

  get subscribers(): number {
    return this.listeners.size;
  }
}

/** Las otras pestañas: si una esta enviando, esta no. */
export class FakeRunner implements ExclusiveRunner {
  busy = false;
  runs = 0;

  async runIfFree<T>(
    _name: string,
    work: () => Promise<T>,
  ): Promise<{ ran: true; value: T } | { ran: false }> {
    if (this.busy) return { ran: false };
    this.runs += 1;
    return { ran: true, value: await work() };
  }
}

export const NO_LUCK: Random = { next: () => 1 };

/** Lo que el servidor contesta de una operacion que acepta. */
export function applied(operation: QueuedOperation, replayed = false): SyncResult {
  return {
    operationId: operation.operationId,
    status: replayed ? 200 : 201,
    replayed,
    body: { id: operation.operationId },
    problem: null,
  };
}

/** Lo que el servidor contesta de una operacion que rechaza. */
export function refused(operation: QueuedOperation, status: number, code: string): SyncResult {
  return {
    operationId: operation.operationId,
    status,
    replayed: false,
    body: null,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 'Titulo',
      status,
      detail: 'Detalle',
      instance: '/v1/sync',
      code,
      traceId: 'traza',
    },
  };
}

export function failure(
  kind: 'network' | 'session' | 'transient' | 'permanent',
  options: { status?: number | null; retryAfterMs?: number | null; code?: string } = {},
): ApiError {
  const defaults = { network: null, session: 401, transient: 503, permanent: 400 } as const;
  const status = options.status === undefined ? defaults[kind] : options.status;
  return new ApiError({
    class: kind,
    status,
    problem:
      options.code === undefined
        ? null
        : {
            type: `urn:vsd-stock:problem:${options.code}`,
            title: 'Titulo',
            status: status ?? 400,
            detail: 'Detalle',
            instance: '/v1/sync',
            code: options.code,
            traceId: 'traza',
          },
    retryAfterMs: options.retryAfterMs ?? null,
  });
}

type Answer = SyncResponse | ApiError | Error;
type Step = (operations: readonly QueuedOperation[]) => Answer | Promise<Answer>;

/** El servidor de mentira del lote. Por omision acepta todo; la prueba programa lo que contesta, un paso por lote. */
export class FakeSyncApi implements SyncApi {
  /** Cada lote que llego, en el orden en que llego. */
  readonly batches: QueuedOperation[][] = [];
  private readonly plan: Step[] = [];
  /** Cuanto tarda cada viaje en el reloj del dispositivo. */
  latencyMs = 0;
  /** Cuanto adelanta el servidor al reloj del dispositivo. */
  serverAheadMs = 0;

  constructor(private readonly clock: MutableClock) {}

  /** Programa lo que contesta el siguiente lote. */
  next(step: Step): this {
    this.plan.push(step);
    return this;
  }

  /** Programa que el siguiente lote falle entero. */
  failNext(error: ApiError | Error): this {
    return this.next(() => error);
  }

  async send(operations: readonly QueuedOperation[]): Promise<SyncResponse> {
    this.batches.push([...operations]);
    const step = this.plan.shift();
    const arrived = this.clock.now();
    this.clock.advance(this.latencyMs);
    // Un paso puede devolver una promesa: asi la prueba deja el lote «en el aire» el tiempo que quiera.
    const answer = (await step?.(operations)) ?? this.accept(operations, arrived);
    if (answer instanceof Error) throw answer;
    return answer;
  }

  accept(operations: readonly QueuedOperation[], arrived = this.clock.now()): SyncResponse {
    return {
      serverTime: new Date(arrived.getTime() + this.latencyMs / 2 + this.serverAheadMs),
      results: operations.map((operation) => applied(operation)),
    };
  }

  /** Las operaciones de todos los lotes, en el orden en que llegaron. */
  get sent(): string[] {
    return this.batches.flat().map((operation) => operation.operationId);
  }
}

/** Una venta para la cola, con un identificador y una hora que dependen de `n`. */
export function saleOperation(n: number): NewOperation {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return {
    operationId: id,
    kind: 'sale',
    body: { operationId: id, folio: `AA-${String(n).padStart(6, '0')}`, total: 1_000 },
    createdAt: new Date(Date.UTC(2026, 9, 19, 12, 0, 0, n)),
  };
}

export interface TestSync {
  readonly engine: SyncEngineUseCase;
  readonly api: FakeSyncApi;
  readonly connection: FakeConnection;
  readonly scheduler: ManualScheduler;
  readonly runner: FakeRunner;
  readonly clock: MutableClock;
  readonly local: TestLocal;
}

/**
 * El motor real con su espacio de trabajo local real (bases en memoria), con una persona trabajando. Todo lo demas es de mentira.
 */
export async function createTestSync(
  options: { status?: ConnectionStatus; random?: Random; working?: boolean } = {},
): Promise<TestSync> {
  const clock = new MutableClock(new Date('2026-10-19T12:00:00.000Z'));
  const local = createTestLocal(clock.now());
  if (options.working !== false) await local.workspace.begin(testMe('ana', 'cashier'));
  const api = new FakeSyncApi(clock);
  const connection = new FakeConnection(options.status ?? 'online');
  const scheduler = new ManualScheduler();
  const runner = new FakeRunner();
  const engine = new SyncEngineUseCase({
    workspace: local.workspace,
    api,
    connection,
    runner,
    scheduler,
    clock,
    random: options.random ?? NO_LUCK,
  });
  return { engine, api, connection, scheduler, runner, clock, local };
}
