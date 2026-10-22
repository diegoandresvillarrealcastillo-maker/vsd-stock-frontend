import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { NewOperation } from '../../domain/model/outbox';
import type { SyncEngine, SyncState } from '../../domain/ports/in/sync-engine';

// Adapta el motor de sincronizacion (un caso de uso sin React) a lo que pide useSyncExternalStore, igual que la vigilancia de
// conexion. Son propiedades con funcion y no metodos: se pasan sueltas y no deben depender de `this`.
interface SyncStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => SyncState;
  syncNow: () => void;
  enqueue: (operation: NewOperation) => Promise<void>;
}

const SyncContext = createContext<SyncStore | null>(null);

/**
 * Entrega el motor de sincronizacion a toda la interfaz y lo pone en marcha mientras esta montada. El motor llega ya cableado
 * desde `infrastructure/main.tsx`. Arrancar y detener es idempotente: en desarrollo React monta dos veces y la segunda deja un
 * solo motor vigilando.
 */
export function SyncProvider({ engine, children }: { engine: SyncEngine; children: ReactNode }) {
  const store = useMemo<SyncStore>(
    () => ({
      subscribe: (onChange) => engine.subscribe(() => onChange()),
      getSnapshot: () => engine.current(),
      syncNow: () => {
        void engine.syncNow();
      },
      enqueue: (operation) => engine.enqueue(operation),
    }),
    [engine],
  );

  useEffect(() => {
    engine.start();
    return () => {
      engine.stop();
    };
  }, [engine]);

  return <SyncContext value={store}>{children}</SyncContext>;
}

/** Lo que el dispositivo sabe de su envio, y las dos cosas que se le piden: enviar ya y guardar una operacion para enviar. */
export function useSync(): {
  state: SyncState;
  syncNow: () => void;
  enqueue: (operation: NewOperation) => Promise<void>;
} {
  const store = useContext(SyncContext);
  if (store === null) {
    throw new Error('useSync debe usarse dentro de <SyncProvider>');
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, syncNow: store.syncNow, enqueue: store.enqueue };
}
