import type { ReactNode } from 'react';
import { useConnection } from '../connection/ConnectionProvider';
import { Button } from './Button';
import { CloudOffIcon } from './icons';

/**
 * Pone la pantalla solo si se puede hablar con el servidor (ADR 0017). Hasta que el dispositivo tenga su propia copia de los
 * datos, una pantalla que lista o cambia algo sin conexion estaria vacia o desactualizada: se dice con claridad en vez de
 * mostrarla. Mientras todavia se comprueba (al abrir) se muestra la pantalla, para no asustar con un aviso que dura un
 * instante.
 */
export function NeedsConnection({ children }: { children: ReactNode }) {
  const { state, retry } = useConnection();
  if (state.status !== 'offline') return <>{children}</>;

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4 rounded-lg border border-border/45 bg-surface-raised p-4 shadow-sm"
    >
      <div className="flex items-center gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-accent-text bg-surface text-accent-text">
          <CloudOffIcon />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="text-lg font-semibold leading-7 text-fg">Esta pantalla necesita conexión</p>
          <p className="text-sm text-fg-muted">
            Para verla y cambiarla hace falta hablar con el servidor. Aparecerá aquí en cuanto
            vuelva la conexión.
          </p>
        </div>
      </div>
      <Button onClick={retry}>Reintentar</Button>
    </div>
  );
}
