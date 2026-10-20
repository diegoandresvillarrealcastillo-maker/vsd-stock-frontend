import { ApiError } from '../../domain/model/api-error';
import { measureClockOffsetMs } from '../../domain/model/clock-offset';
import { NoWorkspaceError } from '../../domain/model/local-errors';
import {
  actionOfResult,
  retryDelayMs,
  type NewOperation,
  type QueuedOperation,
} from '../../domain/model/outbox';
import type { ConnectionMonitor } from '../../domain/ports/in/connection-monitor';
import type { LocalWorkspace } from '../../domain/ports/in/local-workspace';
import type { Outbox, Settlement } from '../../domain/ports/in/outbox';
import type { SyncEngine, SyncState } from '../../domain/ports/in/sync-engine';
import type { Clock } from '../../domain/ports/out/clock';
import type { ExclusiveRunner } from '../../domain/ports/out/exclusive-runner';
import type { Random } from '../../domain/ports/out/random';
import type { Scheduler } from '../../domain/ports/out/scheduler';
import type { SyncApi, SyncResponse } from '../../domain/ports/out/sync-api';

interface Dependencies {
  readonly workspace: LocalWorkspace;
  readonly api: SyncApi;
  readonly connection: ConnectionMonitor;
  readonly runner: ExclusiveRunner;
  readonly scheduler: Scheduler;
  readonly clock: Clock;
  readonly random: Random;
}

/** El nombre del candado entre pestañas: una sola sincronizacion a la vez (ADR 0009). */
const LOCK_NAME = 'vsd-stock-sync';

const INITIAL: SyncState = {
  phase: 'idle',
  pending: 0,
  attention: 0,
  lastSyncedAt: null,
  sessionExpired: false,
  nextTryAt: null,
  fault: null,
};

/** Si el servidor contesto lo que se le pregunto: un resultado por operacion y en el mismo orden. */
function answersTheBatch(batch: readonly QueuedOperation[], response: SyncResponse): boolean {
  return (
    response.results.length === batch.length &&
    response.results.every(
      (result, index) =>
        result.operationId === null || result.operationId === batch[index]?.operationId,
    )
  );
}

/**
 * El motor de sincronizacion (C3-09, ADR 0009 y 0028). Mientras haya conexion y alguien trabajando, manda la cola de operaciones
 * de lote en lote, la mas antigua primero, y decide con cada resultado como con cualquier respuesta: lo que el servidor tiene sale
 * de la cola, lo que rechazo se aparta y avisa, y lo que puede pasar se reintenta con una espera que crece. Una sola
 * sincronizacion a la vez entre todas las pestañas. Nunca dice «guardado» de lo que solo esta en el dispositivo: el estado cuenta lo
 * que espera.
 */
export class SyncEngineUseCase implements SyncEngine {
  private state: SyncState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private started = false;
  private stops: (() => void)[] = [];
  private running: Promise<void> | null = null;
  private cancelRetry: (() => void) | null = null;
  /** Fallos seguidos desde el ultimo lote que paso: de ahi sale la espera. */
  private failures = 0;
  private offset: number | null = null;

  constructor(private readonly deps: Dependencies) {}

  current(): SyncState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clockOffsetMs(): number | null {
    return this.offset;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stops.push(
      this.deps.connection.subscribe((connection) => {
        if (connection.status === 'online') void this.request();
      }),
      this.deps.workspace.subscribe(() => {
        // Entro otra persona (o la misma de nuevo): puede haber vuelto a iniciar sesion, y su cola es otra.
        if (this.state.sessionExpired) this.update({ sessionExpired: false });
        void this.refresh().then(() => this.request());
      }),
    );
    void this.refresh().then(() => this.request());
  }

  stop(): void {
    this.started = false;
    this.cancelPendingRetry();
    for (const stop of this.stops) stop();
    this.stops = [];
  }

  async enqueue(operation: NewOperation): Promise<void> {
    await this.deps.workspace.outbox().enqueue(operation);
    await this.refresh();
    void this.request();
  }

  syncNow(): Promise<void> {
    // La persona lo pide: si la sesion habia caducado, puede que ya haya vuelto a entrar.
    if (this.state.sessionExpired) this.update({ sessionExpired: false });
    return this.run();
  }

  /** Lo que pasa solo (llego la conexion, se agrego una operacion, vencio la espera): no insiste con una sesion caducada. */
  private request(): Promise<void> {
    if (this.state.sessionExpired) return Promise.resolve();
    return this.run();
  }

  private run(): Promise<void> {
    if (this.running !== null) return this.running;
    this.cancelPendingRetry();
    const running = this.cycle().finally(() => {
      this.running = null;
    });
    this.running = running;
    return running;
  }

  private async cycle(): Promise<void> {
    const result = await this.deps.runner.runIfFree(LOCK_NAME, () => this.drain());
    // Otra pestaña esta enviando: aqui solo se mira la cola, que es la de la misma persona.
    if (!result.ran) await this.refresh();
  }

  /** Manda lotes hasta que no quede nada, no haya conexion o algo falle. */
  private async drain(): Promise<void> {
    let outbox: Outbox;
    try {
      outbox = this.deps.workspace.outbox();
    } catch (error) {
      if (error instanceof NoWorkspaceError) return;
      throw error;
    }
    try {
      for (;;) {
        if (this.deps.connection.current().status !== 'online') break;
        const batch = await outbox.nextBatch();
        if (batch.length === 0) break;
        this.update({ phase: 'sending' });
        if ((await this.sendBatch(outbox, batch)) === 'stop') break;
      }
    } catch (error) {
      // La persona cambio mientras tanto: su cola ya no es la de esta vuelta, y nada de lo que falta le toca a quien llego.
      if (!(error instanceof NoWorkspaceError)) throw error;
    } finally {
      await this.refresh();
      if (this.state.phase !== 'waiting') this.update({ phase: 'idle' });
    }
  }

  private async sendBatch(outbox: Outbox, batch: QueuedOperation[]): Promise<'next' | 'stop'> {
    const sentAt = this.deps.clock.now();
    let response: SyncResponse;
    try {
      response = await this.deps.api.send(batch);
    } catch (error) {
      return await this.requestFailed(outbox, batch, error);
    }
    const receivedAt = this.deps.clock.now();
    if (!answersTheBatch(batch, response)) {
      // Una respuesta que no es la del contrato no es de nuestro servidor (un proxy, otra version): puede pasar.
      return await this.mayPass(outbox, batch, null, null);
    }

    const measured = measureClockOffsetMs(response.serverTime, sentAt, receivedAt);
    if (measured !== null) this.offset = measured;

    const settlements: Settlement[] = [];
    let retry = false;
    let session = false;
    for (const [index, operation] of batch.entries()) {
      const action = actionOfResult(response.results[index]!);
      if (action.action === 'done') {
        settlements.push({ operationId: operation.operationId, outcome: 'done' });
      } else if (action.action === 'attention') {
        settlements.push({
          operationId: operation.operationId,
          outcome: 'attention',
          reason: action.reason,
        });
      } else if (action.action === 'retry') {
        settlements.push({ operationId: operation.operationId, outcome: 'attempted' });
        retry = true;
      } else {
        // Un 401 es de la sesion y no de la operacion: esta y las que siguen se quedan como estan.
        session = true;
        break;
      }
    }
    await outbox.settle(settlements);

    if (session) {
      this.update({ sessionExpired: true });
      return 'stop';
    }
    if (retry) {
      this.failures += 1;
      this.waitToTryAgain(null);
      return 'stop';
    }
    this.failures = 0;
    this.update({ lastSyncedAt: receivedAt, fault: null, nextTryAt: null });
    await this.refresh();
    return 'next';
  }

  /** Toda la peticion fallo: lo que hace falta depende de la clase del fallo (ADR 0009). */
  private async requestFailed(
    outbox: Outbox,
    batch: QueuedOperation[],
    error: unknown,
  ): Promise<'next' | 'stop'> {
    if (!(error instanceof ApiError)) return await this.mayPass(outbox, batch, null, null);
    const { failure } = error;
    switch (failure.class) {
      case 'network':
        // Sin respuesta: no se gasta un intento. La conexion lo comprueba y avisa cuando vuelva.
        void this.deps.connection.retry();
        return 'stop';
      case 'session':
        this.update({ sessionExpired: true });
        return 'stop';
      case 'transient':
        return await this.mayPass(outbox, batch, failure.retryAfterMs, null);
      default:
        // El servidor rechazo la peticion entera (muy grande, mal formada): no es de una operacion, y reintentar igual no
        // arregla nada, pero tampoco hay a quien culpar. Se dice por que y se sigue intentando con espera.
        return await this.mayPass(outbox, batch, failure.retryAfterMs, {
          status: failure.status,
          code: failure.problem?.code ?? null,
        });
    }
  }

  /** Lo que fallo puede pasar: cada operacion del lote cuenta un intento y se espera antes de volver a mandar. */
  private async mayPass(
    outbox: Outbox,
    batch: QueuedOperation[],
    retryAfterMs: number | null,
    fault: SyncState['fault'],
  ): Promise<'stop'> {
    await outbox.settle(
      batch.map((operation) => ({ operationId: operation.operationId, outcome: 'attempted' })),
    );
    this.failures += 1;
    this.update({ fault });
    this.waitToTryAgain(retryAfterMs);
    return 'stop';
  }

  private waitToTryAgain(retryAfterMs: number | null): void {
    // `run()` ya cancelo la espera anterior al empezar: aqui nunca hay una pendiente.
    const delay = retryDelayMs(this.failures, retryAfterMs, () => this.deps.random.next());
    this.update({
      phase: 'waiting',
      nextTryAt: new Date(this.deps.clock.now().getTime() + delay),
    });
    this.cancelRetry = this.deps.scheduler.schedule(() => {
      this.cancelRetry = null;
      this.update({ nextTryAt: null });
      void this.request();
    }, delay);
  }

  private cancelPendingRetry(): void {
    this.cancelRetry?.();
    this.cancelRetry = null;
  }

  /** Vuelve a contar la cola de quien trabaja. Sin nadie trabajando, no hay nada que contar. */
  private async refresh(): Promise<void> {
    try {
      const { pending, attention } = await this.deps.workspace.outbox().counts();
      this.update({ pending, attention });
    } catch (error) {
      if (!(error instanceof NoWorkspaceError)) throw error;
      this.update({ pending: 0, attention: 0 });
    }
  }

  private update(change: Partial<SyncState>): void {
    const next: SyncState = { ...this.state, ...change };
    if (sameState(this.state, next)) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
}

/** Si dos estados dicen lo mismo: las fechas se comparan por su hora y el fallo por su contenido. */
function sameState(a: SyncState, b: SyncState): boolean {
  return (
    a.phase === b.phase &&
    a.pending === b.pending &&
    a.attention === b.attention &&
    a.sessionExpired === b.sessionExpired &&
    a.lastSyncedAt?.getTime() === b.lastSyncedAt?.getTime() &&
    a.nextTryAt?.getTime() === b.nextTryAt?.getTime() &&
    a.fault?.status === b.fault?.status &&
    a.fault?.code === b.fault?.code &&
    (a.fault === null) === (b.fault === null)
  );
}
