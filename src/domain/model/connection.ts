/**
 * Si la aplicacion puede hablar con el servidor.
 *
 * - `checking`: todavia no hay respuesta (solo al arrancar o al reintentar).
 * - `online`: el servidor respondio. Es la unica forma de estar en linea: que
 *   el navegador diga que hay red no basta.
 * - `offline`: no hay red o el servidor no respondio.
 */
export type ConnectionStatus = 'checking' | 'online' | 'offline';

export interface ConnectionState {
  readonly status: ConnectionStatus;
  /**
   * Hora que dio el servidor la ultima vez que respondio, o `null` si nunca lo
   * hizo. Se conserva mientras no hay conexion: dice desde cuando.
   */
  readonly confirmedAt: Date | null;
}
