import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../domain/model/api-error';
import { problemOf, type FormProblem } from '../../domain/model/messages';
import { useOptionalAccount } from '../auth/AuthProvider';

export interface Submission {
  /** `true` mientras una accion esta en camino: el boton se desactiva y no se manda dos veces. */
  readonly pending: boolean;
  /** Lo que salio mal con la ultima accion, dicho para la persona; `null` si salio bien o todavia no se hizo. */
  readonly problem: FormProblem | null;
  /** Corre la accion. Devuelve `true` si salio bien. Si ya hay una en camino, no hace nada y devuelve `false`. */
  submit: (action: () => Promise<void>) => Promise<boolean>;
  /** Olvida el problema (al cambiar lo que se escribe, por ejemplo). */
  clear: () => void;
}

/**
 * El envio de un formulario: una accion a la vez, con su estado de «enviando» y el problema de la ultima vez ya convertido en
 * frases. No toca la pantalla si ya se dejo cuando llega la respuesta.
 */
export function useSubmit(): Submission {
  const account = useOptionalAccount();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      if (running.current) return false;
      running.current = true;
      setPending(true);
      setProblem(null);
      try {
        await action();
        return true;
      } catch (error) {
        // Si la API dice que la sesion ya no vale, se cierra: la persona vuelve a entrar en vez de reintentar para siempre.
        if (error instanceof ApiError && error.failure.class === 'session') void account?.signOut();
        if (mounted.current) setProblem(problemOf(error));
        return false;
      } finally {
        running.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [account],
  );

  const clear = useCallback(() => setProblem(null), []);

  return { pending, problem, submit, clear };
}
