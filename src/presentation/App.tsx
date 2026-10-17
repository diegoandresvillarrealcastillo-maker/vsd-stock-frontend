import type { ConnectionMonitor } from '../domain/ports/in/connection-monitor';
import type { ThemePreference } from '../domain/ports/in/theme-preference';
import { ConnectionProvider } from './connection/ConnectionProvider';
import { MotionProvider } from './motion/MotionProvider';
import { HomePage } from './pages/HomePage';
import { ThemeProvider } from './theme/ThemeProvider';

/**
 * Raiz de la interfaz. Aqui se montaran las rutas cuando haya mas de una
 * pantalla. La preferencia de tema y la vigilancia de conexion llegan ya
 * cableadas desde `infrastructure/`: la interfaz no sabe donde se guarda el tema
 * ni como se pregunta al servidor.
 */
export function App({
  theme,
  connection,
}: {
  theme: ThemePreference;
  connection: ConnectionMonitor;
}) {
  return (
    <ThemeProvider preference={theme}>
      <ConnectionProvider monitor={connection}>
        <MotionProvider>
          <HomePage />
        </MotionProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}
