import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import type { BusinessPeople } from '../../src/domain/ports/in/business-people';
import type { Catalog } from '../../src/domain/ports/in/catalog';
import type { Inventory } from '../../src/domain/ports/in/inventory';
import type { Purchasing } from '../../src/domain/ports/in/purchasing';
import { AuthProvider } from '../../src/presentation/auth/AuthProvider';
import { LocalWorkspaceProvider } from '../../src/presentation/local/LocalWorkspaceProvider';
import { CatalogProvider } from '../../src/presentation/catalog/CatalogProvider';
import { InventoryProvider } from '../../src/presentation/inventory/InventoryProvider';
import { PurchasingProvider } from '../../src/presentation/purchasing/PurchasingProvider';
import { ReadCopyProvider } from '../../src/presentation/copy/ReadCopyProvider';
import { SyncProvider } from '../../src/presentation/sync/SyncProvider';
import { ConnectionProvider } from '../../src/presentation/connection/ConnectionProvider';
import { MotionProvider } from '../../src/presentation/motion/MotionProvider';
import { PeopleProvider } from '../../src/presentation/people/PeopleProvider';
import { ThemeProvider } from '../../src/presentation/theme/ThemeProvider';
import { createTestAuth, type TestAuth } from './auth';
import { createFakeCatalog } from './catalog';
import { createTestConnection } from './connection';
import { createTestLocal, type TestLocal } from './local';
import { createFakeInventory } from './inventory';
import { createFakePeople } from './people';
import { createFakePurchasing } from './purchasing';
import { FakeReadCopy } from './read-copy';
import { FakeSyncEngine } from './sync-engine';
import { createTestThemePreference } from './theme';

/** Donde esta la aplicacion ahora y con que estado de navegacion llego: las pruebas lo leen en `data-testid="ruta"` y `"estado"`. */
function Where() {
  const location = useLocation();
  return (
    <>
      <p data-testid="ruta">{location.pathname}</p>
      <p data-testid="estado">{JSON.stringify(location.state as unknown)}</p>
    </>
  );
}

interface Options {
  /** La ruta con la que arranca la memoria del enrutador. */
  path?: string;
  /** El estado de navegacion con el que se llega a la pantalla (lo que la pantalla anterior le deja dicho). */
  state?: unknown;
  auth?: TestAuth;
  /** El espacio de trabajo local de la persona (bases en memoria). Por omision, uno vacio. */
  local?: TestLocal;
  people?: BusinessPeople;
  catalog?: Catalog;
  inventory?: Inventory;
  purchasing?: Purchasing;
  /** El motor de sincronizacion de mentira. Por omision, uno que no tiene nada que decir. */
  sync?: FakeSyncEngine;
  /** La copia de lectura de mentira. Por omision, una vacia que no tiene nada que decir. */
  copy?: FakeReadCopy;
  connection?: ReturnType<typeof createTestConnection>;
}

/** Monta una pantalla con todo lo que la aplicacion le da: tema, conexion, movimiento, cuenta, personas, catalogo, existencias, compras y enrutador. */
export function renderScreen(ui: ReactElement, options: Options = {}) {
  const auth = options.auth ?? createTestAuth();
  const local = options.local ?? createTestLocal();
  const people = options.people ?? createFakePeople();
  const catalog = options.catalog ?? createFakeCatalog();
  const inventory = options.inventory ?? createFakeInventory();
  const purchasing = options.purchasing ?? createFakePurchasing();
  const sync = options.sync ?? new FakeSyncEngine();
  const copy = options.copy ?? new FakeReadCopy();
  const connection = options.connection ?? createTestConnection();
  const view = render(
    <ThemeProvider preference={createTestThemePreference().preference}>
      <ConnectionProvider monitor={connection.monitor}>
        <MotionProvider>
          <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
            <LocalWorkspaceProvider workspace={local.workspace}>
              <SyncProvider engine={sync}>
                <ReadCopyProvider copy={copy}>
                  <PeopleProvider people={people}>
                    <CatalogProvider catalog={catalog}>
                      <InventoryProvider inventory={inventory}>
                        <PurchasingProvider purchasing={purchasing}>
                          <MemoryRouter
                            initialEntries={[
                              { pathname: options.path ?? '/', state: options.state },
                            ]}
                          >
                            <Where />
                            {ui}
                          </MemoryRouter>
                        </PurchasingProvider>
                      </InventoryProvider>
                    </CatalogProvider>
                  </PeopleProvider>
                </ReadCopyProvider>
              </SyncProvider>
            </LocalWorkspaceProvider>
          </AuthProvider>
        </MotionProvider>
      </ConnectionProvider>
    </ThemeProvider>,
  );
  return { ...view, auth, local, people, catalog, inventory, purchasing, sync, copy, connection };
}
