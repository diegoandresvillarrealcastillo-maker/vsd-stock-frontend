import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { ThemePreference } from '../../src/domain/ports/in/theme-preference';
import { MotionProvider } from '../../src/presentation/motion/MotionProvider';
import { ThemeProvider } from '../../src/presentation/theme/ThemeProvider';
import { createTestThemePreference } from './theme';

/** Monta un componente dentro del mismo proveedor de movimiento que usa la aplicacion. */
export function renderWithMotion(ui: ReactElement) {
  return render(ui, { wrapper: MotionProvider });
}

/**
 * Monta un componente con todos los proveedores de la aplicacion: el de tema y
 * el de movimiento. Si no se da una preferencia de tema, usa una nueva (tema claro).
 */
export function renderWithProviders(
  ui: ReactElement,
  { theme = createTestThemePreference().preference }: { theme?: ThemePreference } = {},
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider preference={theme}>
        <MotionProvider>{children}</MotionProvider>
      </ThemeProvider>
    );
  }
  return render(ui, { wrapper: Providers });
}
