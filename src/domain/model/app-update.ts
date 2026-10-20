/**
 * Donde esta la actualizacion de la aplicacion (C3-07, ADR 0030).
 *
 * - `unsupported`: el navegador no tiene service workers (o la aplicacion no corre instalada): no hay nada que actualizar.
 * - `idle`: no hay version nueva esperando.
 * - `ready`: una version nueva ya se descargo y espera a que la persona decida usarla.
 * - `applying`: la persona pidio actualizar; la pagina se recarga en cuanto la version nueva toma el control.
 *
 * Una version nueva NUNCA se activa sola: pasar de `ready` a `applying` es siempre un gesto de la persona, para que no
 * ocurra a mitad de una venta.
 */
export type AppUpdateStatus = 'unsupported' | 'idle' | 'ready' | 'applying';

export interface AppUpdateState {
  readonly status: AppUpdateStatus;
  /** `true` mientras alguna pantalla pida no actualizar (una venta en curso): el aviso sigue, pero no deja actualizar. */
  readonly held: boolean;
}
