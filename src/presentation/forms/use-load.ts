import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { ApiError } from '../../domain/model/api-error';
import { problemOf, type FormProblem } from '../../domain/model/messages';
import { useOptionalAccount } from '../auth/AuthProvider';

export type Loaded<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly problem: FormProblem }
  | { readonly status: 'ready'; readonly data: T };

type Settled<T> =
  | { readonly key: string; readonly problem: FormProblem }
  | { readonly key: string; readonly data: T };

/**
 * Pide algo al cargar una pantalla y cada vez que cambia lo que se pide (`deps`, que deben ser textos, numeros o
 * booleanos): carga, falla con una frase o esta listo. Una respuesta tardia de algo que ya no se pide no se muestra, y si la
 * API dice que la sesion ya no vale se cierra (la persona vuelve a entrar en vez de quedarse con una pantalla que no puede
 * cargar).
 */
export function useLoad<T>(
  load: () => Promise<T>,
  deps: readonly (string | number | boolean | null | undefined)[],
): { state: Loaded<T>; reload: () => void } {
  const account = useOptionalAccount();
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  // La llave dice QUE se pidio: lo que llega con otra llave es de otra pregunta y se descarta.
  const key = `${attempt}:${JSON.stringify(deps)}`;

  const run = useEffectEvent(load);
  const endSession = useEffectEvent(() => {
    void account?.signOut();
  });

  useEffect(() => {
    let cancelled = false;
    run().then(
      (data) => {
        if (!cancelled) setSettled({ key, data });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.failure.class === 'session') endSession();
        setSettled({ key, problem: problemOf(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);
  const state: Loaded<T> =
    settled === null || settled.key !== key
      ? { status: 'loading' }
      : 'data' in settled
        ? { status: 'ready', data: settled.data }
        : { status: 'failed', problem: settled.problem };
  return { state, reload };
}
