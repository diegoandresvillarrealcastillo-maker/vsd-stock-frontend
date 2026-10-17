import { isRole, type Role } from './permissions';

/** El lugar de una persona en su negocio (`GET /v1/me`, ADR 0022). El rol sale de la base de datos, nunca del token. */
export interface Membership {
  readonly userId: string;
  readonly businessId: string;
  readonly businessName: string;
  readonly role: Role;
  readonly fullName: string;
}

/** Quien es la persona y, si ya tiene negocio, donde trabaja. */
export interface Me {
  readonly identity: { readonly id: string; readonly email: string | null };
  /** `null` si se registro pero aun no creo un negocio ni canjeo una invitacion. */
  readonly membership: Membership | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMembership(value: unknown): Membership | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { userId, businessId, businessName, role, fullName } = value;
  if (
    typeof userId !== 'string' ||
    typeof businessId !== 'string' ||
    typeof businessName !== 'string' ||
    typeof fullName !== 'string' ||
    !isRole(role)
  ) {
    return undefined;
  }
  return { userId, businessId, businessName, role, fullName };
}

/**
 * Lee la respuesta de `GET /v1/me`. Devuelve `null` si no tiene la forma del contrato —tambien con un rol que este cliente
 * no conoce— y NUNCA lanza: los datos de la red no son de fiar aunque el contrato diga lo contrario.
 */
export function parseMe(body: unknown): Me | null {
  if (!isRecord(body)) return null;
  const { identity, membership } = body;
  if (!isRecord(identity) || typeof identity['id'] !== 'string') return null;
  const email = identity['email'];
  if (email !== null && typeof email !== 'string') return null;

  const parsed = parseMembership(membership);
  if (parsed === undefined) return null;
  return { identity: { id: identity['id'], email }, membership: parsed };
}
