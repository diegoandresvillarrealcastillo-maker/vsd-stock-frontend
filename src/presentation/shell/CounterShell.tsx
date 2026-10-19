import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useOptionalAccount } from '../auth/AuthProvider';
import { ThemeToggle } from '../components/ThemeToggle';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { attentionLabel } from '../sales/attention-label';
import { useSales } from '../sales/SalesProvider';
import { SyncStatus } from '../sync/SyncStatus';

const LINK =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border bg-surface-raised px-3 text-sm font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const TAB =
  'inline-flex min-h-touch items-center whitespace-nowrap rounded-md px-4 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Lo que la persona hace en el mostrador. Todo funciona sin conexion: sale de lo guardado en este equipo. Vender, cobrar y el
 * comprobante son una sola cosa, la venta, y por eso las tres marcan «Mostrador».
 */
const COUNTER_MENU = [
  {
    path: '/mostrador',
    label: 'Mostrador',
    current: (path: string) =>
      path === '/mostrador' || path === '/mostrador/cobrar' || path === '/mostrador/comprobante',
  },
  {
    path: '/mostrador/turno',
    label: 'Turno',
    current: (path: string) => path === '/mostrador/turno' || path.startsWith('/mostrador/turno/'),
  },
  {
    path: '/mostrador/ventas',
    label: 'Ventas',
    current: (path: string) =>
      path === '/mostrador/ventas' || path.startsWith('/mostrador/ventas/'),
  },
  {
    path: '/mostrador/equipo',
    label: 'Equipo',
    current: (path: string) => path === '/mostrador/equipo',
  },
] as const;

/**
 * El marco del mostrador (ADR 0017): la cabecera con el negocio y la persona, el menu de lo que se hace en la caja, lo que el
 * dispositivo sabe del envio y la pantalla de cada ruta. Aparte de la administracion a proposito: lo que esta aqui sigue
 * funcionando sin conexion y no depende de que la cuenta este cargada. Se monta solo con un espacio de trabajo abierto.
 */
export function CounterShell() {
  const { active, workspace } = useLocal();
  const { attention } = useSales();
  const account = useOptionalAccount();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
      <header className="bg-band px-gutter py-2 text-on-band">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{profile.businessName}</p>
              <p className="truncate text-sm opacity-90">{profile.fullName}</p>
            </div>
            <ThemeToggle />
          </div>
          {/* Las dos acciones de quien trabaja sin conexion caben en una sola fila a 375 px: en la caja el alto es lo que mas falta. */}
          <div className="flex flex-wrap items-center gap-2">
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
          {COUNTER_MENU.map((item) => {
            const current = item.current(pathname);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  {...(current ? { 'aria-current': 'page' as const } : {})}
                  className={`${TAB} ${current ? 'bg-primary text-on-primary' : 'text-fg hover:bg-surface'}`}
                >
                  {item.label}
                  {/* Solo la gerencia lo sabe (`attention` es nulo para los demas); el numero se lee con el nombre: «Ventas 3». */}
                  {item.path === '/mostrador/ventas' &&
                    attention !== null &&
                    attention.count > 0 && (
                      <>
                        {' '}
                        <span className="ml-1 rounded-full bg-accent px-2 text-sm text-on-accent">
                          {attentionLabel(attention)}
                        </span>
                      </>
                    )}
                </Link>
              </li>
            );
          })}
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
