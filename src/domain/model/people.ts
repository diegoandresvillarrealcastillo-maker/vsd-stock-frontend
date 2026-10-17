import { can, isRole, type Role } from './permissions';

/** Si la persona ya entro (`active`), tiene una invitacion sin canjear (`pending`) o fue dada de baja (`inactive`). */
export type PersonStatus = 'active' | 'pending' | 'inactive';

/** Una persona del negocio, tal como la lista `GET /v1/users` (ADR 0023). */
export interface Person {
  readonly id: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly role: Role;
  readonly status: PersonStatus;
  /** Cuando vence su invitacion, si todavia tiene una sin canjear. */
  readonly invitationExpiresAt: Date | null;
  readonly createdAt: Date;
}

export interface PersonPage {
  readonly items: readonly Person[];
  /** Se pasa tal cual para pedir la pagina siguiente; `null` si no hay mas. */
  readonly nextCursor: string | null;
}

/** El codigo de una invitacion. El servidor lo entrega UNA vez y no lo guarda: despues solo se puede renovar. */
export interface Invitation {
  readonly person: Person;
  readonly code: string;
  readonly expiresAt: Date;
}

const STATUSES: readonly string[] = ['active', 'pending', 'inactive'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Lee una persona. Devuelve `null` si no tiene la forma del contrato: los datos de la red no son de fiar. */
export function parsePerson(value: unknown): Person | null {
  if (!isRecord(value)) return null;
  const { id, fullName, email, role, status, invitationExpiresAt, createdAt } = value;
  if (typeof id !== 'string' || typeof fullName !== 'string') return null;
  if (email !== null && typeof email !== 'string') return null;
  if (!isRole(role)) return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  const created = readDate(createdAt);
  if (created === null) return null;
  let expires: Date | null = null;
  if (invitationExpiresAt !== null) {
    expires = readDate(invitationExpiresAt);
    if (expires === null) return null;
  }
  return {
    id,
    fullName,
    email,
    role,
    status: status as PersonStatus,
    invitationExpiresAt: expires,
    createdAt: created,
  };
}

export function parsePersonPage(value: unknown): PersonPage | null {
  if (!isRecord(value) || !Array.isArray(value['items'])) return null;
  const nextCursor = value['nextCursor'];
  if (nextCursor !== null && typeof nextCursor !== 'string') return null;
  const items: Person[] = [];
  for (const raw of value['items'] as unknown[]) {
    const person = parsePerson(raw);
    if (person === null) return null;
    items.push(person);
  }
  return { items, nextCursor };
}

/** Lee la respuesta de crear o renovar una invitacion (`InvitationDto`). */
export function parseInvitation(value: unknown): Invitation | null {
  if (!isRecord(value)) return null;
  const person = parsePerson(value['person']);
  const invitation = value['invitation'];
  if (person === null || !isRecord(invitation)) return null;
  const code = invitation['code'];
  const expiresAt = readDate(invitation['expiresAt']);
  if (typeof code !== 'string' || code === '' || expiresAt === null) return null;
  return { person, code, expiresAt };
}

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  owner: 'Dueño',
  admin: 'Administrador',
  cashier: 'Cajero',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/**
 * Los roles que `role` puede dar al invitar (ADR 0017): un dueño invita administradores y cajeros; un administrador, solo
 * cajeros; un cajero, a nadie. Es cortesia: el servidor lo vuelve a comprobar.
 */
export function invitableRoles(role: Role): readonly ('admin' | 'cashier')[] {
  if (can(role, 'user:manage-admins')) return ['admin', 'cashier'];
  if (can(role, 'user:manage-cashiers')) return ['cashier'];
  return [];
}

/** Los dueños que siguen activos: el negocio nunca se queda sin uno (ADR 0023). */
export function activeOwners(people: readonly Person[]): Person[] {
  return people.filter((person) => person.role === 'owner' && person.status === 'active');
}
