import { can, type Action, type Role } from './permissions';

/** Una entrada del menu. */
export interface NavItem {
  readonly id: 'home' | 'catalog' | 'inventory' | 'purchases' | 'people';
  readonly path: string;
  readonly label: string;
  /** La accion de la tabla de permisos (ADR 0017) que da derecho a ver esta pantalla. */
  readonly action: Action;
  /**
   * Si la pantalla necesita hablar con el servidor. Hasta que el dispositivo tenga su propia copia de los datos (Ciclo 3),
   * toda pantalla que lista o cambia algo la necesita: sin conexion se dice, no se muestra vacia.
   */
  readonly requiresConnection: boolean;
}

/**
 * Las pantallas de la aplicacion y quien las ve. El menu NO decide la seguridad: el servidor aplica la misma tabla en cada
 * peticion. Esto solo evita ofrecer lo que la persona no puede hacer.
 */
export const NAVIGATION: readonly NavItem[] = [
  { id: 'home', path: '/', label: 'Inicio', action: 'product:view', requiresConnection: false },
  {
    id: 'catalog',
    path: '/catalogo',
    label: 'Catálogo',
    action: 'product:view',
    requiresConnection: true,
  },
  {
    id: 'inventory',
    path: '/inventario',
    label: 'Inventario',
    action: 'stock:view',
    requiresConnection: true,
  },
  {
    id: 'purchases',
    path: '/compras',
    label: 'Compras',
    action: 'purchase:create',
    requiresConnection: true,
  },
  {
    id: 'people',
    path: '/personas',
    label: 'Personas',
    action: 'user:manage-cashiers',
    requiresConnection: true,
  },
];

/** Lo que el menu ofrece a un rol, en el orden de la lista. */
export function navigationFor(role: Role): readonly NavItem[] {
  return NAVIGATION.filter((item) => can(role, item.action));
}

/** La entrada a la que pertenece una ruta: la ruta misma o una mas honda (`/catalogo/abc`). */
export function itemOfPath(path: string): NavItem | undefined {
  return NAVIGATION.find((item) =>
    item.path === '/' ? path === '/' : path === item.path || path.startsWith(`${item.path}/`),
  );
}
