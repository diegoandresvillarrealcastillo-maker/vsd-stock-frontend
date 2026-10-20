import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { AppUpdateState } from '../../domain/model/app-update';
import type { StorageProtection } from '../../domain/model/storage-protection';
import type { AppUpdates } from '../../domain/ports/in/app-updates';
import type { StorageProtectionStatus } from '../../domain/ports/in/storage-protection';

interface PwaStore {
  updates: AppUpdates;
  storage: StorageProtectionStatus;
}

const PwaContext = createContext<PwaStore | null>(null);

/**
 * Entrega a la interfaz las versiones nuevas de la aplicacion y la proteccion del almacenamiento (C3-07), y los pone en
 * marcha mientras esta montada: instala el service worker, busca versiones nuevas y le pide al navegador que no borre lo
 * guardado. Ambos llegan ya cableados desde `infrastructure/main.tsx`.
 */
export function PwaProvider({
  updates,
  storage,
  children,
}: {
  updates: AppUpdates;
  storage: StorageProtectionStatus;
  children: ReactNode;
}) {
  const store = useMemo<PwaStore>(() => ({ updates, storage }), [updates, storage]);

  // Arrancar y detener es idempotente: en desarrollo React monta dos veces y la segunda deja una sola vigilancia.
  useEffect(() => {
    updates.start();
    void storage.ensure();
    return () => {
      updates.stop();
    };
  }, [updates, storage]);

  return <PwaContext value={store}>{children}</PwaContext>;
}

const NO_UPDATES: AppUpdateState = { status: 'unsupported', held: false };
const noopUnsubscribe = () => () => undefined;

/** El estado de la version nueva y como decidir usarla. Fuera de `PwaProvider` dice que no hay nada que actualizar. */
export function useAppUpdate(): { state: AppUpdateState; apply: () => void } {
  const store = useContext(PwaContext);
  const state = useSyncExternalStore(
    store === null ? noopUnsubscribe : (onChange) => store.updates.subscribe(() => onChange()),
    () => store?.updates.current() ?? NO_UPDATES,
  );
  return {
    state,
    apply: () => {
      store?.updates.apply();
    },
  };
}

/**
 * Si lo guardado en el dispositivo esta protegido del borrado automatico. Fuera de `PwaProvider` es `unknown`: no se sabe
 * y la pantalla no dice nada (las pruebas de pantallas que no hablan de esto no necesitan el proveedor).
 */
export function useStorageProtection(): StorageProtection {
  const store = useContext(PwaContext);
  return useSyncExternalStore(
    store === null ? noopUnsubscribe : (onChange) => store.storage.subscribe(() => onChange()),
    () => store?.storage.current() ?? 'unknown',
  );
}

/**
 * Mientras `active` sea verdadero, la aplicacion no se actualiza: la pantalla de venta lo pide para que una version nueva
 * nunca recargue la pagina a mitad de una venta. Se suelta sola al dejar de pedirlo o al desmontarse.
 */
export function useHoldUpdates(active: boolean): void {
  const store = useContext(PwaContext);
  useEffect(() => {
    if (!active || store === null) return;
    return store.updates.hold();
  }, [active, store]);
}
