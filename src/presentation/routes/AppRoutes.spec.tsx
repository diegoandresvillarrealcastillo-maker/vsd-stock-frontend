import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestConnection } from '../../../test/support/connection';
import { AuthProvider } from '../auth/AuthProvider';
import { ConnectionProvider } from '../connection/ConnectionProvider';
import { MotionProvider } from '../motion/MotionProvider';
import { ThemeProvider } from '../theme/ThemeProvider';
import { createTestThemePreference } from '../../../test/support/theme';
import { AppRoutes } from './AppRoutes';

function renderAt(path: string, signedInAs?: { role: Role; membership?: boolean }) {
  const auth = createTestAuth(signedInAs ? { stored: testSession('ana') } : {});
  if (signedInAs) {
    auth.answer(
      signedInAs.membership === false
        ? { identity: { id: 'ana', email: 'ana@example.com' }, membership: null }
        : testMe('ana', signedInAs.role),
    );
  }
  render(
    <ThemeProvider preference={createTestThemePreference().preference}>
      <ConnectionProvider monitor={createTestConnection().monitor}>
        <MotionProvider>
          <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </MotionProvider>
      </ConnectionProvider>
    </ThemeProvider>,
  );
  return auth;
}

const menu = () =>
  within(screen.getByRole('navigation', { name: 'Principal' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('AppRoutes', () => {
  describe('for someone who has not signed in', () => {
    it('shows the public page at «ingresar»', () => {
      renderAt('/ingresar');

      expect(screen.getByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    });

    it.each(['/', '/catalogo', '/compras', '/empezar'])('sends %s to sign in', async (path) => {
      renderAt(path);

      expect(await screen.findByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
    });
  });

  describe('for someone with a business', () => {
    it('shows the frame with the business, the person and the menu of the role', async () => {
      renderAt('/', { role: 'owner' });

      expect(await screen.findByText('Tienda La Esquina')).toBeDefined();
      expect(screen.getByText('Ana Gómez')).toBeDefined();
      expect(menu()).toEqual(['Inicio', 'Catálogo', 'Inventario', 'Compras', 'Personas']);
    });

    it.each([
      ['/catalogo', 'Catálogo'],
      ['/catalogo/abc', 'Catálogo'],
      ['/inventario', 'Inventario'],
      ['/compras', 'Compras'],
      ['/personas', 'Personas'],
    ])('shows %s as «%s»', async (path, title) => {
      renderAt(path, { role: 'admin' });

      expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined();
    });

    it('does not offer the cashier what the cashier can not use, and does not let them in by writing the address', async () => {
      renderAt('/compras', { role: 'cashier' });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'No tienes acceso' }),
      ).toBeDefined();
      expect(menu()).toEqual(['Inicio', 'Catálogo', 'Inventario']);
      expect(screen.queryByRole('heading', { level: 1, name: 'Compras' })).toBeNull();
    });

    it.each(['/personas', '/compras'])('keeps the cashier out of %s', async (path) => {
      renderAt(path, { role: 'cashier' });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'No tienes acceso' }),
      ).toBeDefined();
    });

    it('lets the cashier into what the cashier can use', async () => {
      renderAt('/catalogo', { role: 'cashier' });

      expect(await screen.findByRole('heading', { level: 1, name: 'Catálogo' })).toBeDefined();
    });

    it('says the page does not exist, and offers the way home', async () => {
      renderAt('/no-existe', { role: 'owner' });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'No encontramos esta página' }),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/');
    });

    it('takes whoever already signed in away from the public page', async () => {
      renderAt('/ingresar', { role: 'owner' });

      await waitFor(() =>
        expect(screen.getByRole('navigation', { name: 'Principal' })).toBeDefined(),
      );
    });
  });

  describe('for someone with a session but no business yet', () => {
    it.each(['/', '/catalogo', '/ingresar'])('sends %s to «create your business»', async (path) => {
      renderAt(path, { role: 'owner', membership: false });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Crea tu negocio' }),
      ).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    });
  });
});
