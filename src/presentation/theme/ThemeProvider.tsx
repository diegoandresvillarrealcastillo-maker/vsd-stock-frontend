import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { ThemeMode } from '../../domain/model/theme';
import type { ThemePreference } from '../../domain/ports/in/theme-preference';

// Adapta la preferencia de tema (un caso de uso sin React) a lo que pide
// useSyncExternalStore: asi la interfaz se vuelve a dibujar cuando el tema
// cambia, venga el cambio del boton o de cualquier otro lugar.
// Son propiedades con funcion y no metodos: se pasan sueltas a
// useSyncExternalStore y no deben depender de `this`.
interface ThemeStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => ThemeMode;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeStore | null>(null);

/** Entrega la preferencia de tema a toda la interfaz. La da `infrastructure/main.tsx`. */
export function ThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: ReactNode;
}) {
  const store = useMemo<ThemeStore>(
    () => ({
      subscribe: (onChange) => preference.subscribe(() => onChange()),
      getSnapshot: () => preference.current(),
      toggle: () => {
        preference.toggle();
      },
    }),
    [preference],
  );
  return <ThemeContext value={store}>{children}</ThemeContext>;
}

/** El tema actual y la forma de cambiarlo. Solo funciona dentro de `ThemeProvider`. */
export function useTheme(): { mode: ThemeMode; toggle: () => void } {
  const store = useContext(ThemeContext);
  if (store === null) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  const mode = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { mode, toggle: store.toggle };
}
