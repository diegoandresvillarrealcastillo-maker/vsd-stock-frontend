import { NavLink, Outlet, useLocation } from 'react-router';
import { itemOfPath, navigationFor } from '../../domain/model/navigation';
import { useAccount } from '../auth/AuthProvider';
import { NeedsConnection } from '../components/NeedsConnection';
import { ThemeToggle } from '../components/ThemeToggle';
import { SessionControls } from '../local/SessionControls';
import { StorageNotice } from '../local/StorageNotice';
import { SyncStatus } from '../sync/SyncStatus';

const LINK =
  'inline-flex min-h-touch items-center whitespace-nowrap rounded-md px-4 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * El marco de la aplicacion para quien ya tiene negocio: la cabecera con el negocio y la persona, el menu con lo que SU rol
 * puede usar (la misma tabla que aplica el servidor, ADR 0017) y el contenido. Una pantalla que necesita al servidor
 * dice que lo necesita cuando no hay conexion, en vez de mostrarse vacia.
 */
export function AppShell() {
  const { state } = useAccount();
  const { pathname } = useLocation();

  if (state.status !== 'ready' || state.me.membership === null) {
    return <p role="status">Cargando tu cuenta…</p>;
  }
  const { role, businessName, fullName } = state.me.membership;
  const needsConnection = itemOfPath(pathname)?.requiresConnection ?? false;

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
      >
        Saltar al contenido
      </a>
      <header className="bg-band px-gutter py-3 text-on-band">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{businessName}</p>
            <p className="truncate text-sm opacity-90">{fullName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <SessionControls />
          </div>
        </div>
      </header>

      <nav aria-label="Principal" className="border-b border-border bg-surface-raised">
        <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-gutter py-2">
          {navigationFor(role).map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `${LINK} ${isActive ? 'bg-primary text-on-primary' : 'text-fg hover:bg-surface'}`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main id="contenido" tabIndex={-1} className="mx-auto max-w-5xl px-gutter py-6">
        <div className="mb-4 empty:hidden">
          <StorageNotice />
        </div>
        <div className="mb-4">
          <SyncStatus />
        </div>
        {needsConnection ? (
          <NeedsConnection>
            <Outlet />
          </NeedsConnection>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
