import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LocalProfile } from '../../domain/model/local-profile';
import type { Role } from '../../domain/model/permissions';
import type { SalesHistory } from '../../domain/ports/in/sales-history';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
import { createFakeSalesHistory } from '../../../test/support/sales';
import { renderScreen } from '../../../test/support/screens';
import { FakeSyncEngine } from '../../../test/support/sync-engine';
import { CounterShell } from './CounterShell';

const profile: LocalProfile = {
  authUserId: 'ana',
  email: 'ana@example.com',
  userId: 'u-ana',
  businessId: 'b-1',
  businessName: 'Tienda La Esquina',
  role: 'cashier',
  fullName: 'Ana Gómez',
  verifiedAt: '2026-10-17T10:00:00.000Z',
};

const routes = (
  <Routes>
    <Route path="/mostrador" element={<CounterShell />}>
      <Route index element={<p>aqui va el mostrador</p>} />
      <Route path="turno" element={<p>aqui va el turno</p>} />
      <Route path="turno/cerrar" element={<p>aqui se cierra el turno</p>} />
      <Route path="cobrar" element={<p>aqui se cobra</p>} />
      <Route path="comprobante" element={<p>aqui el comprobante</p>} />
      <Route path="ventas" element={<p>aqui van las ventas</p>} />
      <Route path="ventas/:saleId" element={<p>aqui una venta</p>} />
      <Route path="ventas/:saleId/anular" element={<p>aqui se anula una venta</p>} />
      <Route path="equipo" element={<p>aqui el equipo</p>} />
    </Route>
  </Routes>
);

/** Una persona que entro con conexion: la cuenta esta lista y su base abierta. */
async function online(
  path = '/mostrador',
  sync = new FakeSyncEngine(),
  { role = 'cashier', sales }: { role?: Role; sales?: SalesHistory } = {},
) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const local = createTestLocal();
  const view = renderScreen(routes, {
    auth,
    local,
    sync,
    path,
    ...(sales === undefined ? {} : { sales }),
  });
  await waitFor(() => {
    expect(local.workspace.current()?.deviceCode).toBe('AA');
  });
  return { ...view, auth, local };
}

/** Una persona que reanudo el mostrador sin conexion: no hay sesion, solo su registro local. */
async function resumed(path = '/mostrador') {
  const local = createTestLocal();
  rememberPerson(local, profile);
  local.stores.dataOf('ana').device = { id: 'dev-1', code: 'AA' };
  local.stores.dataOf('ana').pending = 2;
  const view = renderScreen(routes, { local, path });
  await local.workspace.resume();
  return { ...view, local };
}

describe('CounterShell', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(routes, { path: '/mostrador' });

    // Nada de la pantalla: solo lo que el montaje de prueba pone para saber donde esta (la ruta y su estado).
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('has the button to turn the mascots off in the header, also without a connection', async () => {
    await resumed();

    const header = await screen.findByRole('banner');
    const button = within(header).getByRole('button', { name: 'Mostrar mascotas' });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('says in the header which business and which person', async () => {
    await online();

    const header = await screen.findByRole('banner');
    expect(header.textContent).toContain('Tienda La Esquina');
    expect(header.textContent).toContain('Ana Gómez');
  });

  it('puts the screen of each route inside the main content', async () => {
    await online('/mostrador/turno');

    const main = await screen.findByRole('main');
    expect(within(main).getByText('aqui va el turno')).toBeDefined();
  });

  it('offers a link to skip to the content', async () => {
    await online();

    const skip = await screen.findByRole('link', { name: 'Saltar al contenido' });

    expect(skip.getAttribute('href')).toBe('#contenido');
    expect(screen.getByRole('main').getAttribute('id')).toBe('contenido');
  });

  describe('the menu of the counter', () => {
    it('offers the counter and the shift, and marks where the person is', async () => {
      await online('/mostrador/turno');

      const menu = await screen.findByRole('navigation', { name: 'Mostrador' });
      const counter = within(menu).getByRole('link', { name: 'Mostrador' });
      const shift = within(menu).getByRole('link', { name: 'Turno' });

      expect(counter.getAttribute('href')).toBe('/mostrador');
      expect(shift.getAttribute('href')).toBe('/mostrador/turno');
      expect(shift.getAttribute('aria-current')).toBe('page');
      expect(counter.getAttribute('aria-current')).toBeNull();
      // Tambien se ve: la pagina actual tiene el color del tema, y las demas no.
      expect(shift.className).toContain('bg-primary');
      expect(counter.className).not.toContain('bg-primary');
    });

    it('offers the sales between the shift and the device, in that order', async () => {
      await online();

      const menu = await screen.findByRole('navigation', { name: 'Mostrador' });

      expect(
        within(menu)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual(['Mostrador', 'Turno', 'Ventas', 'Equipo']);
      expect(within(menu).getByRole('link', { name: 'Ventas' }).getAttribute('href')).toBe(
        '/mostrador/ventas',
      );
    });

    it.each(['/mostrador/ventas', '/mostrador/ventas/sale-1', '/mostrador/ventas/sale-1/anular'])(
      'keeps the sales marked on %s, and nothing else',
      async (path) => {
        await online(path);

        const menu = await screen.findByRole('navigation', { name: 'Mostrador' });

        expect(
          within(menu).getByRole('link', { name: 'Ventas' }).getAttribute('aria-current'),
        ).toBe('page');
        expect(
          within(menu).getByRole('link', { name: 'Mostrador' }).getAttribute('aria-current'),
        ).toBeNull();
        expect(
          within(menu).getByRole('link', { name: 'Equipo' }).getAttribute('aria-current'),
        ).toBeNull();
      },
    );

    it('does not mark the sales on the counter itself', async () => {
      await online('/mostrador');

      const menu = await screen.findByRole('navigation', { name: 'Mostrador' });

      expect(
        within(menu).getByRole('link', { name: 'Ventas' }).getAttribute('aria-current'),
      ).toBeNull();
    });

    it('says how many sales need attention to the owner, in the name of the link', async () => {
      const sales = createFakeSalesHistory();
      sales.attentionCount.mockResolvedValue({ count: 3, more: false });
      await online('/mostrador', new FakeSyncEngine(), { role: 'owner', sales });

      const link = await screen.findByRole('link', { name: 'Ventas 3' });

      expect(link.getAttribute('href')).toBe('/mostrador/ventas');
      // El número es de las ventas: ningún otro elemento del menú lo lleva.
      const menu = screen.getByRole('navigation', { name: 'Mostrador' });
      expect(
        within(menu)
          .getAllByRole('link')
          .map((item) => item.textContent),
      ).toEqual(['Mostrador', 'Turno', 'Ventas 3', 'Equipo']);
    });

    it('says it to an administrator too', async () => {
      const sales = createFakeSalesHistory();
      sales.attentionCount.mockResolvedValue({ count: 1, more: false });
      await online('/mostrador', new FakeSyncEngine(), { role: 'admin', sales });

      expect(await screen.findByRole('link', { name: 'Ventas 1' })).toBeDefined();
    });

    it('says that there are more than it counts, when there are', async () => {
      const sales = createFakeSalesHistory();
      sales.attentionCount.mockResolvedValue({ count: 50, more: true });
      await online('/mostrador', new FakeSyncEngine(), { role: 'owner', sales });

      expect(await screen.findByRole('link', { name: 'Ventas 50+' })).toBeDefined();
    });

    it('says no number when none needs attention', async () => {
      const sales = createFakeSalesHistory();
      await online('/mostrador', new FakeSyncEngine(), { role: 'owner', sales });
      await waitFor(() => {
        expect(sales.attentionCount).toHaveBeenCalled();
      });

      expect(screen.getByRole('link', { name: 'Ventas' })).toBeDefined();
    });

    it('does not tell the cashier, who is not told of what needs attention', async () => {
      const sales = createFakeSalesHistory();
      sales.attentionCount.mockResolvedValue({ count: 3, more: false });
      await online('/mostrador', new FakeSyncEngine(), { role: 'cashier', sales });

      expect(await screen.findByRole('link', { name: 'Ventas' })).toBeDefined();
      expect(sales.attentionCount).not.toHaveBeenCalled();
    });

    it('offers what this device knows as well', async () => {
      await online('/mostrador/equipo');

      const menu = await screen.findByRole('navigation', { name: 'Mostrador' });
      const device = within(menu).getByRole('link', { name: 'Equipo' });

      expect(device.getAttribute('href')).toBe('/mostrador/equipo');
      expect(device.getAttribute('aria-current')).toBe('page');
      expect(
        within(menu).getByRole('link', { name: 'Mostrador' }).getAttribute('aria-current'),
      ).toBeNull();
    });

    it.each(['/mostrador/cobrar', '/mostrador/comprobante'])(
      'keeps the counter marked while charging and on the receipt: %s is still the sale',
      async (path) => {
        await online(path);

        const menu = await screen.findByRole('navigation', { name: 'Mostrador' });

        expect(
          within(menu).getByRole('link', { name: 'Mostrador' }).getAttribute('aria-current'),
        ).toBe('page');
        expect(
          within(menu).getByRole('link', { name: 'Turno' }).getAttribute('aria-current'),
        ).toBeNull();
        expect(
          within(menu).getByRole('link', { name: 'Equipo' }).getAttribute('aria-current'),
        ).toBeNull();
      },
    );

    it('marks the counter only on its own screens, not on the ones that are the shift or the device', async () => {
      await online('/mostrador');

      const menu = await screen.findByRole('navigation', { name: 'Mostrador' });

      expect(
        within(menu).getByRole('link', { name: 'Mostrador' }).getAttribute('aria-current'),
      ).toBe('page');
      expect(
        within(menu).getByRole('link', { name: 'Turno' }).getAttribute('aria-current'),
      ).toBeNull();
    });

    it('keeps the shift marked while the shift is being closed', async () => {
      await online('/mostrador/turno/cerrar');

      const menu = await screen.findByRole('navigation', { name: 'Mostrador' });

      expect(within(menu).getByRole('link', { name: 'Turno' }).getAttribute('aria-current')).toBe(
        'page',
      );
    });
  });

  describe('the state of the sending', () => {
    it('says it in every screen of the counter', async () => {
      await online('/mostrador/turno', new FakeSyncEngine({ attention: 2 }));

      expect(await screen.findByText('2 requieren atención')).toBeDefined();
    });
  });

  describe('for a person who came in with a connection', () => {
    it('goes back to the administration, and offers no way to sign in again', async () => {
      await online();

      const link = await screen.findByRole('link', { name: 'Administración' });

      expect(link.getAttribute('href')).toBe('/');
      expect(screen.queryByRole('link', { name: 'Entrar con contraseña' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cambiar de persona' })).toBeNull();
    });
  });

  describe('for a person who resumed the counter without a connection', () => {
    it('offers to sign in with the password, and to change person, but not to go to the administration', async () => {
      await resumed();

      const login = await screen.findByRole('link', { name: 'Entrar con contraseña' });

      expect(login.getAttribute('href')).toBe('/ingresar');
      expect(screen.getByRole('button', { name: 'Cambiar de persona' })).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull();
    });

    it('lets go of the person on changing, keeps what was saved and goes to sign in', async () => {
      const { local } = await resumed();

      fireEvent.click(await screen.findByRole('button', { name: 'Cambiar de persona' }));

      await waitFor(() => {
        expect(local.workspace.current()).toBeNull();
      });
      // Soltar a la persona y navegar son dos pasos: se espera al segundo en vez de suponer que ya paso.
      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      });
      expect(local.stores.forgotten).toEqual([]);
      expect(local.stores.dataOf('ana').pending).toBe(2);
      expect(local.pointer.get()).toBe('ana');
    });
  });
});
