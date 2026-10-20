import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { deferred } from '../../../test/support/deferred';
import { createTestLocal } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { StorageNotice } from './StorageNotice';

function mount(prepare: (local: ReturnType<typeof createTestLocal>) => void = () => undefined) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'cashier'));
  const local = createTestLocal();
  prepare(local);
  const view = renderScreen(<StorageNotice />, { auth, local });
  return { ...view, auth, local };
}

describe('StorageNotice', () => {
  it('shows nothing when everything is fine', async () => {
    const { local, container } = mount();
    await waitFor(() => {
      expect(local.workspace.current()?.deviceCode).toBe('AA');
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(container.textContent).not.toContain('registrado');
  });

  it('says what to do when the browser can not keep encrypted data', async () => {
    mount((local) => {
      local.stores.failOpen = new Error('sin IndexedDB');
    });

    const notice = await screen.findByRole('status');

    expect(notice.textContent).toContain('no puede guardar datos de forma segura');
    expect(notice.textContent).toContain('el mostrador sin conexión no estará disponible');
  });

  describe('when the device could not be registered', () => {
    const failing = (local: ReturnType<typeof createTestLocal>) => {
      local.registry.failNext = new ApiError({
        class: 'network',
        status: null,
        problem: null,
        retryAfterMs: null,
      });
    };

    it('says the device is not registered yet and lets the person try again', async () => {
      const { local } = mount(failing);
      const notice = await screen.findByRole('status');
      expect(notice.textContent).toContain('Este equipo todavía no está registrado');

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      await waitFor(() => {
        expect(screen.queryByRole('status')).toBeNull();
      });
      expect(local.workspace.current()?.deviceCode).toBe('AA');
    });
  });

  describe('when the key of what was saved is lost', () => {
    const lost = (pending: number) => (local: ReturnType<typeof createTestLocal>) => {
      local.stores.dataOf('ana').pending = pending;
      local.stores.keyLostFor = 'ana';
    };

    it('says how many records can not be read, and does nothing until the person decides', async () => {
      const { local } = mount(lost(4));

      const notice = await screen.findByRole('status');

      expect(notice.textContent).toContain('quedaron 4 registros sin enviar');
      expect(local.stores.forgotten).toEqual([]);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('talks in the singular for one record', async () => {
      mount(lost(1));

      const notice = await screen.findByRole('status');

      expect(notice.textContent).toContain('quedaron 1 registro sin enviar');
    });

    it('asks to confirm, and keeps everything if the person cancels', async () => {
      const { local } = mount(lost(2));
      await screen.findByRole('status');

      fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
      const dialog = await screen.findByRole('alertdialog', { name: '¿Empezar de nuevo?' });
      expect(dialog.textContent).toContain('Se pierden 2 registros');
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(local.stores.forgotten).toEqual([]);
    });

    it('throws away what can not be read and starts over when the person confirms', async () => {
      const { local } = mount(lost(2));
      await screen.findByRole('status');
      local.stores.keyLostFor = null;

      fireEvent.click(screen.getByRole('button', { name: 'Empezar de nuevo' }));
      fireEvent.click(
        await screen.findByRole('button', { name: 'Descartarlos y empezar de nuevo' }),
      );

      await waitFor(() => {
        expect(local.workspace.current()).not.toBeNull();
      });
      expect(local.stores.forgotten).toEqual(['ana']);
      await waitFor(() => {
        expect(screen.queryByRole('status')).toBeNull();
      });
    });
  });

  it('says nothing while the device is being registered: it has not failed yet', async () => {
    const registering = deferred<undefined>();
    const { local } = mount((prepared) => {
      prepared.registry.holdNext = registering.promise.then(() => undefined);
    });
    await waitFor(() => {
      expect(local.registry.calls).toHaveLength(1);
    });

    expect(screen.queryByRole('status')).toBeNull();

    registering.resolve(undefined);
    await waitFor(() => {
      expect(local.workspace.current()?.deviceCode).toBe('AA');
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
