import type { NewOperation, OperationState } from '../../domain/model/outbox';
import type { LocalShift } from '../../domain/model/shift';
import type { ShiftStorage } from '../../domain/ports/in/shift-storage';
import type { LocalStore } from '../../domain/ports/out/local-store';

/**
 * El turno de caja de una persona sobre su base local. Recibe una funcion que da la base mientras esa persona siga trabajando y
 * lanza `NoWorkspaceError` cuando ya no (la base se solto o entro otra persona): asi nunca toca el turno de otra.
 */
export class StoreShifts implements ShiftStorage {
  constructor(private readonly current: () => LocalStore) {}

  async readCurrentShift(): Promise<LocalShift | null> {
    return await this.current().readCurrentShift();
  }

  async saveShift(shift: LocalShift, operation: NewOperation): Promise<void> {
    await this.current().saveShift(shift, operation);
  }

  async operationState(operationId: string): Promise<OperationState | null> {
    return await this.current().operationState(operationId);
  }
}
