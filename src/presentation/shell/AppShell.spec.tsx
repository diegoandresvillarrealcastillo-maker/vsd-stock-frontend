import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestConnection } from '../../../test/support/connection';
import { createTestLocal } from '../../../test/support/local';
import { createTestThemePreference } from '../../../test/support/theme';
import { AuthProvider } from '../auth/AuthProvider';
import { ConnectionProvider } from '../connection/ConnectionProvider';
import { LocalWorkspaceProvider } from '../local/LocalWorkspaceProvider';
import { MotionProvider } from '../motion/MotionProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AppShell } from './AppShell';

async function setup({
  role = 'owner',
  at = '/',
  businessName = 'Tienda La Esquina',
  prepare,
}: {
  role?: Role;
  at?: string;
  businessName?: string;
  /** Deja el espacio de trabajo local como la prueba lo necesita, antes de que la persona entre. */
  prepare?: (local: ReturnType<typeof createTestLocal>) => void;
} = {}) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role, businessName));
  const connection = createTestConnection();
  const theme = createTestThemePreference();
  const local = createTestLocal();
  prepare?.(local);

  function Providers({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider preference={theme.preference}>
        <ConnectionProvider monitor={connection.monitor}>
          <MotionProvider>
            <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
              <LocalWorkspaceProvider workspace={local.workspace}>
                <MemoryRouter initialEntries={[at]}>{children}</MemoryRouter>
              </LocalWorkspaceProvider>
            </AuthProvider>
          </MotionProvider>
        </ConnectionProvider>
      </ThemeProvider>
    );
  }

  render(
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<p>Pantalla de inicio</p>} />
        <Route path="catalogo" element={<p>Pantalla de catálogo</p>} />
        <Route path="personas" element={<p>Pantalla de personas</p>} />
      </Route>
    </Routes>,
    { wrapper: Providers },
  );
  // Espera a que se sepa quien es la persona.
  await waitFor(() => expect(screen.queryByText(/cargando tu cuenta/i)).toBeNull());
  return { auth, connection, theme, local };
}

const nav = () => screen.getByRole('navigation', { name: 'Principal' });
const labels = () =>
  within(nav())
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('AppShell', () => {
  describe('the menu', () => {
    it('offers a cashier the pages a cashier can use, and nothing else', async () => {
      await setup({ role: 'cashier' });

      expect(labels()).toEqual(['Inicio', 'Catálogo', 'Inventario']);
    });

    it.each(['admin', 'owner'] as const)('offers %s every page', async (role) => {
      await setup({ role });

      expect(labels()).toEqual(['Inicio', 'Catálogo', 'Inventario', 'Compras', 'Personas']);
    });

    it('points each link at its path', async () => {
      await setup({ role: 'owner' });

      const hrefs = within(nav())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'));
      expect(hrefs).toEqual(['/', '/catalogo', '/inventario', '/compras', '/personas']);
    });

    it('marks the page the person is on, for a screen reader too', async () => {
      await setup({ at: '/catalogo' });

      const current = within(nav())
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page');
      expect(current.map((link) => link.textContent)).toEqual(['Catálogo']);
    });

    it('marks only Inicio on the home page, not every page that starts with a slash', async () => {
      await setup({ at: '/' });

      const current = within(nav())
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page');
      expect(current.map((link) => link.textContent)).toEqual(['Inicio']);
    });
  });

  describe('the frame', () => {
    it('says which business the person is working in, and who they are', async () => {
      await setup({ businessName: 'Ferretería El Tornillo' });

      expect(screen.getByText('Ferretería El Tornillo')).toBeDefined();
      expect(screen.getByText('Ana Gómez')).toBeDefined();
    });

    it('has a link to skip the menu and go straight to the content, first in the tab order', async () => {
      await setup();

      const skip = screen.getByRole('link', { name: 'Saltar al contenido' });
      expect(skip.getAttribute('href')).toBe('#contenido');
      expect(document.getElementById('contenido')?.tagName).toBe('MAIN');
      expect(document.body.querySelector('a')).toBe(skip);
    });

    it('shows the page of the route inside the main region', async () => {
      await setup({ at: '/personas' });

      expect(within(screen.getByRole('main')).getByText('Pantalla de personas')).toBeDefined();
    });

    it('warns in the frame, on any page, when this browser can not keep encrypted data', async () => {
      await setup({
        prepare: (local) => {
          local.stores.failOpen = new Error('sin IndexedDB');
        },
      });

      expect(
        await screen.findByText('Este navegador no puede guardar datos de forma segura'),
      ).toBeDefined();
    });

    it('has the theme button', async () => {
      await setup();

      expect(screen.getByRole('button', { name: /cambiar a tema/i })).toBeDefined();
    });
  });

  describe('signing out', () => {
    it('closes the session', async () => {
      const { auth } = await setup();

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      await waitFor(() => expect(auth.store.get()).toBeNull());
    });
  });

  describe('without a connection', () => {
    it('shows the home page anyway: it does not need the server', async () => {
      const { connection } = await setup({ at: '/' });

      await act(async () => {
        await connection.health.fail();
      });

      expect(screen.getByText('Pantalla de inicio')).toBeDefined();
      expect(screen.queryByText(/necesita conexión/i)).toBeNull();
    });

    it('says a page that needs the server needs it, instead of showing it', async () => {
      const { connection } = await setup({ at: '/catalogo' });

      await act(async () => {
        await connection.health.fail();
      });

      expect(screen.queryByText('Pantalla de catálogo')).toBeNull();
      expect(screen.getByText('Esta pantalla necesita conexión')).toBeDefined();
    });

    it('keeps the menu working so the person can leave for a page that does not need it', async () => {
      const { connection } = await setup({ at: '/catalogo' });
      await act(async () => {
        await connection.health.fail();
      });

      fireEvent.click(within(nav()).getByRole('link', { name: 'Inicio' }));

      expect(screen.getByText('Pantalla de inicio')).toBeDefined();
    });
  });
});
