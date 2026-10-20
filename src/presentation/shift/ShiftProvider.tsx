import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { ShiftState, Shifts } from '../../domain/ports/in/shifts';

// Adapta el turno de caja (un caso de uso sin React) a lo que pide useSyncExternalStore, igual que el envio y la copia. Son
// propiedades con funcion y no metodos: se pasan sueltas y no deben depender de `this`.
interface ShiftStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => ShiftState;
  open: (openingAmount: number) => Promise<void>;
  close: (countedAmount: number) => Promise<void>;
  refresh: () => void;
}

const ShiftContext = createContext<ShiftStore | null>(null);

/**
 * Entrega el turno de caja a toda la interfaz y lo pone en marcha mientras esta montado. El turno llega ya cableado desde
 * `infrastructure/main.tsx`. Arrancar y detener es idempotente: en desarrollo React monta dos veces y la segunda deja una sola
 * vigilancia.
 */
export function ShiftProvider({ shifts, children }: { shifts: Shifts; children: ReactNode }) {
  const store = useMemo<ShiftStore>(
    () => ({
      subscribe: (onChange) => shifts.subscribe(() => onChange()),
      getSnapshot: () => shifts.current(),
      open: (openingAmount) => shifts.open(openingAmount),
      close: (countedAmount) => shifts.close(countedAmount),
      refresh: () => {
        void shifts.refresh();
      },
    }),
    [shifts],
  );

  useEffect(() => {
    shifts.start();
    return () => {
      shifts.stop();
    };
  }, [shifts]);

  return <ShiftContext value={store}>{children}</ShiftContext>;
}

/** El turno de caja: lo que se sabe de el y las acciones de abrirlo y cerrarlo. Lo que se dice sale de lo guardado en este equipo. */
export function useShift(): {
  state: ShiftState;
  open: ShiftStore['open'];
  close: ShiftStore['close'];
  refresh: () => void;
} {
  const store = useContext(ShiftContext);
  if (store === null) {
    throw new Error('useShift debe usarse dentro de <ShiftProvider>');
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, open: store.open, close: store.close, refresh: store.refresh };
}
