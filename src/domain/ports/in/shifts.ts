import type { LocalShift, ShiftSummary } from '../../model/shift';

/** Si el servidor ya tiene una operacion del turno: la tiene, la espera o la rechazo y alguien tiene que mirarla. */
export type Confirmation = 'confirmed' | 'waiting' | 'attention';

/**
 * Lo que la interfaz sabe del turno de caja de quien trabaja. Es el mismo objeto mientras nada cambie.
 * - `loading`: todavia no se miro lo guardado.
 * - `none`: no hay turno (nunca se abrio uno, o nadie trabaja).
 * - `open`: hay un turno abierto, con su arqueo del dispositivo.
 * - `closed`: el ultimo turno esta cerrado; se sigue mostrando hasta que se abra otro.
 * - `failed`: lo guardado no se pudo leer. No se dice «no hay turno»: se podria abrir otro con uno abierto.
 */
export type ShiftState =
  | { readonly status: 'loading' }
  | { readonly status: 'none' }
  | { readonly status: 'failed' }
  | {
      readonly status: 'open';
      readonly shift: LocalShift;
      readonly summary: ShiftSummary;
      readonly opening: Confirmation;
    }
  | {
      readonly status: 'closed';
      readonly shift: LocalShift;
      readonly summary: ShiftSummary;
      readonly opening: Confirmation;
      readonly closing: Confirmation;
    };

/**
 * Puerto de entrada: el turno de caja (C3-11, ADR 0026). Se abre con el efectivo de la caja y se cierra con el conteo, sin
 * conexion: lo que la persona hizo queda guardado en el dispositivo, junto con la operacion que el servidor recibira, y se envia
 * cuando haya conexion. El arqueo que se muestra es el del dispositivo; el definitivo lo calcula el servidor.
 */
export interface Shifts {
  current(): ShiftState;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
  /** Empieza a vigilar a quien trabaja y el envio, y lee el turno guardado. Llamarlo otra vez no hace nada. */
  start(): void;
  /** Deja de vigilar. */
  stop(): void;
  /** Vuelve a leer lo guardado, por ejemplo tras una venta. Nunca lanza: si no se puede leer queda en `failed`. */
  refresh(): Promise<void>;
  /**
   * Abre el turno con el efectivo que hay en la caja. Lanza `NoWorkspaceError`, `DeviceNotRegisteredError` (el servidor no
   * conoce este dispositivo todavia), `ShiftAlreadyOpenError` y `RangeError` si el monto no es un entero de pesos valido.
   */
  open(openingAmount: number): Promise<void>;
  /** Cierra el turno con el efectivo contado. Lanza `NoWorkspaceError`, `NoOpenShiftError` y `RangeError`. */
  close(countedAmount: number): Promise<void>;
}
