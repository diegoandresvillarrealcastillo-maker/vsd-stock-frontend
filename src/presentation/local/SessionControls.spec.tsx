import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestLocal } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { SessionControls } from './SessionControls';

async function mount({ pending = 0 }: { pending?: number } = {}) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'cashier'));
  const local = createTestLocal();
  local.stores.dataOf('ana').pending = pending;
  const view = renderScreen(<SessionControls />, { auth, local });
  // La persona ya esta trabajando: su base esta abierta.
  await waitFor(() => {
    expect(local.workspace.current()).not.toBeNull();
  });
  return { ...view, auth, local };
}

const signedIn = (auth: ReturnType<typeof createTestAuth>) => auth.sessions.current() !== null;

describe('SessionControls', () => {
  it('offers the two ways of leaving: changing person and closing the session', async () => {
    await mount();

    expect(screen.getByRole('button', { name: 'Cambiar de persona' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDefined();
  });

  describe('changing person', () => {
    it('ends the session but keeps everything saved of whoever leaves, and remembers who they were', async () => {
      const { auth, local } = await mount({ pending: 3 });

      fireEvent.click(screen.getByRole('button', { name: 'Cambiar de persona' }));

      await waitFor(() => {
        expect(signedIn(auth)).toBe(false);
      });
      await waitFor(() => {
        expect(local.workspace.current()).toBeNull();
      });
      expect(local.stores.forgotten).toEqual([]);
      expect(local.stores.dataOf('ana').pending).toBe(3);
      expect(local.pointer.get()).toBe('ana');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  describe('closing the session', () => {
    it('forgets everything in one step when nothing is waiting, without asking', async () => {
      const { auth, local } = await mount({ pending: 0 });

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      await waitFor(() => {
        expect(signedIn(auth)).toBe(false);
      });
      expect(local.stores.forgotten).toEqual(['ana']);
      expect(local.pointer.get()).toBeNull();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('says how many records are waiting and asks first, deleting nothing yet', async () => {
      const { auth, local } = await mount({ pending: 3 });

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Tienes 3 registros sin enviar',
      });
      expect(dialog.textContent).toContain('Si cierras sesión se pierden.');
      expect(dialog.textContent).toContain('«Cambiar de persona»');
      expect(local.stores.forgotten).toEqual([]);
      expect(signedIn(auth)).toBe(true);
    });

    it('talks in the singular when only one is waiting', async () => {
      await mount({ pending: 1 });

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Tienes 1 registro sin enviar',
      });
      expect(dialog.textContent).toContain('Si cierras sesión se pierde.');
    });

    it('keeps everything when the person cancels', async () => {
      const { auth, local } = await mount({ pending: 3 });
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      await screen.findByRole('alertdialog');

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(local.stores.forgotten).toEqual([]);
      expect(signedIn(auth)).toBe(true);
      expect(local.workspace.current()).not.toBeNull();
    });

    it('forgets what was waiting, and signs out, when the person confirms the loss', async () => {
      const { auth, local } = await mount({ pending: 3 });
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      await screen.findByRole('alertdialog');

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión y perderlos' }));

      await waitFor(() => {
        expect(signedIn(auth)).toBe(false);
      });
      expect(local.stores.forgotten).toEqual(['ana']);
      expect(local.stores.people.has('ana')).toBe(false);
      expect(local.pointer.get()).toBeNull();
    });

    it('does not leave half way: if the base can not be deleted the person stays in and is told', async () => {
      const { auth, local } = await mount({ pending: 0 });
      local.stores.forget = () => Promise.reject(new Error('otra pestaña la tiene abierta'));

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('No pudimos borrar lo guardado en este equipo');
      expect(signedIn(auth)).toBe(true);
    });

    it('also closes a session that has no base open, because there is nothing to lose', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testMe('ana', 'cashier'));
      const local = createTestLocal();
      local.stores.failOpen = new Error('sin IndexedDB');
      renderScreen(<SessionControls />, { auth, local });
      await waitFor(() => {
        expect(auth.loads).toEqual(['ana']);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      await waitFor(() => {
        expect(signedIn(auth)).toBe(false);
      });
      expect(local.stores.forgotten).toEqual([]);
    });
  });
});
