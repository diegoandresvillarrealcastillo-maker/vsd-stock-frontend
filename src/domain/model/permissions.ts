import table from '../../../contract/permissions.json';

/** Los tres papeles de una persona en un negocio (ADR 0017), de mayor a menor responsabilidad. */
export const ROLES = ['owner', 'admin', 'cashier'] as const;

export type Role = (typeof ROLES)[number];

type Entry = { readonly roles: readonly Role[]; readonly offline: boolean };

/**
 * Lo que cada rol puede hacer y si se puede hacer sin conexion. NO es una tabla propia: es la copia de
 * `contract/permissions.json`, que sale del dominio del backend y que el CI compara con el original
 * (`npm run contract:check`). El cliente decide que ofrecer con lo mismo que el servidor aplica; el servidor
 * lo vuelve a aplicar siempre, asi que esto es comodidad y no seguridad.
 */
export const ACTIONS = table.actions as { readonly [action: string]: Entry } as {
  readonly [K in keyof typeof table.actions]: Entry;
};

export type Action = keyof typeof ACTIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function isAction(value: unknown): value is Action {
  // hasOwn y no `in`: «toString» no es una accion.
  return typeof value === 'string' && Object.hasOwn(ACTIONS, value);
}

/** Si el rol puede hacer la accion. Todo lo que no se conoce se niega. */
export function can(role: Role, action: Action): boolean {
  if (!isAction(action)) return false;
  return ACTIONS[action].roles.includes(role);
}

/** Si la accion se puede hacer con el dispositivo sin conexion. Una accion desconocida no. */
export function isAvailableOffline(action: Action): boolean {
  return isAction(action) && ACTIONS[action].offline;
}

/** Las acciones que el rol puede hacer, en el orden de la tabla. */
export function actionsOf(role: Role): Action[] {
  return (Object.keys(ACTIONS) as Action[]).filter((action) => can(role, action));
}
