import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NAVIGATION } from '../../domain/model/navigation';
import { can, ROLES, type Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { renderScreen } from '../../../test/support/screens';
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
  renderScreen(<AppRoutes />, { path, auth });
  return auth;
}

const menu = () =>
  within(screen.getByRole('navigation', { name: 'Principal' }))
    .getAllByRole('link')
    .map((link) => link.textContent);

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('AppRoutes', () => {
  describe('for someone who has not signed in', () => {
    it('shows sign in at «ingresar», without the menu', () => {
      renderAt('/ingresar');

      expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    });

    it('shows create account at «registrarse»', () => {
      renderAt('/registrarse');

      expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeDefined();
    });

    it.each(['/', '/catalogo', '/compras', '/personas', '/empezar', '/invitacion'])(
      'sends %s to sign in',
      async (path) => {
        renderAt(path);

        expect(await heading('Ingresar')).toBeDefined();
      },
    );
  });

  describe('for someone with a business', () => {
    it('shows the frame with the business, the person and the menu of the role', async () => {
      renderAt('/', { role: 'owner' });

      expect(await screen.findByText('Tienda La Esquina')).toBeDefined();
      expect(screen.getByText('Ana Gómez', { selector: 'p, span' })).toBeDefined();
      expect(menu()).toEqual(['Inicio', 'Catálogo', 'Inventario', 'Compras', 'Personas']);
    });

    it('opens on the home page', async () => {
      renderAt('/', { role: 'cashier' });

      expect(await heading('Inicio')).toBeDefined();
    });

    it.each([
      ['/catalogo', 'Catálogo'],
      ['/catalogo/nuevo', 'Nuevo producto'],
      ['/catalogo/categorias', 'Categorías'],
      ['/catalogo/arroz', 'Arroz 500 g'],
      ['/inventario', 'Existencias'],
      ['/inventario/p-1', 'Arroz 500 g'],
      ['/inventario/p-1/ajustar', 'Ajustar existencia'],
      ['/compras', 'Compras'],
      ['/compras/nueva', 'Nueva compra'],
      ['/compras/proveedores', 'Proveedores'],
      ['/personas', 'Personas'],
      ['/personas/nueva', 'Invitar a alguien'],
    ])('shows %s as «%s»', async (path, title) => {
      renderAt(path, { role: 'admin' });

      expect(await heading(title)).toBeDefined();
    });

    it('does not offer the cashier what the cashier can not use, and does not let them in by writing the address', async () => {
      renderAt('/compras', { role: 'cashier' });

      expect(await heading('No tienes acceso')).toBeDefined();
      expect(menu()).toEqual(['Inicio', 'Catálogo', 'Inventario']);
      expect(screen.queryByRole('heading', { level: 1, name: 'Compras' })).toBeNull();
    });

    it.each([
      '/personas',
      '/personas/nueva',
      '/personas/abc',
      '/compras',
      '/compras/nueva',
      '/compras/proveedores',
      '/inventario/p-1/ajustar',
      '/catalogo/nuevo',
      '/catalogo/categorias',
      '/catalogo/arroz',
    ])('keeps the cashier out of %s', async (path) => {
      renderAt(path, { role: 'cashier' });

      expect(await heading('No tienes acceso')).toBeDefined();
    });

    it.each([
      ['/catalogo', 'Catálogo'],
      ['/inventario', 'Existencias'],
      ['/inventario/p-1', 'Arroz 500 g'],
    ])('lets the cashier into %s, which the cashier can use', async (path, title) => {
      renderAt(path, { role: 'cashier' });

      expect(await heading(title)).toBeDefined();
    });

    it.each(NAVIGATION.flatMap((item) => ROLES.map((role) => [item, role] as const)))(
      'lets a role into what its menu offers and keeps it out of what its menu does not: %j',
      async (item, role) => {
        renderAt(item.path, { role });

        const forbidden = !can(role, item.action);
        if (forbidden) expect(await heading('No tienes acceso')).toBeDefined();
        else {
          await waitFor(() =>
            expect(screen.getByRole('navigation', { name: 'Principal' })).toBeDefined(),
          );
          expect(screen.queryByRole('heading', { level: 1, name: 'No tienes acceso' })).toBeNull();
          expect(menu()).toContain(item.label);
        }
        expect(menu().includes(item.label)).toBe(!forbidden);
      },
    );

    it('says the page does not exist, and offers the way home', async () => {
      renderAt('/no-existe', { role: 'owner' });

      expect(await heading('No encontramos esta página')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Ir al inicio' }).getAttribute('href')).toBe('/');
    });

    it.each(['/ingresar', '/registrarse', '/empezar', '/invitacion'])(
      'takes whoever already works in a business away from %s',
      async (path) => {
        renderAt(path, { role: 'owner' });

        await waitFor(() =>
          expect(screen.getByRole('navigation', { name: 'Principal' })).toBeDefined(),
        );
        expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeDefined();
      },
    );
  });

  describe('for someone with a session but no business yet', () => {
    it.each(['/', '/catalogo', '/ingresar', '/registrarse'])(
      'sends %s to «create your business»',
      async (path) => {
        renderAt(path, { role: 'owner', membership: false });

        expect(await heading('Crea tu negocio')).toBeDefined();
        expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
      },
    );

    it('lets them use an invitation instead', async () => {
      renderAt('/invitacion', { role: 'owner', membership: false });

      expect(await heading('Unirme a un negocio')).toBeDefined();
    });
  });
});
