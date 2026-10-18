import type { Me } from './me';
import { isRole, type Role } from './permissions';

/**
 * Lo que este dispositivo sabe de quien trabaja en el: quien es, donde trabaja, con que rol y cuando el servidor lo confirmo
 * por ultima vez (ADR 0022, punto 11). No es secreto: ninguna contrasena ni token. Vive dentro de la base cifrada de la
 * persona (ADR 0018) y es lo que deja reanudar el mostrador sin conexion.
 */
export interface LocalProfile {
  /** El identificador de la persona en el servicio de identidad (`sub`): es tambien el nombre de su base local. */
  readonly authUserId: string;
  readonly email: string | null;
  /** La persona dentro de su negocio. */
  readonly userId: string;
  readonly businessId: string;
  readonly businessName: string;
  readonly role: Role;
  readonly fullName: string;
  /** Cuando el servidor confirmo por ultima vez que esta persona trabaja aqui, en ISO 8601 UTC. */
  readonly verifiedAt: string;
}

/** Setenta y dos horas, el mismo limite tras el cual una operacion se marca `stale` (ADR 0022, punto 11, y ADR 0016). */
export const COUNTER_RESUME_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * Cuanto puede estar el reloj del dispositivo por detras de la ultima verificacion sin que se desconfie de el: los relojes se
 * corrigen solos de a poco y la hora se midio con el del propio dispositivo.
 */
export const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Si el mostrador puede reanudarse sin conexion:
 * - `open`: si, y cuanto tiempo queda.
 * - `locked`: no. `expired`: pasaron las setenta y dos horas; `clock-behind`: el reloj esta por detras de la verificacion
 *   (alguien lo atraso para estirar el plazo); `unreadable`: la hora guardada no se lee.
 */
export type CounterAccess =
  | { readonly state: 'open'; readonly remainingMs: number }
  | { readonly state: 'locked'; readonly reason: 'expired' | 'clock-behind' | 'unreadable' };

export function counterAccess(profile: LocalProfile, now: Date): CounterAccess {
  const verified = new Date(profile.verifiedAt).getTime();
  if (Number.isNaN(verified)) return { state: 'locked', reason: 'unreadable' };
  const elapsed = now.getTime() - verified;
  if (elapsed < -CLOCK_TOLERANCE_MS) return { state: 'locked', reason: 'clock-behind' };
  if (elapsed >= COUNTER_RESUME_WINDOW_MS) return { state: 'locked', reason: 'expired' };
  // Un reloj apenas atrasado cuenta como recien verificado: el plazo nunca se estira mas de lo que dura.
  return { state: 'open', remainingMs: COUNTER_RESUME_WINDOW_MS - Math.max(elapsed, 0) };
}

/** El registro de quien acaba de ser verificado, o `null` si todavia no tiene negocio: no hay mostrador para el. */
export function profileOf(me: Me, verifiedAt: Date): LocalProfile | null {
  const { membership } = me;
  if (membership === null) return null;
  return {
    authUserId: me.identity.id,
    email: me.identity.email,
    userId: membership.userId,
    businessId: membership.businessId,
    businessName: membership.businessName,
    role: membership.role,
    fullName: membership.fullName,
    verifiedAt: verifiedAt.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lee un registro guardado. Devuelve `null` si no tiene la forma esperada y NUNCA lanza: lo guardado en el disco tampoco es
 * de fiar (otra version, un registro dañado). Solo toma los campos que conoce.
 */
export function parseProfile(value: unknown): LocalProfile | null {
  if (!isRecord(value)) return null;
  const { authUserId, email, userId, businessId, businessName, role, fullName, verifiedAt } = value;
  if (
    typeof authUserId !== 'string' ||
    (email !== null && typeof email !== 'string') ||
    typeof userId !== 'string' ||
    typeof businessId !== 'string' ||
    typeof businessName !== 'string' ||
    typeof fullName !== 'string' ||
    typeof verifiedAt !== 'string' ||
    !isRole(role)
  ) {
    return null;
  }
  return { authUserId, email, userId, businessId, businessName, role, fullName, verifiedAt };
}
