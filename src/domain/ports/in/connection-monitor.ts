import type { ConnectionState } from '../../model/connection';

/** Lo que la interfaz y el motor de sincronizacion saben de la conexion. */
export interface ConnectionMonitor {
  /** El estado actual. Es el mismo objeto mientras nada cambie. */
  current(): ConnectionState;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: (state: ConnectionState) => void): () => void;
  /** Empieza a vigilar la conexion. Llamarlo otra vez no hace nada. */
  start(): void;
  /** Deja de vigilarla y cancela lo pendiente. */
  stop(): void;
  /** La persona pide comprobar ya. Se cumple cuando llega la respuesta. */
  retry(): Promise<void>;
}
