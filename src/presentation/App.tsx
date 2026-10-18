import type { ConnectionMonitor } from '../domain/ports/in/connection-monitor';
import type { BusinessPeople } from '../domain/ports/in/business-people';
import type { Catalog } from '../domain/ports/in/catalog';
import type { LoadMe } from '../domain/ports/in/load-me';
import type { SessionManager } from '../domain/ports/in/session-manager';
import type { ThemePreference } from '../domain/ports/in/theme-preference';
import { AuthProvider } from './auth/AuthProvider';
import { CatalogProvider } from './catalog/CatalogProvider';
import { ConnectionProvider } from './connection/ConnectionProvider';
import { MotionProvider } from './motion/MotionProvider';
import { PeopleProvider } from './people/PeopleProvider';
import { AppRoutes } from './routes/AppRoutes';
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
  people,
  catalog,
}: {
  theme: ThemePreference;
  connection: ConnectionMonitor;
  auth: { sessions: SessionManager; loadMe: LoadMe };
  people: BusinessPeople;
  catalog: Catalog;
}) {
  return (
    <ThemeProvider preference={theme}>
      <ConnectionProvider monitor={connection}>
        <MotionProvider>
          <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
            <PeopleProvider people={people}>
              <CatalogProvider catalog={catalog}>
                <AppRoutes />
              </CatalogProvider>
            </PeopleProvider>
          </AuthProvider>
        </MotionProvider>
      </ConnectionProvider>
    </ThemeProvider>
  );
}
