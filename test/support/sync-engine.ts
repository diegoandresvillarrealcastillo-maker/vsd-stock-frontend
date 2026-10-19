import type { NewOperation } from '../../src/domain/model/outbox';
import type { SyncEngine, SyncState } from '../../src/domain/ports/in/sync-engine';

/** El estado de un motor que no tiene nada que decir: nada espera y no hay fallos. */
export const QUIET: SyncState = {
  phase: 'idle',
  pending: 0,
  attention: 0,
  lastSyncedAt: null,
  sessionExpired: false,
  nextTryAt: null,
  fault: null,
};

/**
 * El motor de sincronizacion de mentira para las pruebas de la interfaz: dice lo que la prueba le manda decir y cuenta lo que le
 * piden. El motor real se prueba aparte, con sus propios dobles (`fake-sync.ts`).
 */
export class FakeSyncEngine implements SyncEngine {
  starts = 0;
  stops = 0;
  syncNows = 0;
  readonly enqueued: NewOperation[] = [];
  private state: SyncState;
  private readonly listeners = new Set<() => void>();

  constructor(state: Partial<SyncState> = {}) {
    this.state = { ...QUIET, ...state };
  }

  current(): SyncState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }

  enqueue(operation: NewOperation): Promise<void> {
    this.enqueued.push(operation);
    return Promise.resolve();
  }

  queuedCalls = 0;

  queued(): Promise<void> {
    this.queuedCalls += 1;
    return Promise.resolve();
  }

  syncNow(): Promise<void> {
    this.syncNows += 1;
    return Promise.resolve();
  }

  /** Cuanto adelanta el servidor al reloj, segun el motor de mentira. */
  offset: number | null = null;

  clockOffsetMs(): number | null {
    return this.offset;
  }

  /** El motor cambia: la interfaz se entera como se enteraria del real. El estado nuevo es otro objeto. */
  set(change: Partial<SyncState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of [...this.listeners]) listener();
  }

  get subscribers(): number {
    return this.listeners.size;
  }
}
