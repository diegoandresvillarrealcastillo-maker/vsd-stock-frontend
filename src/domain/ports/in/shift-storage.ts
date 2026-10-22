import type { NewOperation, OperationState } from '../../model/outbox';
import type { LocalShift } from '../../model/shift';

/**
 * Lo que el dispositivo guarda del turno de caja de quien trabaja (C3-11, ADR 0026). Es una sola persona: la del espacio de
 * trabajo abierto. Si el dispositivo cambia de persona, cada metodo lanza `NoWorkspaceError` en vez de tocar lo de otra.
 */
export interface ShiftStorage {
  /** El turno de ahora: el abierto, o el ultimo que se cerro mientras no se abra otro. `null` si nunca se abrio uno. */
  readCurrentShift(): Promise<LocalShift | null>;
  /**
   * Guarda el turno Y su operacion en la cola en UNA sola transaccion: si el dispositivo se apaga a la mitad quedan las dos cosas
   * o ninguna, nunca un turno que el servidor no va a recibir ni una operacion de un turno que la persona no ve. Una operacion
   * que ya estaba en la cola no se repite ni se le deshace lo que le paso.
   */
  saveShift(shift: LocalShift, operation: NewOperation): Promise<void>;
  /** Donde esta una operacion: esperando, pidiendo atencion, o `null` si ya no esta en la cola (el servidor la tiene). */
  operationState(operationId: string): Promise<OperationState | null>;
}
