import type { Session } from '../../model/session';

/**
 * Puerto de salida: donde vive la sesion mientras la pagina esta abierta. Su adaptador es MEMORIA y nada mas (ADR 0018 y
 * 0022): ni el token de acceso ni el de renovacion se escriben en el dispositivo.
 */
export interface SessionStore {
  get(): Session | null;
  set(session: Session): void;
  clear(): void;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
}
