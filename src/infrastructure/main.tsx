import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../presentation/App';
import '../presentation/styles/index.css';
import { createThemePreference } from './create-theme-preference';

// Punto de arranque: cablea los adaptadores del navegador, arma los casos de
// uso y monta la interfaz en el documento (ADR 0002).
const container = document.getElementById('root');
if (container === null) {
  throw new Error('No se encontro el elemento #root en index.html');
}

const theme = createThemePreference({
  getStorage: () => window.localStorage,
  matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
  root: document.documentElement,
});

createRoot(container).render(
  <StrictMode>
    <App theme={theme} />
  </StrictMode>,
);
