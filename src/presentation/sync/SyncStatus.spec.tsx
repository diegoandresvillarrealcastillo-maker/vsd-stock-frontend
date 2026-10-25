import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestConnection } from '../../../test/support/connection';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { FakeSyncEngine } from '../../../test/support/sync-engine';
import type { LocalProfile } from '../../domain/model/local-profile';
import type { SyncState } from '../../domain/ports/in/sync-engine';
import { SyncStatus } from './SyncStatus';

const ANA: LocalProfile = {
  authUserId: 'ana',
  email: 'ana@example.com',
  userId: 'u-ana',
  businessId: 'b-1',
  businessName: 'Tienda La Esquina',
  role: 'cashier',
  fullName: 'Ana Gómez',
  verifiedAt: '2026-10-17T10:00:00.000Z',
};

function mount(state: Partial<SyncState> = {}, options: { online?: boolean } = {}) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'cashier'));
  const sync = new FakeSyncEngine(state);
  const connection = createTestConnection({ online: options.online ?? true });
  const view = renderScreen(<SyncStatus />, { auth, sync, connection });
  return { ...view, auth, sync, connection };
}

const region = () => screen.getByRole('status');

describe('SyncStatus', () => {
  describe('when all is well', () => {
    it('says there is nothing to send, and offers nothing to do', () => {
      mount();

      expect(within(region()).getByText('Nada por enviar')).toBeDefined();
      expect(screen.queryByRole('button')).toBeNull();
    });

    it('says nothing but its headline when there is nothing else to say', () => {
      mount();

      expect(region().textContent).toBe('Nada por enviar');
    });

    it('says everything was sent, and when, after the server accepted something', () => {
      mount({ lastSyncedAt: new Date(2026, 9, 19, 15, 30) });

      expect(within(region()).getByText('Todo enviado')).toBeDefined();
      expect(region().textContent).toContain('Última vez: 19 oct, 3:30 p. m.');
    });
  });

  describe('what waits', () => {
    it('says that it is only in this device, when there is no connection', () => {
      mount({ pending: 3 }, { online: false });

      expect(within(region()).getByText('Sin conexión')).toBeDefined();
      expect(region().textContent).toContain(
        '3 registros por enviar. Están guardados solo en este equipo.',
      );
    });

    it('does not say it is connected while it is only checking', () => {
      mount({ pending: 1 });

      expect(within(region()).getByText('Comprobando conexión…')).toBeDefined();
    });

    it('says it is sending, with how many are left', () => {
      mount({ phase: 'sending', pending: 2 });

      expect(within(region()).getByText('Enviando…')).toBeDefined();
      expect(region().textContent).toContain('2 registros por enviar.');
    });
  });

  describe('when sending failed', () => {
    it('says so, says when it will try again and lets the person try now', async () => {
      const { sync, connection } = mount({
        phase: 'waiting',
        pending: 2,
        nextTryAt: new Date(2026, 9, 19, 15, 31),
      });
      await act(async () => {
        await connection.health.succeed();
      });

      expect(within(region()).getByText('No se pudo enviar')).toBeDefined();
      expect(region().textContent).toContain('Vamos a reintentar a las 3:31 p. m.');

      expect(screen.queryByRole('button', { name: 'Entrar de nuevo' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar ahora' }));

      expect(sync.syncNows).toBe(1);
    });
  });

  describe('a card with nothing to add', () => {
    it('does not draw an empty line under its title', () => {
      mount({ phase: 'sending' });

      expect(region().querySelectorAll('p')).toHaveLength(1);
    });
  });

  describe('what needs attention', () => {
    it('says how many the server did not accept', () => {
      mount({ attention: 2 });

      expect(within(region()).getByText('2 requieren atención')).toBeDefined();
      expect(region().textContent).toContain('El servidor no las aceptó.');
    });
  });

  describe('when the session expired', () => {
    it('says that nothing is lost and leaves through the same door as changing person, which keeps everything', async () => {
      const { auth } = mount({ sessionExpired: true, pending: 3 });

      expect(within(region()).getByText('Tu sesión caducó')).toBeDefined();
      expect(region().textContent).toContain('Los registros guardados no se pierden.');

      fireEvent.click(screen.getByRole('button', { name: 'Entrar de nuevo' }));

      await waitFor(() => {
        expect(auth.sessions.current()).toBeNull();
      });
    });
  });

  describe('when the counter was resumed without a connection: nobody entered with a password, so there is no session', () => {
    /** El mostrador reanudado desde «Continuar sin conexión»: hay base abierta y registros por enviar, pero ninguna sesión. */
    async function resumed(state: Partial<SyncState>) {
      const local = createTestLocal();
      rememberPerson(local, ANA);
      local.stores.dataOf('ana').pending = 3;
      await local.workspace.resume();
      const sync = new FakeSyncEngine(state);
      const view = renderScreen(<SyncStatus />, {
        local,
        sync,
        connection: createTestConnection({ online: true }),
      });
      return { ...view, local, sync };
    }

    it('says that the password is missing, not that a session expired: there was none', async () => {
      await resumed({ sessionExpired: true, pending: 3 });

      expect(within(region()).getByText('Falta entrar con tu contraseña')).toBeDefined();
      expect(within(region()).queryByText('Tu sesión caducó')).toBeNull();
      expect(region().textContent).toContain('Entra con tu contraseña para enviarlos.');
      expect(region().textContent).toContain('Los registros guardados no se pierden.');
    });

    it('takes the person to the sign-in page with the button of the card, which does something', async () => {
      await resumed({ sessionExpired: true, pending: 3 });
      expect(screen.getByTestId('ruta').textContent).toBe('/');

      fireEvent.click(screen.getByRole('button', { name: 'Entrar con contraseña' }));

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      });
    });

    it('does not forget what is saved here to get there: the records and the person stay', async () => {
      const { local } = await resumed({ sessionExpired: true, pending: 3 });

      fireEvent.click(screen.getByRole('button', { name: 'Entrar con contraseña' }));

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      });
      expect(local.stores.forgotten).toEqual([]);
      expect(local.pointer.get()).toBe('ana');
      expect(local.workspace.current()).not.toBeNull();
      expect(local.stores.dataOf('ana').pending).toBe(3);
    });

    it('does not offer the button of a person who has a session', async () => {
      await resumed({ sessionExpired: true, pending: 3 });

      expect(screen.queryByRole('button', { name: 'Entrar de nuevo' })).toBeNull();
    });
  });

  describe('while the account is still being asked who the person is', () => {
    it('still has a session to close: the card is the one of a session that expired, and its button closes it', () => {
      // El primer pintado: la sesion existe (se guardo al entrar), `GET /v1/me` todavia no contesto.
      mount({ sessionExpired: true, pending: 1 });

      expect(within(region()).getByText('Tu sesión caducó')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Entrar de nuevo' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Entrar con contraseña' })).toBeNull();
    });
  });

  describe('a button that would do nothing is not offered', () => {
    it('does not offer to try again while it is offline, even if sending failed before', () => {
      mount({ attention: 1, phase: 'waiting', pending: 1 }, { online: false });

      expect(within(region()).getByText('1 requiere atención')).toBeDefined();
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  it('follows the engine and the connection as they change', async () => {
    const { sync, connection } = mount({ pending: 1 });
    expect(within(region()).getByText('Comprobando conexión…')).toBeDefined();

    await act(async () => {
      await connection.health.succeed();
    });
    expect(within(region()).getByText('Por enviar')).toBeDefined();

    act(() => {
      sync.set({ phase: 'sending' });
    });
    expect(within(region()).getByText('Enviando…')).toBeDefined();

    act(() => {
      sync.set({ phase: 'idle', pending: 0, lastSyncedAt: new Date(2026, 9, 19, 15, 32) });
    });
    expect(within(region()).getByText('Todo enviado')).toBeDefined();
  });
});
