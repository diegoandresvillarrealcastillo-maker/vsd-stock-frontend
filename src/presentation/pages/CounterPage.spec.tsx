import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { COUNTER_RESUME_WINDOW_MS, type LocalProfile } from '../../domain/model/local-profile';
import { formatMoment } from '../../domain/model/moment';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { CounterPage } from './CounterPage';

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

/** Una persona que entro con conexion: la cuenta esta lista y su base abierta. */
async function online({ pending = 0 }: { pending?: number } = {}) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'cashier'));
  const local = createTestLocal();
  local.stores.dataOf('ana').pending = pending;
  const view = renderScreen(<CounterPage />, { auth, local, path: '/mostrador' });
  await waitFor(() => {
    expect(local.workspace.current()?.deviceCode).toBe('AA');
  });
  return { ...view, auth, local };
}

/** Una persona que reanudo el mostrador sin conexion: no hay sesion, solo su registro local. */
async function resumed({ code = 'AA', pending = 0 } = {}) {
  const local = createTestLocal();
  rememberPerson(local, profile);
  local.stores.dataOf('ana').device = { id: 'dev-1', code };
  local.stores.dataOf('ana').pending = pending;
  const view = renderScreen(<CounterPage />, { local, path: '/mostrador' });
  await local.workspace.resume();
  return { ...view, local };
}

describe('CounterPage', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(<CounterPage />, { path: '/mostrador' });

    expect(container.textContent).not.toContain('Mostrador');
  });

  describe('for a person who came in with a connection', () => {
    it('shows who works here, with what role, the code of the device and that nothing waits', async () => {
      await online();

      expect(await screen.findByRole('heading', { level: 1, name: 'Mostrador' })).toBeDefined();
      expect(screen.getByText('Cajero')).toBeDefined();
      expect(screen.getByText('AA')).toBeDefined();
      expect(await screen.findByText('Nada')).toBeDefined();
    });

    it('says in the header which business and which person', async () => {
      await online();

      const header = await screen.findByRole('banner');
      expect(header.textContent).toContain('Tienda La Esquina');
      expect(header.textContent).toContain('Ana Gómez');
    });

    it('counts what waits to be sent, in the singular and in the plural', async () => {
      await online({ pending: 3 });
      expect(await screen.findByText('3 registros')).toBeDefined();
    });

    it('talks in the singular for one', async () => {
      await online({ pending: 1 });
      expect(await screen.findByText('1 registro')).toBeDefined();
    });

    it('goes back to the administration, and offers no way to sign in again', async () => {
      await online();

      const link = await screen.findByRole('link', { name: 'Administración' });

      expect(link.getAttribute('href')).toBe('/');
      expect(screen.queryByRole('link', { name: 'Entrar con contraseña' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Cambiar de persona' })).toBeNull();
    });

    it('does not claim to be offline', async () => {
      await online();

      await screen.findByRole('heading', { name: 'Mostrador' });
      expect(screen.queryByText(/sin conexión\. Puedes seguir hasta/)).toBeNull();
    });
  });

  describe('for a person who resumed the counter without a connection', () => {
    it('says it is working offline and until when it can go on: seventy-two hours after the last confirmation', async () => {
      await resumed();
      const until = formatMoment(
        new Date(new Date(profile.verifiedAt).getTime() + COUNTER_RESUME_WINDOW_MS),
      );

      const text = (await screen.findByText(/Estás trabajando sin conexión/)).textContent;

      expect(text).toContain(`Puedes seguir hasta el ${until}`);
      expect(text).toContain('después hay que entrar con la contraseña');
    });

    it('offers to sign in with the password, and to change person, but not to go to the administration', async () => {
      await resumed();

      const login = await screen.findByRole('link', { name: 'Entrar con contraseña' });

      expect(login.getAttribute('href')).toBe('/ingresar');
      expect(screen.getByRole('button', { name: 'Cambiar de persona' })).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull();
    });

    it('lets go of the person on changing, keeps what was saved and goes to sign in', async () => {
      const { local } = await resumed({ pending: 2 });

      fireEvent.click(await screen.findByRole('button', { name: 'Cambiar de persona' }));

      await waitFor(() => {
        expect(local.workspace.current()).toBeNull();
      });
      expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      expect(local.stores.forgotten).toEqual([]);
      expect(local.stores.dataOf('ana').pending).toBe(2);
      expect(local.pointer.get()).toBe('ana');
    });

    it('shows the device as not registered, without offering to register it: that needs a connection', async () => {
      const local = createTestLocal();
      rememberPerson(local, profile);
      renderScreen(<CounterPage />, { local, path: '/mostrador' });
      await local.workspace.resume();

      expect(await screen.findByText('Sin registrar')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull();
    });
  });

  it('offers to register the device when a connected person has not registered it yet', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testMe('ana', 'cashier'));
    const local = createTestLocal();
    local.registry.failNext = new Error('sin red');
    renderScreen(<CounterPage />, { auth, local, path: '/mostrador' });

    fireEvent.click(await screen.findByRole('button', { name: 'Registrar' }));

    await waitFor(() => {
      expect(local.workspace.current()?.deviceCode).toBe('AA');
    });
    expect(await screen.findByText('AA')).toBeDefined();
  });
});
