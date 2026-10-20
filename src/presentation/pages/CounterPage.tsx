import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { COUNTER_RESUME_WINDOW_MS } from '../../domain/model/local-profile';
import { formatMoment } from '../../domain/model/moment';
import { roleLabel } from '../../domain/model/people';
import { useOptionalAccount } from '../auth/AuthProvider';
import { CopyStatus } from '../copy/CopyStatus';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ThemeToggle } from '../components/ThemeToggle';
import { useLocal } from '../local/LocalWorkspaceProvider';

const LINK =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border bg-surface-raised px-4 text-base font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * El mostrador de la persona: su area de trabajo a pantalla completa, aparte de la administracion (ADR 0017: es lo que sigue
 * funcionando sin conexion). Hoy muestra el estado de este equipo: quien trabaja, con que rol, el codigo del dispositivo, hasta
 * cuando puede seguir sin conexion y cuantas cosas esperan a ser enviadas. La venta llega a esta pantalla en el siguiente paso.
 */
export function CounterPage() {
  const { active, workspace, device, registerDevice } = useLocal();
  const account = useOptionalAccount();
  const navigate = useNavigate();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void workspace.pendingCount().then(
      (count) => {
        if (!cancelled) setPending(count);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [workspace, active]);

  if (active === null) return null;
  const { profile, deviceCode, resumed } = active;
  const online = account?.state.status === 'ready';
  const until = formatMoment(
    new Date(new Date(profile.verifiedAt).getTime() + COUNTER_RESUME_WINDOW_MS),
  );

  async function changePerson() {
    await workspace.leave();
    void navigate('/ingresar');
  }

  return (
    <div className="min-h-dvh bg-surface text-fg">
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

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto flex max-w-3xl flex-col gap-6 px-gutter py-6"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-fg">Mostrador</h1>
          <p className="text-base text-fg-muted">
            {resumed
              ? `Estás trabajando sin conexión. Puedes seguir hasta el ${until}; después hay que entrar con la contraseña.`
              : 'Aquí vas a vender, abrir y cerrar la caja. Lo que hagas se guarda en este equipo, cifrado, y se envía cuando haya conexión.'}
          </p>
        </div>

        <section aria-labelledby="equipo-titulo" className="flex flex-col gap-3">
          <h2 id="equipo-titulo" className="text-xl font-semibold text-fg">
            Este equipo
          </h2>
          <dl className="grid grid-cols-1 gap-3 rounded-md border border-border bg-surface-raised p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-muted">Persona</dt>
              <dd className="flex flex-wrap items-center gap-2 text-base text-fg">
                {profile.fullName} <Badge>{roleLabel(profile.role)}</Badge>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-muted">Código del equipo</dt>
              <dd className="flex flex-wrap items-center gap-2 text-base text-fg">
                {deviceCode ?? 'Sin registrar'}
                {deviceCode === null && online && device !== 'registering' && (
                  <Button onClick={registerDevice}>Registrar</Button>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-muted">Última confirmación del servidor</dt>
              <dd className="text-base text-fg">{formatMoment(new Date(profile.verifiedAt))}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-fg-muted">Por enviar</dt>
              <dd className="text-base text-fg">
                {pending === null
                  ? '…'
                  : pending === 0
                    ? 'Nada'
                    : pending === 1
                      ? '1 registro'
                      : `${String(pending)} registros`}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="catalogo-titulo" className="flex flex-col gap-3">
          <h2 id="catalogo-titulo" className="text-xl font-semibold text-fg">
            Catálogo en este equipo
          </h2>
          <CopyStatus />
        </section>
      </main>
    </div>
  );
}
