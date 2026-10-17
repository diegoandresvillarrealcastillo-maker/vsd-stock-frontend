/** La persona que demuestra el token, tal como la conoce el servicio de identidad (ADR 0022). */
export interface AuthUser {
  /** El `sub` del token: el identificador de la persona en el servicio de identidad. */
  readonly id: string;
  readonly email: string | null;
}

/**
 * La sesion de una persona. Vive SOLO en memoria (ADR 0018 y 0022): recargar la pagina la pierde y pide la contrasena otra
 * vez. El token de renovacion tampoco se guarda en el dispositivo.
 */
export interface Session {
  readonly accessToken: string;
  /** Con el se pide un token de acceso nuevo sin la contrasena. `null` si el servicio no lo entrego. */
  readonly refreshToken: string | null;
  readonly expiresAt: Date;
  readonly user: AuthUser;
}

/** Un minuto de margen: una peticion no sale con un token a punto de vencer. */
export const REFRESH_MARGIN_MS = 60_000;

/** Si el token de acceso vence dentro del margen (o ya vencio) y hay que pedir uno nuevo antes de usarlo. */
export function needsRefresh(
  session: Session,
  now: Date,
  marginMs: number = REFRESH_MARGIN_MS,
): boolean {
  return session.expiresAt.getTime() - now.getTime() <= marginMs;
}

/** Si el token de acceso ya vencio. */
export function isExpired(session: Session, now: Date): boolean {
  return session.expiresAt.getTime() <= now.getTime();
}
