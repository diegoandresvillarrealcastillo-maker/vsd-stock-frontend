import type { ReactNode } from 'react';
import { useConnection } from '../connection/ConnectionProvider';
import { ThemeToggle } from './ThemeToggle';

/**
 * El marco de las pantallas de quien todavia no entro (ingresar, crear la cuenta, crear el negocio, canjear un codigo): la
 * banda con la marca y el boton de tema, y una columna angosta. Si el servidor no responde lo dice, porque nada de esto se
 * puede hacer sin el.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const { state } = useConnection();
  return (
    <div className="min-h-dvh bg-surface text-fg">
      <header className="rounded-b-xl bg-band px-gutter py-3 text-on-band">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <p className="text-xl font-semibold">VSD Stock</p>
          <ThemeToggle />
        </div>
      </header>
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto flex max-w-md flex-col gap-4 px-gutter py-6"
      >
        {state.status === 'offline' && (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3"
          >
            <p className="text-base font-medium text-accent-text">Sin conexión</p>
            <p className="text-sm text-fg-muted">
              No podemos hablar con el servidor. Cuando vuelva la conexión podrás continuar.
            </p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
