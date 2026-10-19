import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useOptionalAccount } from '../auth/AuthProvider';
import { ThemeToggle } from '../components/ThemeToggle';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { SyncStatus } from '../sync/SyncStatus';

const LINK =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border bg-surface-raised px-4 text-base font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const TAB =
  'inline-flex min-h-touch items-center whitespace-nowrap rounded-md px-4 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** Lo que la persona hace en el mostrador. Todo funciona sin conexion: sale de lo guardado en este equipo. */
const COUNTER_MENU = [
  { path: '/mostrador', label: 'Mostrador', end: true },
  { path: '/mostrador/turno', label: 'Turno', end: false },
] as const;

/**
 * El marco del mostrador (ADR 0017): la cabecera con el negocio y la persona, el menu de lo que se hace en la caja, lo que el
 * dispositivo sabe del envio y la pantalla de cada ruta. Aparte de la administracion a proposito: lo que esta aqui sigue
 * funcionando sin conexion y no depende de que la cuenta este cargada. Se monta solo con un espacio de trabajo abierto.
 */
export function CounterShell() {
  const { active, workspace } = useLocal();
  const account = useOptionalAccount();
  const navigate = useNavigate();

  if (active === null) return null;
  const { profile } = active;
  const online = account?.state.status === 'ready';

  async function changePerson() {
    await workspace.leave();
    void navigate('/ingresar');
  }

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-on-primary"
      >
        Saltar al contenido
      </a>
      <header className="bg-band px-gutter py-3 text-on-band">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{profile.businessName}</p>
            <p className="truncate text-sm opacity-90">{profile.fullName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {online ? (
              <Link to="/" className={LINK}>
                Administración
              </Link>
            ) : (
              <Link to="/ingresar" className={LINK}>
                Entrar con contraseña
              </Link>
            )}
            {!online && (
              <button type="button" onClick={() => void changePerson()} className={LINK}>
                Cambiar de persona
              </button>
            )}
          </div>
        </div>
      </header>

      <nav aria-label="Mostrador" className="border-b border-border bg-surface-raised">
        <ul className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-gutter py-2">
          {COUNTER_MENU.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `${TAB} ${isActive ? 'bg-primary text-on-primary' : 'text-fg hover:bg-surface'}`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-6"
      >
        <SyncStatus />
        <Outlet />
      </main>
    </div>
  );
}
