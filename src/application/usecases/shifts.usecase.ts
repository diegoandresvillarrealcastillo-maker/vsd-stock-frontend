import {
  DeviceNotRegisteredError,
  NoOpenShiftError,
  NoWorkspaceError,
  ShiftAlreadyOpenError,
} from '../../domain/model/local-errors';
import { MAX_PESOS } from '../../domain/model/money';
import { NO_SALES, closingBody, openingBody, summarizeShift } from '../../domain/model/shift';
import type { LocalWorkspace } from '../../domain/ports/in/local-workspace';
import type { Confirmation, ShiftState, Shifts } from '../../domain/ports/in/shifts';
import type { ShiftStorage } from '../../domain/ports/in/shift-storage';
import type { SyncEngine } from '../../domain/ports/in/sync-engine';
import type { Clock } from '../../domain/ports/out/clock';
import type { IdGenerator } from '../../domain/ports/out/id-generator';

interface Dependencies {
  readonly workspace: LocalWorkspace;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Del motor de envio: avisarle de lo que se puso en la cola, saber cuanto se adelanta el servidor y mirar si la cola se movio. */
  readonly sync: Pick<SyncEngine, 'current' | 'subscribe' | 'queued' | 'clockOffsetMs'>;
}

/** Un monto de caja es un entero de pesos, de cero al maximo del sistema: la interfaz ya lo valido, esto cuida que nada raro se guarde. */
function requireCash(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_PESOS) {
    throw new RangeError(
      `The cash of the drawer must be a whole number of pesos: ${String(amount)}`,
    );
  }
}

/** Si dos estados dicen lo mismo. Son datos sencillos, asi que se comparan por su contenido. */
function sameState(a: ShiftState, b: ShiftState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * El turno de caja de quien trabaja (C3-11, ADR 0026). Abrir y cerrar guardan el turno y su operacion en una sola transaccion de
 * la base cifrada y avisan al motor de envio; el arqueo que se muestra sale de lo que este dispositivo sabe. Vigila a quien
 * trabaja y a la cola de envio para que lo que se dice (por ejemplo, «el servidor ya lo tiene») nunca sea de otra persona ni viejo.
 */
export class ShiftsUseCase implements Shifts {
  private state: ShiftState = { status: 'loading' };
  private readonly listeners = new Set<() => void>();
  private started = false;
  private stops: (() => void)[] = [];
  /** Cada lectura lleva un numero: si otra empezo despues, la que termina tarde no cuenta. */
  private reading = 0;
  /** Las acciones de la persona (abrir, cerrar) se turnan: la segunda ve lo que dejo la primera. */
  private turn: Promise<unknown> = Promise.resolve();
  private watched = { pending: -1, attention: -1, syncedAt: -1 };

  constructor(private readonly deps: Dependencies) {}

  current(): ShiftState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.watched = this.sendingNow();
    this.stops.push(
      this.deps.workspace.subscribe(() => {
        void this.refresh();
      }),
      this.deps.sync.subscribe(() => {
        // Solo cuando la cola se movio: lo demas que hace el envio (reintentos, esperas) no cambia lo que se dice del turno.
        const now = this.sendingNow();
        const moved = JSON.stringify(now) !== JSON.stringify(this.watched);
        this.watched = now;
        if (moved) void this.refresh();
      }),
    );
    void this.refresh();
  }

  stop(): void {
    this.started = false;
    for (const stop of this.stops) stop();
    this.stops = [];
  }

  async refresh(): Promise<void> {
    this.reading += 1;
    const reading = this.reading;
    let next: ShiftState;
    try {
      next = await this.read();
    } catch (error) {
      // La persona cambio mientras se leia: el cambio ya pidio otra lectura, y esa es la que cuenta.
      if (error instanceof NoWorkspaceError) return;
      if (reading === this.reading) this.update({ status: 'failed' });
      return;
    }
    if (reading === this.reading) this.update(next);
  }

  open(openingAmount: number): Promise<void> {
    return this.exclusively(async () => {
      requireCash(openingAmount);
      const active = this.deps.workspace.current();
      if (active === null) throw new NoWorkspaceError();
      // El servidor tiene que conocer este dispositivo: el turno lo nombra y sin eso la apertura se rechazaria para siempre.
      if (active.deviceId === null) throw new DeviceNotRegisteredError();

      const storage = this.deps.workspace.shifts();
      const current = await storage.readCurrentShift();
      if (current !== null && current.closing === null) throw new ShiftAlreadyOpenError();

      const now = this.deps.clock.now();
      const shiftId = this.deps.ids.newId();
      const operationId = this.deps.ids.newId();
      await storage.saveShift(
        {
          shiftId,
          deviceId: active.deviceId,
          openOperationId: operationId,
          openedAt: now.toISOString(),
          openingAmount,
          sales: NO_SALES,
          closing: null,
        },
        {
          operationId,
          kind: 'shift-open',
          body: openingBody({
            operationId,
            shiftId,
            deviceId: active.deviceId,
            openingAmount,
            at: now,
            clockOffsetMs: this.deps.sync.clockOffsetMs(),
          }),
          createdAt: now,
        },
      );
      await this.saved();
    });
  }

  close(countedAmount: number): Promise<void> {
    return this.exclusively(async () => {
      requireCash(countedAmount);
      const storage = this.deps.workspace.shifts();
      const current = await storage.readCurrentShift();
      if (current === null || current.closing !== null) throw new NoOpenShiftError();

      const now = this.deps.clock.now();
      const operationId = this.deps.ids.newId();
      await storage.saveShift(
        {
          ...current,
          closing: { operationId, closedAt: now.toISOString(), countedAmount },
        },
        {
          operationId,
          kind: 'shift-close',
          shiftId: current.shiftId,
          body: closingBody({
            operationId,
            countedAmount,
            at: now,
            clockOffsetMs: this.deps.sync.clockOffsetMs(),
          }),
          createdAt: now,
        },
      );
      await this.saved();
    });
  }

  /** Lo que la cola de envio dice y cambia lo que se muestra del turno: cuantas esperan, cuantas piden atencion y la ultima vez. */
  private sendingNow(): { pending: number; attention: number; syncedAt: number } {
    const { pending, attention, lastSyncedAt } = this.deps.sync.current();
    return { pending, attention, syncedAt: lastSyncedAt?.getTime() ?? 0 };
  }

  /** Ya esta guardado: se avisa al envio y se vuelve a leer. Que el aviso falle no deshace nada, saldra la proxima vez. */
  private async saved(): Promise<void> {
    try {
      await this.deps.sync.queued();
    } catch {
      // El turno y su operacion ya estan guardados; el motor los encuentra cuando vuelva la conexion o se reabra la aplicacion.
    }
    await this.refresh();
  }

  /** Hace una accion despues de las que ya estaban en curso, y devuelve lo suyo sin que un fallo ajeno la detenga. */
  private exclusively(action: () => Promise<void>): Promise<void> {
    const result = this.turn.then(action, action);
    // La siguiente se encadena con `then(action, action)`: sigue aunque esta haya fallado.
    this.turn = result;
    return result;
  }

  private async read(): Promise<ShiftState> {
    if (this.deps.workspace.current() === null) return { status: 'none' };
    const storage = this.deps.workspace.shifts();
    const shift = await storage.readCurrentShift();
    if (shift === null) return { status: 'none' };
    const summary = summarizeShift(shift);
    const opening = await confirmationOf(storage, shift.openOperationId);
    if (shift.closing === null) return { status: 'open', shift, summary, opening };
    const closing = await confirmationOf(storage, shift.closing.operationId);
    return { status: 'closed', shift, summary, opening, closing };
  }

  private update(next: ShiftState): void {
    if (sameState(this.state, next)) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
}

async function confirmationOf(storage: ShiftStorage, operationId: string): Promise<Confirmation> {
  const state = await storage.operationState(operationId);
  if (state === null) return 'confirmed';
  return state === 'pending' ? 'waiting' : 'attention';
}
