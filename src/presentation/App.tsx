import { MotionProvider } from './motion/MotionProvider';
import { HomePage } from './pages/HomePage';

/** Raiz de la interfaz. Aqui se montaran las rutas cuando haya mas de una pantalla. */
export function App() {
  return (
    <MotionProvider>
      <HomePage />
    </MotionProvider>
  );
}
