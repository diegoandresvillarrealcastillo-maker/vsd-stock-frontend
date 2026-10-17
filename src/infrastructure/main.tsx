import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from '../presentation/App';
import '../presentation/styles/index.css';
import { resolveApiBaseUrl } from './api-base-url';
import { resolveAuthConfig } from './auth-config';
import { createAuth } from './create-auth';
import { createConnectionMonitor } from './create-connection-monitor';
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

const apiBaseUrl = resolveApiBaseUrl(import.meta.env);
// Se llama a `window.fetch` como metodo de window: suelto lanzaria "Illegal invocation".
const fetchFromWindow = (input: string, init?: RequestInit) => window.fetch(input, init);

const connection = createConnectionMonitor({
  apiBaseUrl,
  fetch: fetchFromWindow,
  navigator: window.navigator,
  events: window,
});

const auth = createAuth({
  auth: resolveAuthConfig(import.meta.env),
  apiBaseUrl,
  fetch: fetchFromWindow,
  now: () => new Date(),
});

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App theme={theme} connection={connection} auth={auth} />
    </BrowserRouter>
  </StrictMode>,
);
