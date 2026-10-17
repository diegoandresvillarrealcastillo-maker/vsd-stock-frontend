import type { ReactNode } from 'react';
import { can, type Action } from '../../domain/model/permissions';
import { useAccount } from '../auth/AuthProvider';
import { ForbiddenPage } from '../pages/ForbiddenPage';

/**
 * Deja ver una pantalla solo a quien tiene el permiso (la misma tabla que aplica el servidor, ADR 0017). Es cortesia: quien
 * escribe la direccion a mano ve que no tiene acceso en vez de una pantalla que fallaria al pedir datos.
 */
export function RequireAction({ action, children }: { action: Action; children: ReactNode }) {
  const { state } = useAccount();
  if (state.status !== 'ready' || state.me.membership === null) return null;
  return can(state.me.membership.role, action) ? <>{children}</> : <ForbiddenPage />;
}
