import { useState } from 'react';
import { NoWorkspaceError } from '../../domain/model/local-errors';
import { useAccount } from '../auth/AuthProvider';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useLocal } from './LocalWorkspaceProvider';

const BUTTON =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-full border border-border bg-surface-raised px-4 text-base font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** «1 registro» o «3 registros», con el verbo que le toca. */
function pendingPhrase(count: number): { title: string; verb: string } {
  return count === 1
    ? { title: 'Tienes 1 registro sin enviar', verb: 'se pierde' }
    : { title: `Tienes ${String(count)} registros sin enviar`, verb: 'se pierden' };
}

/**
 * Las dos formas de dejar el equipo (ADR 0018):
 * - «Cambiar de persona» cierra la sesion y CONSERVA todo lo guardado de quien se va: sus ventas sin enviar siguen ahi y las
 *   enviara cuando vuelva a entrar.
 * - «Cerrar sesion» es olvidar: borra la base de la persona en un paso. Si hay operaciones sin enviar, antes dice cuantas son y
 *   pide confirmacion, porque confirmar las pierde.
 */
export function SessionControls() {
  const { signOut } = useAccount();
  const { workspace } = useLocal();
  const [pending, setPending] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Que fallo, para decirlo: contar lo que espera, o borrar lo guardado. Nunca se sale a medias.
  const [problem, setProblem] = useState<'count' | 'forget' | null>(null);

  async function forgetAndLeave() {
    setBusy(true);
    try {
      await workspace.forget();
    } catch {
      // Otra pestaña no suelta la base: no se sale a medias, porque la persona creeria que ya no queda nada en el equipo.
      setBusy(false);
      setPending(null);
      setProblem('forget');
      return;
    }
    await signOut();
  }

  async function closeSession() {
    setProblem(null);
    let waiting = 0;
    try {
      waiting = await workspace.pendingCount();
    } catch (error) {
      // Sin nadie trabajando no hay nada que contar ni que perder. Si no se pudo contar por otra causa, no se sabe que se
      // pierde: no se borra nada ni se sale.
      if (!(error instanceof NoWorkspaceError)) {
        setProblem('count');
        return;
      }
    }
    if (waiting > 0) {
      setPending(waiting);
      return;
    }
    await forgetAndLeave();
  }

  const phrase = pending === null ? null : pendingPhrase(pending);

  return (
    <>
      <button type="button" onClick={() => void signOut()} className={BUTTON}>
        Cambiar de persona
      </button>
      <button type="button" onClick={() => void closeSession()} className={BUTTON}>
        Cerrar sesión
      </button>
      {problem !== null && (
        <p role="alert" className="basis-full text-sm font-medium text-on-band">
          {problem === 'forget'
            ? 'No pudimos borrar lo guardado en este equipo. Cierra las otras pestañas de VSD Stock e inténtalo de nuevo.'
            : 'No pudimos revisar si tienes registros sin enviar, así que no cerramos tu sesión. Inténtalo de nuevo.'}
        </p>
      )}
      {phrase !== null && (
        <ConfirmDialog
          title={phrase.title}
          cancelLabel="Cancelar"
          confirmLabel="Cerrar sesión y perderlos"
          busy={busy}
          onCancel={() => {
            setPending(null);
          }}
          onConfirm={() => void forgetAndLeave()}
        >
          <p>
            Son ventas, turnos o movimientos de caja hechos en este equipo que todavía no llegaron
            al servidor. Si cierras sesión {phrase.verb}.
          </p>
          <p>
            Para conservarlos, conéctate y espera a que se envíen, o usa «Cambiar de persona»: eso
            los guarda para cuando vuelvas a entrar.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
