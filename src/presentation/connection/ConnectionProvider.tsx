import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ConnectionState } from '../../domain/model/connection';
import type { ConnectionMonitor } from '../../domain/ports/in/connection-monitor';

// Adapta la vigilancia de conexion (un caso de uso sin React) a lo que pide
// useSyncExternalStore: asi la interfaz se vuelve a dibujar cada vez que cambia
// el estado. Son propiedades con funcion y no metodos: se pasan sueltas a
// useSyncExternalStore y no deben depender de `this`.
interface ConnectionStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => ConnectionState;
  retry: () => void;
}

const ConnectionContext = createContext<ConnectionStore | null>(null);

/**
 * Entrega la vigilancia de conexion a toda la interfaz y la pone en marcha
 * mientras esta montada. La vigilancia llega ya cableada desde
 * `infrastructure/main.tsx`.
 */
export function ConnectionProvider({
  monitor,
  children,
}: {
  monitor: ConnectionMonitor;
  children: ReactNode;
}) {
  const store = useMemo<ConnectionStore>(
    () => ({
      subscribe: (onChange) => monitor.subscribe(() => onChange()),
      getSnapshot: () => monitor.current(),
      retry: () => {
        void monitor.retry();
      },
    }),
    [monitor],
  );

  // Arrancar y detener es idempotente: en desarrollo React monta dos veces y
  // la segunda deja una sola vigilancia activa.
  useEffect(() => {
    monitor.start();
    return () => {
      monitor.stop();
    };
  }, [monitor]);

  return <ConnectionContext value={store}>{children}</ConnectionContext>;
}

/** El estado de la conexion y la forma de pedir otra comprobacion. Solo funciona dentro de `ConnectionProvider`. */
export function useConnection(): { state: ConnectionState; retry: () => void } {
  const store = useContext(ConnectionContext);
  if (store === null) {
    throw new Error('useConnection debe usarse dentro de <ConnectionProvider>');
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, retry: store.retry };
}
