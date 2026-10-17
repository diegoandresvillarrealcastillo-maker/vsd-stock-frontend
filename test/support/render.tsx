import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import type { ConnectionMonitor } from '../../src/domain/ports/in/connection-monitor';
import type { ThemePreference } from '../../src/domain/ports/in/theme-preference';
import { ConnectionProvider } from '../../src/presentation/connection/ConnectionProvider';
import { MotionProvider } from '../../src/presentation/motion/MotionProvider';
import { ThemeProvider } from '../../src/presentation/theme/ThemeProvider';
import { createTestConnection } from './connection';
import { createTestThemePreference } from './theme';

/** Monta un componente dentro del mismo proveedor de movimiento que usa la aplicacion. */
export function renderWithMotion(ui: ReactElement) {
  return render(ui, { wrapper: MotionProvider });
}

interface ProvidersOptions {
  /** La preferencia de tema. Por omision, una nueva (tema claro). */
  theme?: ThemePreference;
  /** La vigilancia de conexion. Por omision, una nueva que nunca recibe respuesta. */
  connection?: ConnectionMonitor;
}

/**
 * Monta un componente con todos los proveedores de la aplicacion: el de tema, el
 * de conexion y el de movimiento.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    theme = createTestThemePreference().preference,
    connection = createTestConnection().monitor,
  }: ProvidersOptions = {},
) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider preference={theme}>
        <ConnectionProvider monitor={connection}>
          <MotionProvider>{children}</MotionProvider>
        </ConnectionProvider>
      </ThemeProvider>
    );
  }
  return render(ui, { wrapper: Providers });
}
