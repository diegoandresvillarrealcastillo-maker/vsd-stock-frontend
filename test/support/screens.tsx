import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import type { BusinessPeople } from '../../src/domain/ports/in/business-people';
import { AuthProvider } from '../../src/presentation/auth/AuthProvider';
import { ConnectionProvider } from '../../src/presentation/connection/ConnectionProvider';
import { MotionProvider } from '../../src/presentation/motion/MotionProvider';
import { PeopleProvider } from '../../src/presentation/people/PeopleProvider';
import { ThemeProvider } from '../../src/presentation/theme/ThemeProvider';
import { createTestAuth, type TestAuth } from './auth';
import { createTestConnection } from './connection';
import { createFakePeople } from './people';
import { createTestThemePreference } from './theme';

/** Donde esta la aplicacion ahora: las pruebas de navegacion lo leen en `data-testid="ruta"`. */
function Where() {
  const { pathname } = useLocation();
  return <p data-testid="ruta">{pathname}</p>;
}

interface Options {
  /** La ruta con la que arranca la memoria del enrutador. */
  path?: string;
  auth?: TestAuth;
  people?: BusinessPeople;
  connection?: ReturnType<typeof createTestConnection>;
}

/** Monta una pantalla con todo lo que la aplicacion le da: tema, conexion, movimiento, cuenta, personas y enrutador. */
export function renderScreen(ui: ReactElement, options: Options = {}) {
  const auth = options.auth ?? createTestAuth();
  const people = options.people ?? createFakePeople();
  const connection = options.connection ?? createTestConnection();
  const view = render(
    <ThemeProvider preference={createTestThemePreference().preference}>
      <ConnectionProvider monitor={connection.monitor}>
        <MotionProvider>
          <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
            <PeopleProvider people={people}>
              <MemoryRouter initialEntries={[options.path ?? '/']}>
                <Where />
                {ui}
              </MemoryRouter>
            </PeopleProvider>
          </AuthProvider>
        </MotionProvider>
      </ConnectionProvider>
    </ThemeProvider>,
  );
  return { ...view, auth, people, connection };
}
