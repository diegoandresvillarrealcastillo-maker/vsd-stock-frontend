import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoWorkspaceError } from '../../domain/model/local-errors';
import { COUNTER_RESUME_WINDOW_MS, type LocalProfile } from '../../domain/model/local-profile';
import { formatMoment } from '../../domain/model/moment';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { deferred } from '../../../test/support/deferred';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
import { FakeReadCopy } from '../../../test/support/read-copy';
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

    // Nada de la pantalla: solo lo que el montaje de prueba pone para saber donde esta (la ruta y su estado).
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  describe('the catalog this device keeps', () => {
    it('says how many products there are and from when, also without a connection', async () => {
      const local = createTestLocal();
      rememberPerson(local, profile);
      local.stores.dataOf('ana').device = { id: 'dev-1', code: 'AA' };
      const copy = new FakeReadCopy({
        status: 'ready',
        productCount: 42,
        productsAsOf: new Date(2026, 9, 19, 15, 30),
        stockAsOf: new Date(2026, 9, 19, 15, 31),
      });
      renderScreen(<CounterPage />, { local, copy, path: '/mostrador' });
      await local.workspace.resume();

      expect(await screen.findByRole('heading', { name: 'Catálogo en este equipo' })).toBeDefined();
      expect(screen.getByText('42 productos en este equipo')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
      expect(copy.refreshes).toBe(1);
    });
  });

  describe('for a person who came in with a connection', () => {
    it('shows who works here, with what role, the code of the device and that nothing waits', async () => {
      await online();

      expect(await screen.findByRole('heading', { level: 1, name: 'Mostrador' })).toBeDefined();
      expect(screen.getByText('Cajero')).toBeDefined();
      expect(screen.getByText('AA')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull();
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
      // Soltar a la persona y navegar son dos pasos: se espera al segundo en vez de suponer que ya paso (con la maquina cargada no pasa a tiempo).
      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      });
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

  it('does not offer to register the device while it is being registered', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testMe('ana', 'cashier'));
    const local = createTestLocal();
    const registering = deferred<undefined>();
    local.registry.holdNext = registering.promise.then(() => undefined);
    renderScreen(<CounterPage />, { auth, local, path: '/mostrador' });
    await waitFor(() => {
      expect(local.registry.calls).toHaveLength(1);
    });

    expect(await screen.findByText('Sin registrar')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull();

    registering.resolve(undefined);
    expect(await screen.findByText('AA')).toBeDefined();
  });

  it('shows the count of the person who works now, not a late answer for the one before', async () => {
    const local = createTestLocal();
    rememberPerson(local, profile);
    local.stores.dataOf('ana').device = { id: 'dev-1', code: 'AA' };
    const late = deferred<number>();
    // Una respuesta por cada vez que la pantalla pregunta; las que fallan se crean al preguntar, no antes.
    const answers: (() => Promise<number>)[] = [
      () => Promise.reject(new NoWorkspaceError()),
      () => late.promise,
      () => Promise.reject(new NoWorkspaceError()),
      () => Promise.resolve(2),
    ];
    vi.spyOn(local.workspace, 'pendingCount').mockImplementation(
      () => answers.shift()?.() ?? Promise.resolve(0),
    );
    renderScreen(<CounterPage />, { local, path: '/mostrador' });
    await act(async () => {
      await local.workspace.resume();
    });
    await act(async () => {
      await local.workspace.leave();
    });
    await act(async () => {
      await local.workspace.resume();
    });
    expect(await screen.findByText('2 registros')).toBeDefined();

    await act(async () => {
      late.resolve(7);
      await late.promise;
    });

    expect(screen.queryByText('7 registros')).toBeNull();
    expect(screen.getByText('2 registros')).toBeDefined();
  });
});
