import type { ThemePreference } from '../domain/ports/in/theme-preference';
import { MotionProvider } from './motion/MotionProvider';
import { HomePage } from './pages/HomePage';
import { ThemeProvider } from './theme/ThemeProvider';

/**
 * Raiz de la interfaz. Aqui se montaran las rutas cuando haya mas de una
 * pantalla. La preferencia de tema llega ya cableada desde `infrastructure/`:
 * la interfaz no sabe donde se guarda ni como se aplica.
 */
export function App({ theme }: { theme: ThemePreference }) {
  return (
    <ThemeProvider preference={theme}>
      <MotionProvider>
        <HomePage />
      </MotionProvider>
    </ThemeProvider>
  );
}
