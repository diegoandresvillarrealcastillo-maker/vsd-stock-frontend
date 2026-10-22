import { ShiftsUseCase } from '../../src/application/usecases/shifts.usecase';
import type { ShiftState, Shifts } from '../../src/domain/ports/in/shifts';
import type { LocalWorkspace } from '../../src/domain/ports/in/local-workspace';
import type { IdGenerator } from '../../src/domain/ports/out/id-generator';
import { testMe } from './auth';
import { MutableClock } from './fake-sync';
import { createTestLocal, type TestLocal } from './local';
import { FakeSyncEngine } from './sync-engine';

/** Identificadores que se reconocen a simple vista: `a0000000-...-000000000001`, `...2`, etc. */
export class ShiftIds implements IdGenerator {
  private counter = 0;

  newId(): string {
    this.counter += 1;
    return `a0000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}

/** El id n-esimo que reparte `ShiftIds`: el primero es el del turno y el segundo, el de su operacion. */
export const shiftId = (n: number): string =>
  `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export interface TestShifts {
  readonly shifts: ShiftsUseCase;
  readonly local: TestLocal;
  readonly sync: FakeSyncEngine;
  readonly clock: MutableClock;
}

/**
 * El caso de uso real del turno, con su espacio de trabajo local real (bases en memoria), el motor de envio de mentira y el reloj
 * a mano. Por omision trabaja una persona, con el dispositivo ya registrado.
 */
export async function createTestShifts(
  options: {
    working?: boolean;
    registered?: boolean;
    /** Cambia el espacio de trabajo que ve el caso de uso, sin cambiar el que ve la prueba. */
    wrap?: (workspace: LocalWorkspace) => LocalWorkspace;
  } = {},
): Promise<TestShifts> {
  const clock = new MutableClock(new Date('2026-10-19T13:02:00.000Z'));
  const local = createTestLocal(clock.now());
  if (options.working !== false) {
    await local.workspace.begin(testMe('ana', 'cashier'));
    if (options.registered !== false) await local.workspace.registerDevice();
  }
  const sync = new FakeSyncEngine();
  const shifts = new ShiftsUseCase({
    workspace: options.wrap?.(local.workspace) ?? local.workspace,
    clock,
    ids: new ShiftIds(),
    sync,
  });
  return { shifts, local, sync, clock };
}

/** Lo que dice el estado, para las pruebas que solo miran de que clase es. */
export const statusOf = (shifts: Shifts): ShiftState['status'] => shifts.current().status;
