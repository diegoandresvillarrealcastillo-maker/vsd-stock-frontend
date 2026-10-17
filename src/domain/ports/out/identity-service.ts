import type { Session } from '../../model/session';

/**
 * Puerto de salida: el servicio de identidad (Supabase Auth, ADR 0022). Todo fallo es un `AuthError` con su clase
 * (`network` si no hubo respuesta). El navegador habla con el servicio directamente, con la clave publicable.
 */
export interface IdentityService {
  signIn(email: string, password: string): Promise<Session>;
  /** `null` si el servicio pide confirmar el correo antes de entregar una sesion. */
  signUp(email: string, password: string): Promise<Session | null>;
  /** Cambia un token de renovacion por una sesion nueva. */
  refresh(refreshToken: string): Promise<Session>;
  /** Cierra la sesion en el servidor. */
  signOut(accessToken: string): Promise<void>;
}
