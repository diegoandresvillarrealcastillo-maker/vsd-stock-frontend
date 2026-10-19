import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../domain/model/permissions';
import { createTestAuth, testMe, testSession, type TestAuth } from '../../test/support/auth';
import { createTestConnection } from '../../test/support/connection';
import { createTestLocal } from '../../test/support/local';
import { createFakeCatalog } from '../../test/support/catalog';
import { createFakeInventory } from '../../test/support/inventory';
import { createFakePeople } from '../../test/support/people';
import { createFakePurchasing } from '../../test/support/purchasing';
import { FakeReadCopy } from '../../test/support/read-copy';
import { FakeShifts } from '../../test/support/shifts';
import { FakeSyncEngine } from '../../test/support/sync-engine';
import { createTestThemePreference } from '../../test/support/theme';
import { App } from './App';

function renderApp({
  theme = createTestThemePreference().preference,
  connection = createTestConnection(),
  auth = createTestAuth(),
  sync = new FakeSyncEngine(),
  copy = new FakeReadCopy(),
  shifts = new FakeShifts(),
  path = '/ingresar',
}: {
  theme?: ReturnType<typeof createTestThemePreference>['preference'];
  connection?: ReturnType<typeof createTestConnection>;
  auth?: TestAuth;
  sync?: FakeSyncEngine;
  copy?: FakeReadCopy;
  shifts?: FakeShifts;
  path?: string;
} = {}) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App
        theme={theme}
        connection={connection.monitor}
        auth={auth}
        local={createTestLocal().workspace}
        sync={sync}
        copy={copy}
        shifts={shifts}
        people={createFakePeople()}
        catalog={createFakeCatalog()}
        inventory={createFakeInventory()}
        purchasing={createFakePurchasing()}
      />
    </MemoryRouter>,
  );
  return connection;
}

/** Una cuenta que ya entro y tiene negocio. */
function signedIn(role: Role) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  return auth;
}

describe('App', () => {
  it('opens a person who signed in before straight into the application', async () => {
    renderApp({ auth: signedIn('cashier'), path: '/' });

    expect(await screen.findByText('Tienda La Esquina')).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeDefined();
  });

  it('keeps the account of the person for every screen, so none has to ask who they are', async () => {
    const auth = signedIn('owner');
    renderApp({ auth, path: '/' });
    await screen.findByText('Tienda La Esquina');

    fireEvent.click(screen.getByRole('link', { name: 'Catálogo' }));
    fireEvent.click(screen.getByRole('link', { name: 'Inicio' }));

    expect(auth.loads).toEqual(['ana']);
  });

  it('gives the whole interface the sync engine, starts it, and tells the person what is left to send', async () => {
    const sync = new FakeSyncEngine({ pending: 2 });
    renderApp({ auth: signedIn('owner'), sync, path: '/catalogo' });
    await screen.findByText('Tienda La Esquina');

    expect(sync.starts).toBeGreaterThan(0);
    expect(screen.getByText('2 registros por enviar.')).toBeDefined();
  });

  it('gives the whole interface the shift of the counter, and starts it', async () => {
    const shifts = new FakeShifts({ status: 'none' });
    const auth = signedIn('cashier');
    renderApp({ auth, shifts, path: '/mostrador/turno' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Turno de caja' })).toBeDefined();
    expect(shifts.starts).toBeGreaterThan(0);
  });

  it('asks whoever has not signed in to sign in', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeDefined();
  });

  it('gives every screen the people of the business, so none has to build the use case', async () => {
    renderApp({ auth: signedIn('owner'), path: '/personas' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Personas' })).toBeDefined();
    // El nombre tambien esta en la cabecera: la lista de personas es lo que esta dentro del contenido.
    expect(await within(screen.getByRole('main')).findByText('Ana Gómez')).toBeDefined();
  });

  it('gives the whole interface the motion provider, so no screen has to set it up', async () => {
    renderApp({ auth: signedIn('owner'), path: '/' });
    await screen.findByText('Tienda La Esquina');

    // Sin el proveedor de movimiento, el contenido nunca termina de salir y la
    // pagina nueva nunca entra: es lo que esta prueba vigila.
    fireEvent.click(screen.getByRole('link', { name: 'Catálogo' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Catálogo' })).toBeDefined();
  });

  it('gives the whole interface the theme: pressing the button applies the new theme', () => {
    const { preference, applied } = createTestThemePreference({ saved: 'light' });
    renderApp({ theme: preference });
    expect(applied).toEqual(['light']);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));

    expect(applied).toEqual(['light', 'dark']);
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
  });

  it('starts watching the connection when it opens, and shows what the server answers', async () => {
    const connection = renderApp({ auth: signedIn('owner'), path: '/' });
    expect(connection.health.requests).toBe(1);

    await act(async () => {
      await connection.health.succeed();
    });

    expect(screen.getByText('En línea')).toBeDefined();
  });

  it('shows that there is no connection when the server does not answer', async () => {
    const connection = renderApp({ auth: signedIn('owner'), path: '/' });

    await act(async () => {
      await connection.health.fail();
    });

    expect(screen.getByText('Sin conexión')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });
});
