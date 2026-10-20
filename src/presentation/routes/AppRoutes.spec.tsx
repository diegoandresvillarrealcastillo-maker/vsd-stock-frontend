import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NAVIGATION } from '../../domain/model/navigation';
import { can, ROLES, type Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { item } from '../../../test/support/fake-selling';
import { createTestLocal, rememberPerson, type TestLocal } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { FakeSelling } from '../../../test/support/selling';
import { EMPTY_CART, addProduct } from '../../domain/model/sale-cart';
import { buildReceipt } from '../../domain/model/sale-receipt';
import { AppRoutes } from './AppRoutes';

function renderAt(
  path: string,
  signedInAs?: { role: Role; membership?: boolean },
  local: TestLocal = createTestLocal(),
  selling: FakeSelling = new FakeSelling(),
) {
  const auth = createTestAuth(signedInAs ? { stored: testSession('ana') } : {});
  if (signedInAs) {
    auth.answer(
      signedInAs.membership === false
        ? { identity: { id: 'ana', email: 'ana@example.com' }, membership: null }
        : testMe('ana', signedInAs.role),
    );
  }
  renderScreen(<AppRoutes />, { path, auth, local, selling });
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

  describe('what each screen of the menu really is', () => {
    it('shows the people of the business at «personas», and not only a title', async () => {
      renderAt('/personas', { role: 'admin' });

      expect(
        await screen.findByText('Quién trabaja en tu negocio y qué puede hacer.'),
      ).toBeDefined();
    });

    it('shows the sign-in form at «ingresar», and not only a title', () => {
      renderAt('/ingresar');

      expect(screen.getByLabelText('Correo')).toBeDefined();
      expect(screen.getByLabelText('Contraseña')).toBeDefined();
    });
  });

  describe('the counter', () => {
    const counter = () => screen.findByRole('heading', { level: 1, name: 'Este equipo' });

    it('sends someone who has not entered, and has nothing saved here, to sign in', async () => {
      renderAt('/mostrador');

      expect(await heading('Ingresar')).toBeDefined();
    });

    it('opens for a person who came in with a connection, outside of the menu of the administration', async () => {
      renderAt('/mostrador/equipo', { role: 'cashier' });

      expect(await counter()).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    });

    it('opens, without a session, for the person who resumed it without a connection', async () => {
      const local = createTestLocal();
      rememberPerson(local, {
        authUserId: 'ana',
        email: 'ana@example.com',
        userId: 'u-ana',
        businessId: 'b-1',
        businessName: 'Tienda La Esquina',
        role: 'cashier',
        fullName: 'Ana Gómez',
        verifiedAt: '2026-10-17T10:00:00.000Z',
      });
      await local.workspace.resume();

      renderAt('/mostrador/equipo', undefined, local);

      expect(await counter()).toBeDefined();
      expect(screen.getByText(/Estás trabajando sin conexión/)).toBeDefined();
    });

    it('sends a person who has no business yet to create it: there is no counter for them', async () => {
      renderAt('/mostrador', { role: 'owner', membership: false });

      expect(await heading('Crea tu negocio')).toBeDefined();
    });

    it('sells at the counter itself: it is the first thing the person sees', async () => {
      renderAt('/mostrador', { role: 'cashier' });

      expect(await heading('Vender')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
    });

    it('charges one level down, still inside the counter', async () => {
      const selling = new FakeSelling();
      selling.add(item(1, { name: 'Arroz 500 g', unitPrice: 3_200 }));

      renderAt('/mostrador/cobrar', { role: 'cashier' }, undefined, selling);

      expect(await screen.findByText('Total a cobrar')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
    });

    it('goes back to the sale from the charge when there is nothing to charge', async () => {
      renderAt('/mostrador/cobrar', { role: 'cashier' });

      expect(await heading('Vender')).toBeDefined();
    });

    it('shows the receipt one level down, still inside the counter', async () => {
      const selling = new FakeSelling();
      selling.set(
        EMPTY_CART,
        buildReceipt({
          operationId: 'op-1',
          shiftId: 'shift-1',
          folio: 'AA-000001',
          at: new Date('2026-10-19T14:00:00.000Z'),
          clockOffsetMs: null,
          cashier: 'Ana Gómez',
          shiftOpenedAt: '2026-10-19T13:02:00.000Z',
          cart: addProduct(EMPTY_CART, item(1, { name: 'Arroz 500 g', unitPrice: 3_200 })),
          payment: { method: 'cash', received: 5_000 },
        }),
      );

      renderAt('/mostrador/comprobante', { role: 'cashier' }, undefined, selling);

      expect(await heading('Venta AA-000001')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
    });

    it('goes back to the sale from the receipt when there is none', async () => {
      renderAt('/mostrador/comprobante', { role: 'cashier' });

      expect(await heading('Vender')).toBeDefined();
    });

    it('has the shift inside the frame of the counter, with its own menu', async () => {
      renderAt('/mostrador/turno', { role: 'cashier' });

      expect(await heading('Turno de caja')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    });

    it('closes the shift one level down, still inside the counter', async () => {
      renderAt('/mostrador/turno/cerrar', { role: 'cashier' });

      expect(await heading('Cerrar turno')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
    });

    it('has the sales inside the frame of the counter, for the cashier as well', async () => {
      renderAt('/mostrador/ventas', { role: 'cashier' });

      expect(await heading('Ventas')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
      expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull();
    });

    it('shows a sale one level down, still inside the counter', async () => {
      renderAt('/mostrador/ventas/sale-1', { role: 'cashier' });

      expect(await heading('Venta AA-000141')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
    });

    it.each<Role>(['owner', 'admin'])('lets the %s void a sale', async (role) => {
      renderAt('/mostrador/ventas/sale-1/anular', { role });

      expect(await heading('Anular la venta AA-000141')).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Mostrador' })).toBeDefined();
    });

    it('keeps the cashier out of voiding a sale, even by writing the address', async () => {
      renderAt('/mostrador/ventas/sale-1/anular', { role: 'cashier' });

      expect(await heading('No tienes acceso')).toBeDefined();
      expect(screen.queryByRole('heading', { level: 1, name: /Anular/ })).toBeNull();
    });

    it('opens the sales without a session for the person who resumed the counter without a connection', async () => {
      const local = createTestLocal();
      rememberPerson(local, {
        authUserId: 'ana',
        email: 'ana@example.com',
        userId: 'u-ana',
        businessId: 'b-1',
        businessName: 'Tienda La Esquina',
        role: 'cashier',
        fullName: 'Ana Gómez',
        verifiedAt: '2026-10-17T10:00:00.000Z',
      });
      await local.workspace.resume();

      renderAt('/mostrador/ventas', undefined, local);

      expect(await heading('Ventas')).toBeDefined();
    });

    it('opens the shift without a session for the person who resumed the counter without a connection', async () => {
      const local = createTestLocal();
      rememberPerson(local, {
        authUserId: 'ana',
        email: 'ana@example.com',
        userId: 'u-ana',
        businessId: 'b-1',
        businessName: 'Tienda La Esquina',
        role: 'cashier',
        fullName: 'Ana Gómez',
        verifiedAt: '2026-10-17T10:00:00.000Z',
      });
      await local.workspace.resume();

      renderAt('/mostrador/turno', undefined, local);

      expect(await heading('Turno de caja')).toBeDefined();
    });

    it('sends someone who has not entered, and has nothing saved here, from the shift to sign in', async () => {
      renderAt('/mostrador/turno');

      expect(await heading('Ingresar')).toBeDefined();
    });

    it('is reached from the home page', async () => {
      renderAt('/', { role: 'cashier' });

      const link = await screen.findByRole('link', { name: 'Ir al mostrador' });

      expect(link.getAttribute('href')).toBe('/mostrador');
    });
  });

  describe('the catalog', () => {
    it('shows the products at «catalogo», and not only a title', async () => {
      renderAt('/catalogo', { role: 'cashier' });

      expect(await screen.findByText('Los productos que vendes y compras.')).toBeDefined();
    });
  });
});
