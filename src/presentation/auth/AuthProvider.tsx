import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ApiError, type ApiFailure } from '../../domain/model/api-error';
import type { Me, Membership } from '../../domain/model/me';
import type { LoadMe } from '../../domain/ports/in/load-me';
import type { SessionManager } from '../../domain/ports/in/session-manager';

/**
 * Donde esta la cuenta de la persona:
 * - `signed-out`: no hay sesion.
 * - `loading`: hay sesion y se pregunta quien es y donde trabaja.
 * - `ready`: ya se sabe. `me.membership` es `null` si todavia no tiene negocio.
 * - `failed`: hay sesion pero no se pudo preguntar (sin red, servidor caido). La sesion se conserva: se puede reintentar.
 */
export type AccountState =
  | { readonly status: 'signed-out' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly me: Me }
  | { readonly status: 'failed'; readonly failure: ApiFailure };

export interface Account {
  readonly state: AccountState;
  /** Entra. Lanza `AuthError`. */
  readonly signIn: (email: string, password: string) => Promise<void>;
  /** Registra. `confirmEmail` es `true` si el servicio pide confirmar el correo antes de dejar entrar. Lanza `AuthError`. */
  readonly signUp: (email: string, password: string) => Promise<{ confirmEmail: boolean }>;
  readonly signOut: () => Promise<void>;
  /** Vuelve a preguntar quien es la persona (tras un fallo, o tras crear un negocio o canjear una invitacion). */
  readonly reload: () => void;
}

const AccountContext = createContext<Account | null>(null);

type Loaded =
  | { readonly key: string; readonly me: Me }
  | { readonly key: string; readonly failure: ApiFailure };

const UNEXPECTED: ApiFailure = {
  class: 'transient',
  status: null,
  problem: null,
  retryAfterMs: null,
};

/**
 * Entrega la cuenta de la persona a toda la interfaz. La sesion y la pregunta «quien soy» llegan ya cableadas desde
 * `infrastructure/`. Se vuelve a preguntar cuando cambia la PERSONA, no cuando solo se renueva su token.
 */
export function AuthProvider({
  sessions,
  loadMe,
  children,
}: {
  sessions: SessionManager;
  loadMe: LoadMe;
  children: ReactNode;
}) {
  const subscribe = useCallback((onChange: () => void) => sessions.subscribe(onChange), [sessions]);
  const session = useSyncExternalStore(subscribe, () => sessions.current());
  const userId = session?.user.id ?? null;

  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = userId === null ? null : `${userId}:${attempt}`;

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    loadMe.execute().then(
      (me) => {
        if (!cancelled) setLoaded({ key, me });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.failure.class === 'session') {
          // La API dice que la sesion ya no vale: se cierra y la persona vuelve a entrar.
          void sessions.signOut();
          return;
        }
        setLoaded({ key, failure: error instanceof ApiError ? error.failure : UNEXPECTED });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, loadMe, sessions]);

  const state = useMemo<AccountState>(
    () =>
      key === null
        ? { status: 'signed-out' }
        : loaded === null || loaded.key !== key
          ? { status: 'loading' }
          : 'me' in loaded
            ? { status: 'ready', me: loaded.me }
            : { status: 'failed', failure: loaded.failure },
    [key, loaded],
  );

  const account = useMemo<Account>(
    () => ({
      state,
      signIn: async (email, password) => {
        await sessions.signIn(email, password);
      },
      signUp: async (email, password) => {
        const created = await sessions.signUp(email, password);
        return { confirmEmail: created === null };
      },
      signOut: () => sessions.signOut(),
      reload: () => setAttempt((count) => count + 1),
    }),
    [state, sessions],
  );

  return <AccountContext value={account}>{children}</AccountContext>;
}

/** La cuenta de la persona, o `null` fuera de `AuthProvider` (para lo que sirve con y sin cuenta). */
export function useOptionalAccount(): Account | null {
  return useContext(AccountContext);
}

/** Donde trabaja la persona y con que rol, o `null` mientras se pregunta o si todavia no tiene negocio. */
export function useMembership(): Membership | null {
  const { state } = useAccount();
  return state.status === 'ready' ? state.me.membership : null;
}

/** La cuenta de la persona. Solo funciona dentro de `AuthProvider`. */
export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (account === null) {
    throw new Error('useAccount debe usarse dentro de <AuthProvider>');
  }
  return account;
}
