import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { MascotsPreference } from '../../domain/ports/in/mascots-preference';

// Adapta la preferencia de mascotas (un caso de uso sin React) a lo que pide useSyncExternalStore: asi la interfaz se vuelve a
// dibujar cuando se apagan o se encienden, las cambie el boton o cualquier otro lugar. Son propiedades con funcion y no
// metodos: se pasan sueltas a useSyncExternalStore y no deben depender de `this`.
interface MascotasStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
  toggle: () => void;
}

const MascotasContext = createContext<MascotasStore | null>(null);

/** Entrega la preferencia de mascotas a toda la interfaz. La da `infrastructure/main.tsx`. */
export function MascotasProvider({
  preference,
  children,
}: {
  preference: MascotsPreference;
  children: ReactNode;
}) {
  const store = useMemo<MascotasStore>(
    () => ({
      subscribe: (onChange) => preference.subscribe(() => onChange()),
      getSnapshot: () => preference.enabled(),
      toggle: () => {
        preference.toggle();
      },
    }),
    [preference],
  );
  return <MascotasContext value={store}>{children}</MascotasContext>;
}

/** Si las mascotas se ven y la forma de apagarlas o encenderlas. Solo funciona dentro de `MascotasProvider`. */
export function useMascotas(): { activas: boolean; alternar: () => void } {
  const store = useContext(MascotasContext);
  if (store === null) {
    throw new Error('useMascotas debe usarse dentro de <MascotasProvider>');
  }
  const activas = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { activas, alternar: store.toggle };
}
