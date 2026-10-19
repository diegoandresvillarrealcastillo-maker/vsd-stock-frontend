import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { BusinessPeopleUseCase } from '../application/usecases/business-people.usecase';
import { CatalogUseCase } from '../application/usecases/catalog.usecase';
import { InventoryUseCase } from '../application/usecases/inventory.usecase';
import { PurchasingUseCase } from '../application/usecases/purchasing.usecase';
import { App } from '../presentation/App';
import '../presentation/styles/index.css';
import { resolveApiBaseUrl } from './api-base-url';
import { resolveAuthConfig } from './auth-config';
import { createAuth } from './create-auth';
import { createConnectionMonitor } from './create-connection-monitor';
import { createLocalWorkspace } from './create-local-workspace';
import { createReadCopy } from './create-read-copy';
import { createShifts } from './create-shifts';
import { createSyncEngine } from './create-sync-engine';
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

// El espacio de trabajo local: una base cifrada por persona, el registro del dispositivo y la serie de folios (ADR 0018).
const local = createLocalWorkspace({
  api: auth.api,
  now: () => new Date(),
  getStorage: () => window.localStorage,
  fillRandom: (bytes) => window.crypto.getRandomValues(bytes),
});

// El motor de sincronizacion: envia la cola de quien trabaja cuando hay conexion, de a un lote y una pestaña a la vez (ADR 0009 y 0028).
const sync = createSyncEngine({
  api: auth.api,
  workspace: local,
  connection,
  locks: 'locks' in window.navigator ? window.navigator.locks : undefined,
  now: () => new Date(),
});

// La copia de lectura del catalogo y de la existencia: la baja cuando hay conexion y la busca sin esperar a nadie (ADR 0028).
const copy = createReadCopy({ api: auth.api, workspace: local, connection, sync });

// El turno de caja: se abre y se cierra sin conexion, y su operacion espera en la cola del envio (ADR 0026).
const shifts = createShifts({
  workspace: local,
  sync,
  now: () => new Date(),
  fillRandom: (bytes) => window.crypto.getRandomValues(bytes),
});

const people = new BusinessPeopleUseCase(auth.api);
const catalog = new CatalogUseCase(auth.api);
const inventory = new InventoryUseCase(auth.api);
const purchasing = new PurchasingUseCase(auth.api);

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App
        theme={theme}
        connection={connection}
        auth={auth}
        local={local}
        sync={sync}
        copy={copy}
        shifts={shifts}
        people={people}
        catalog={catalog}
        inventory={inventory}
        purchasing={purchasing}
      />
    </BrowserRouter>
  </StrictMode>,
);
