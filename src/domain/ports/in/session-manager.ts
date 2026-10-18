import type { Session } from '../../model/session';

/** Lo que la interfaz y el cliente de la API saben de la sesion. */
export interface SessionManager {
  /** La sesion actual, o `null`. Es el mismo objeto mientras nada cambie. */
  current(): Session | null;
  /** Avisa de cada cambio de sesion. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
  /** Entra con correo y contrasena. Lanza `AuthError`. */
  signIn(email: string, password: string): Promise<Session>;
  /** Registra a la persona. `null` si el servicio pide confirmar el correo. Lanza `AuthError`. */
  signUp(email: string, password: string): Promise<Session | null>;
  /** Cierra la sesion. Siempre la borra de la memoria, aunque el servidor no responda. */
  signOut(): Promise<void>;
  /**
   * Un token de acceso que sirva ahora, renovandolo si esta por vencer. `null` si no hay sesion o ya no se puede
   * renovar. Muchas llamadas a la vez comparten UNA renovacion.
   */
  accessToken(): Promise<string | null>;
}
