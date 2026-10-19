import { NO_SALES, summarizeShift, type LocalShift } from '../../src/domain/model/shift';
import type { Confirmation, ShiftState, Shifts } from '../../src/domain/ports/in/shifts';

// El turno de caja de mentira para las pruebas de la interfaz: dice lo que la prueba le manda decir y cuenta lo que le piden. El
// caso de uso real se prueba aparte, con sus propios dobles (`fake-shifts.ts`).

/** Un turno abierto a las 8:02 de la manana del dia 19, con el efectivo inicial de la caja. */
export function openShift(change: Partial<LocalShift> = {}): LocalShift {
  return {
    shiftId: 'a0000000-0000-4000-8000-000000000001',
    deviceId: 'a0000000-0000-4000-8000-0000000000d1',
    openOperationId: 'a0000000-0000-4000-8000-000000000002',
    // La hora se dice en la del dispositivo: se arma con ella para que la prueba no dependa de donde corra.
    openedAt: new Date(2026, 9, 19, 8, 2).toISOString(),
    openingAmount: 50_000,
    sales: NO_SALES,
    closing: null,
    ...change,
  };
}

/** El estado de un turno abierto, con su arqueo calculado como lo calcula el caso de uso. */
export function openState(
  change: Partial<LocalShift> = {},
  opening: Confirmation = 'waiting',
): Extract<ShiftState, { status: 'open' }> {
  const shift = openShift(change);
  return { status: 'open', shift, summary: summarizeShift(shift), opening };
}

/** El estado de un turno ya cerrado: abierto a las 8:02, cerrado a las 6:15 de la tarde. */
export function closedState(
  counted = 168_000,
  change: Partial<LocalShift> = {},
  confirmations: { opening?: Confirmation; closing?: Confirmation } = {},
): Extract<ShiftState, { status: 'closed' }> {
  const shift = openShift({
    sales: { cashCount: 3, cashAmount: 120_000, otherCount: 2, otherAmount: 48_500 },
    closing: {
      operationId: 'a0000000-0000-4000-8000-000000000003',
      closedAt: new Date(2026, 9, 19, 18, 15).toISOString(),
      countedAmount: counted,
    },
    ...change,
  });
  return {
    status: 'closed',
    shift,
    summary: summarizeShift(shift),
    opening: confirmations.opening ?? 'confirmed',
    closing: confirmations.closing ?? 'waiting',
  };
}

export class FakeShifts implements Shifts {
  starts = 0;
  stops = 0;
  refreshes = 0;
  readonly opened: number[] = [];
  readonly closed: number[] = [];
  /** Si se pone, la siguiente accion falla con este error (y se apaga). */
  failNext: Error | null = null;
  /** Lo que pasa cuando una accion sale bien: por omision, nada. La prueba puede cambiar el estado como lo haria el real. */
  onOpened: ((amount: number) => void) | null = null;
  onClosed: ((amount: number) => void) | null = null;
  private state: ShiftState;
  private readonly listeners = new Set<() => void>();

  constructor(state: ShiftState = { status: 'none' }) {
    this.state = state;
  }

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
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }

  refresh(): Promise<void> {
    this.refreshes += 1;
    return Promise.resolve();
  }

  open(openingAmount: number): Promise<void> {
    if (this.failNext !== null) {
      const error = this.failNext;
      this.failNext = null;
      return Promise.reject(error);
    }
    this.opened.push(openingAmount);
    this.onOpened?.(openingAmount);
    return Promise.resolve();
  }

  close(countedAmount: number): Promise<void> {
    if (this.failNext !== null) {
      const error = this.failNext;
      this.failNext = null;
      return Promise.reject(error);
    }
    this.closed.push(countedAmount);
    this.onClosed?.(countedAmount);
    return Promise.resolve();
  }

  /** El turno cambia: la interfaz se entera como se enteraria del real. El estado nuevo es otro objeto. */
  set(state: ShiftState): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }

  get subscribers(): number {
    return this.listeners.size;
  }
}
