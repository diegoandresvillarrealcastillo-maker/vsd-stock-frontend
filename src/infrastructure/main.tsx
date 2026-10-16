import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../presentation/App';

// Punto de arranque: monta la interfaz en el documento. Con el tiempo, aqui
// tambien se cablearan los adaptadores y los casos de uso (ADR 0002).
const container = document.getElementById('root');
if (container === null) {
  throw new Error('No se encontro el elemento #root en index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
