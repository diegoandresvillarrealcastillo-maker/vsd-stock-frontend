import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/ibm-plex-mono/500.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './estilos.css';
import { Sitio } from './Sitio';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('No se encontro el elemento #root en sitio/index.html');
}

const page = (
  <StrictMode>
    <Sitio />
  </StrictMode>
);

// La pagina llega prerenderizada y React se monta encima de ella. Con `npm run dev:sitio` el documento llega vacio y se crea desde cero.
if (container.hasChildNodes()) {
  hydrateRoot(container, page);
} else {
  createRoot(container).render(page);
}
