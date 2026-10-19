import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LocalProfile } from '../../domain/model/local-profile';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
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
    </Route>
  </Routes>
);

/** Una persona que entro con conexion: la cuenta esta lista y su base abierta. */
async function online(path = '/mostrador', sync = new FakeSyncEngine()) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'cashier'));
  const local = createTestLocal();
  const view = renderScreen(routes, { auth, local, sync, path });
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
    });

    it('marks the counter only on its own screen, not on the ones below it', async () => {
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
      expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      expect(local.stores.forgotten).toEqual([]);
      expect(local.stores.dataOf('ana').pending).toBe(2);
      expect(local.pointer.get()).toBe('ana');
    });
  });
});
