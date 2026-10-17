import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAccount } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';

/** Mientras se pregunta quien es la persona. El contenedor avisa a los lectores de pantalla; los bloques son decoracion. */
function LoadingAccount() {
  return (
    <div role="status" className="mx-auto flex max-w-md flex-col gap-3 px-gutter py-10">
      <p className="text-base text-fg-muted">Cargando tu cuenta…</p>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

/** La sesion existe pero no se pudo preguntar quien es (sin red, servidor caido): se conserva y se puede reintentar. */
function AccountFailed() {
  const { reload, signOut } = useAccount();
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-gutter py-10">
      <h1 className="text-xl font-semibold text-fg">No pudimos cargar tu cuenta</h1>
      <p className="text-base text-fg-muted">
        Revisa tu conexión e inténtalo de nuevo. Tu sesión sigue abierta.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reload}>Reintentar</Button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border border-border bg-surface-raised px-5 text-base font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/**
 * La puerta de la aplicacion: deja pasar a quien ya trabaja en un negocio. Sin sesion va a entrar; con sesion pero sin
 * negocio, a crear el suyo o canjear una invitacion.
 */
export function RequireMembership({ children }: { children: ReactNode }) {
  const { state } = useAccount();
  switch (state.status) {
    case 'signed-out':
      return <Navigate to="/ingresar" replace />;
    case 'loading':
      return <LoadingAccount />;
    case 'failed':
      return <AccountFailed />;
    case 'ready':
      return state.me.membership === null ? <Navigate to="/empezar" replace /> : <>{children}</>;
  }
}

/** La puerta de «crear tu negocio»: solo para quien ya entro y todavia no tiene negocio. */
export function RequireNoMembership({ children }: { children: ReactNode }) {
  const { state } = useAccount();
  switch (state.status) {
    case 'signed-out':
      return <Navigate to="/ingresar" replace />;
    case 'loading':
      return <LoadingAccount />;
    case 'failed':
      return <AccountFailed />;
    case 'ready':
      return state.me.membership === null ? <>{children}</> : <Navigate to="/" replace />;
  }
}

/** La puerta de entrar: solo para quien no tiene sesion. Quien ya la tiene sigue su camino segun tenga negocio o no. */
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const { state } = useAccount();
  switch (state.status) {
    case 'signed-out':
      return <>{children}</>;
    case 'loading':
      return <LoadingAccount />;
    case 'failed':
      return <AccountFailed />;
    case 'ready':
      return <Navigate to={state.me.membership === null ? '/empezar' : '/'} replace />;
  }
}
