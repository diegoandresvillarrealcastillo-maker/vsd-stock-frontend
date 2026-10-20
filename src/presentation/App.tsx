import type { ConnectionMonitor } from '../domain/ports/in/connection-monitor';
import type { BusinessPeople } from '../domain/ports/in/business-people';
import type { Catalog } from '../domain/ports/in/catalog';
import type { AppUpdates } from '../domain/ports/in/app-updates';
import type { Inventory } from '../domain/ports/in/inventory';
import type { LoadMe } from '../domain/ports/in/load-me';
import type { LocalWorkspace } from '../domain/ports/in/local-workspace';
import type { Purchasing } from '../domain/ports/in/purchasing';
import type { SessionManager } from '../domain/ports/in/session-manager';
import type { StorageProtectionStatus } from '../domain/ports/in/storage-protection';
import type { SyncEngine } from '../domain/ports/in/sync-engine';
import type { ThemePreference } from '../domain/ports/in/theme-preference';
import { AuthProvider } from './auth/AuthProvider';
import { CatalogProvider } from './catalog/CatalogProvider';
import { ConnectionProvider } from './connection/ConnectionProvider';
import { InventoryProvider } from './inventory/InventoryProvider';
import { LocalWorkspaceProvider } from './local/LocalWorkspaceProvider';
import { MotionProvider } from './motion/MotionProvider';
import { PeopleProvider } from './people/PeopleProvider';
import { PurchasingProvider } from './purchasing/PurchasingProvider';
import { PwaProvider } from './pwa/PwaProvider';
import { UpdateNotice } from './pwa/UpdateNotice';
import { AppRoutes } from './routes/AppRoutes';
import { SyncProvider } from './sync/SyncProvider';
import { ThemeProvider } from './theme/ThemeProvider';

/**
 * Raiz de la interfaz. La preferencia de tema, la vigilancia de conexion y la sesion llegan ya cableadas desde
 * `infrastructure/`: la interfaz no sabe donde se guarda el tema, como se pregunta al servidor ni como se entra. El
 * enrutador lo pone quien monta la aplicacion (el navegador en `main.tsx`, una memoria en las pruebas).
 */
export function App({
  theme,
  connection,
  auth,
  local,
  sync,
  people,
  catalog,
  inventory,
  purchasing,
  pwa,
}: {
  theme: ThemePreference;
  connection: ConnectionMonitor;
  auth: { sessions: SessionManager; loadMe: LoadMe };
  local: LocalWorkspace;
  sync: SyncEngine;
  people: BusinessPeople;
  catalog: Catalog;
  inventory: Inventory;
  purchasing: Purchasing;
  pwa: { updates: AppUpdates; storage: StorageProtectionStatus };
}) {
  return (
    <ThemeProvider preference={theme}>
      <ConnectionProvider monitor={connection}>
        <PwaProvider updates={pwa.updates} storage={pwa.storage}>
          <MotionProvider>
            <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
              <LocalWorkspaceProvider workspace={local}>
                <SyncProvider engine={sync}>
                  <PeopleProvider people={people}>
                    <CatalogProvider catalog={catalog}>
                      <InventoryProvider inventory={inventory}>
                        <PurchasingProvider purchasing={purchasing}>
                          <AppRoutes />
                          <UpdateNotice />
                        </PurchasingProvider>
                      </InventoryProvider>
                    </CatalogProvider>
                  </PeopleProvider>
                </SyncProvider>
              </LocalWorkspaceProvider>
            </AuthProvider>
          </MotionProvider>
        </PwaProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}
