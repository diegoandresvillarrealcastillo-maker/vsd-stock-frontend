import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CounterLockedError } from '../../domain/model/local-errors';
import { COUNTER_RESUME_WINDOW_MS, type LocalProfile } from '../../domain/model/local-profile';
import { formatMoment } from '../../domain/model/moment';
import { createTestLocal, rememberPerson, type TestLocal } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { SignInPage } from '../pages/SignInPage';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const HOUR = 3_600_000;

const profile = (verified: Date): LocalProfile => ({
  authUserId: 'ana',
  email: 'ana@example.com',
  userId: 'u-ana',
  businessId: 'b-1',
  businessName: 'Tienda La Esquina',
  role: 'cashier',
  fullName: 'Ana Gómez',
  verifiedAt: verified.toISOString(),
});

function mount(verified?: Date) {
  const local: TestLocal = createTestLocal(NOW);
  if (verified !== undefined) rememberPerson(local, profile(verified));
  const view = renderScreen(<SignInPage />, { path: '/ingresar', local });
  return { ...view, local };
}

describe('what the sign-in page offers to whoever worked here before', () => {
  it('offers nothing when nobody has worked here', async () => {
    mount();

    await waitFor(() => {
      expect(screen.getByLabelText('Correo')).toBeDefined();
    });
    expect(screen.queryByRole('heading', { name: 'Último en este equipo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continuar sin conexión' })).toBeNull();
  });

  it('names the last person, with their role and business, and puts their email in the field', async () => {
    mount(new Date(NOW.getTime() - 10 * HOUR));

    const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

    expect(panel.textContent).toContain('Ana Gómez · Cajero');
    expect(panel.textContent).toContain('Tienda La Esquina');
    expect(screen.getByLabelText<HTMLInputElement>('Correo').value).toBe('ana@example.com');
  });

  it('lets the person type another email: the person already chosen is only a suggestion', async () => {
    mount(new Date(NOW.getTime() - HOUR));
    await screen.findByRole('region', { name: 'Último en este equipo' });

    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'luis@example.com' } });

    expect(screen.getByLabelText<HTMLInputElement>('Correo').value).toBe('luis@example.com');
  });

  describe('while the seventy-two hours have not passed', () => {
    it('says how long is left and until when, and offers to go on without a connection', async () => {
      const verified = new Date(NOW.getTime() - 30 * HOUR);
      mount(verified);
      const until = formatMoment(new Date(verified.getTime() + COUNTER_RESUME_WINDOW_MS));

      const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

      expect(panel.textContent).toContain('puedes seguir en el mostrador 42 horas más');
      expect(panel.textContent).toContain(`hasta el ${until}`);
      expect(screen.getByRole('button', { name: 'Continuar sin conexión' })).toBeDefined();
    });

    it('says less than an hour when almost nothing is left', async () => {
      mount(new Date(NOW.getTime() - COUNTER_RESUME_WINDOW_MS + 20 * 60_000));

      const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

      expect(panel.textContent).toContain('menos de una hora más');
    });

    it('says one hour, not one hours', async () => {
      mount(new Date(NOW.getTime() - COUNTER_RESUME_WINDOW_MS + HOUR + 60_000));

      const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

      expect(panel.textContent).toContain('1 hora más');
      expect(panel.textContent).not.toContain('1 horas');
    });

    it('opens the counter of the person and goes there', async () => {
      const { local } = mount(new Date(NOW.getTime() - 5 * HOUR));

      fireEvent.click(await screen.findByRole('button', { name: 'Continuar sin conexión' }));

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/mostrador');
      });
      expect(local.workspace.current()).toMatchObject({ resumed: true });
    });

    it('says so, and goes nowhere, if the counter was locked in the meantime', async () => {
      const { local } = mount(new Date(NOW.getTime() - 71 * HOUR - 59 * 60_000));
      const button = await screen.findByRole('button', { name: 'Continuar sin conexión' });
      local.setNow(new Date(NOW.getTime() + 2 * HOUR));

      fireEvent.click(button);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Pasaron más de 72 horas');
      expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
      expect(local.workspace.current()).toBeNull();
    });

    it('says so, and goes nowhere, if what was saved is gone', async () => {
      const { local } = mount(new Date(NOW.getTime() - HOUR));
      const button = await screen.findByRole('button', { name: 'Continuar sin conexión' });
      local.stores.people.delete('ana');

      fireEvent.click(button);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('No encontramos lo que tenías guardado');
      expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
    });
  });

  describe('once the seventy-two hours have passed', () => {
    it('does not offer to go on, explains why and promises that what was saved is kept', async () => {
      mount(new Date(NOW.getTime() - COUNTER_RESUME_WINDOW_MS - HOUR));

      const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

      expect(panel.textContent).toContain('Pasaron más de 72 horas');
      expect(panel.textContent).toContain('Lo que tienes guardado en este equipo se conserva.');
      expect(screen.queryByRole('button', { name: 'Continuar sin conexión' })).toBeNull();
      expect(screen.getByLabelText<HTMLInputElement>('Correo').value).toBe('ana@example.com');
    });

    it('explains a clock that is set back', async () => {
      mount(new Date(NOW.getTime() + 3 * HOUR));

      const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

      expect(panel.textContent).toContain('La hora de este equipo está atrasada');
    });

    it('explains a verification it can not read', async () => {
      const local = createTestLocal(NOW);
      rememberPerson(local, { ...profile(NOW), verifiedAt: 'ayer' });
      renderScreen(<SignInPage />, { path: '/ingresar', local });

      const panel = await screen.findByRole('region', { name: 'Último en este equipo' });

      expect(panel.textContent).toContain('No pudimos leer cuándo fue la última vez');
    });
  });

  describe('when resuming goes wrong', () => {
    it('says why with the reason it really has: a clock that was set back is not an expired window', async () => {
      const { local } = mount(new Date(NOW.getTime() - HOUR));
      const button = await screen.findByRole('button', { name: 'Continuar sin conexión' });
      local.setNow(new Date(NOW.getTime() - 3 * HOUR));

      fireEvent.click(button);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('La hora de este equipo está atrasada');
      expect(alert.textContent).not.toContain('Pasaron más de 72 horas');
    });

    it('says so, and goes nowhere, when it fails for a reason nobody foresaw', async () => {
      const { local } = mount(new Date(NOW.getTime() - HOUR));
      const button = await screen.findByRole('button', { name: 'Continuar sin conexión' });
      vi.spyOn(local.workspace, 'resume').mockRejectedValue(new Error('algo raro'));

      fireEvent.click(button);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('No pudimos abrir lo que tenías guardado');
      expect(screen.getByTestId('ruta').textContent).toBe('/ingresar');
    });

    it('takes the old warning away when the person tries again', async () => {
      const { local } = mount(new Date(NOW.getTime() - HOUR));
      const button = await screen.findByRole('button', { name: 'Continuar sin conexión' });
      vi.spyOn(local.workspace, 'resume')
        .mockRejectedValueOnce(new CounterLockedError('expired'))
        .mockReturnValueOnce(new Promise<void>(() => undefined));
      fireEvent.click(button);
      await screen.findByRole('alert');

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
      });
    });
  });
});
