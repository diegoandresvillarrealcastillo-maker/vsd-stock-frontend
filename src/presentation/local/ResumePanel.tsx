import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CounterLockedError, NoWorkspaceError } from '../../domain/model/local-errors';
import { COUNTER_RESUME_WINDOW_MS, type CounterAccess } from '../../domain/model/local-profile';
import { formatMoment } from '../../domain/model/moment';
import { roleLabel } from '../../domain/model/people';
import type { Resumption } from '../../domain/ports/in/local-workspace';
import { Button } from '../components/Button';
import { FormAlert } from '../components/FormAlert';
import { useConnection } from '../connection/ConnectionProvider';
import { useLocal } from './LocalWorkspaceProvider';

const HOUR_MS = 60 * 60 * 1000;

/** Por que el mostrador no se puede reanudar, en una frase que dice tambien que se conserva lo guardado. */
const LOCKED_REASON: Record<Extract<CounterAccess, { state: 'locked' }>['reason'], string> = {
  expired:
    'Pasaron más de 72 horas desde la última vez que el servidor confirmó quién eres. Conéctate y entra con tu contraseña.',
  'clock-behind':
    'La hora de este equipo está atrasada respecto a la última vez que el servidor confirmó quién eres. Conéctate y entra con tu contraseña.',
  unreadable:
    'No pudimos leer cuándo fue la última vez que el servidor confirmó quién eres. Conéctate y entra con tu contraseña.',
};

const KEPT = 'Lo que tienes guardado en este equipo se conserva.';

/** «unas 5 horas» o «menos de una hora». */
function timeLeft(remainingMs: number): string {
  const hours = Math.floor(remainingMs / HOUR_MS);
  if (hours < 1) return 'menos de una hora';
  return hours === 1 ? '1 hora' : `${String(hours)} horas`;
}

/**
 * Lo que la pantalla de entrar ofrece a quien ya trabajo en este equipo (ADR 0022, puntos 10 y 11): su nombre, para entrar con la
 * persona ya elegida, y, si pasaron menos de 72 horas desde que el servidor la confirmo, seguir en el mostrador SIN conexion.
 * Pasado ese plazo el mostrador se bloquea, pero lo guardado se conserva hasta que vuelva a entrar con su contrasena.
 *
 * Seguir sin conexion solo se ofrece mientras la conexion NO este confirmada (ADR 0038): con el servidor respondiendo, el camino es la
 * contrasena, y el otro dejaria a la persona en un mostrador sin sesion. Mientras solo se comprueba SI se ofrece: con la API dormida
 * la persona no espera un minuto para poder vender con lo guardado.
 */
export function ResumePanel({ last }: { last: Resumption | null }) {
  const { workspace } = useLocal();
  const { state: connection } = useConnection();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  if (last === null || last.state === 'none') return null;
  const { profile, access } = last;

  async function resume() {
    setProblem(null);
    try {
      await workspace.resume();
    } catch (error) {
      if (error instanceof CounterLockedError) {
        setProblem(LOCKED_REASON[error.reason]);
        return;
      }
      if (error instanceof NoWorkspaceError) {
        setProblem('No encontramos lo que tenías guardado en este equipo.');
        return;
      }
      // Cualquier otra causa: no se va al mostrador como si se hubiera abierto.
      setProblem('No pudimos abrir lo que tenías guardado en este equipo. Inténtalo de nuevo.');
      return;
    }
    void navigate('/mostrador');
  }

  const until =
    access.state === 'open'
      ? formatMoment(new Date(new Date(profile.verifiedAt).getTime() + COUNTER_RESUME_WINDOW_MS))
      : null;

  return (
    <section
      aria-labelledby="ultimo-equipo"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="ultimo-equipo" className="text-lg font-semibold text-fg">
          Último en este equipo
        </h2>
        <p className="text-base text-fg">
          {profile.fullName} · {roleLabel(profile.role)}
        </p>
        <p className="text-sm text-fg-muted">{profile.businessName}</p>
      </div>
      {problem !== null && <FormAlert title="No pudimos abrir el mostrador">{problem}</FormAlert>}
      {access.state !== 'open' ? (
        <p className="text-sm text-fg-muted">
          {LOCKED_REASON[access.reason]} {KEPT}
        </p>
      ) : connection.status === 'online' ? (
        <p className="text-sm text-fg-muted">Entra con tu contraseña. {KEPT}</p>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            Si no tienes conexión, puedes seguir en el mostrador {timeLeft(access.remainingMs)} más
            (hasta el {until}). Lo que vendas se enviará cuando vuelvas a entrar con conexión.
          </p>
          <Button onClick={() => void resume()}>Continuar sin conexión</Button>
        </>
      )}
    </section>
  );
}
