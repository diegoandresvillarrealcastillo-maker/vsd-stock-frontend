import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoOpenShiftError } from '../../domain/model/local-errors';
import type { LocalProfile } from '../../domain/model/local-profile';
import type { ShiftState } from '../../domain/ports/in/shifts';
import { deferred } from '../../../test/support/deferred';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { FakeShifts, closedState, openState } from '../../../test/support/shifts';
import { CloseShiftPage } from './CloseShiftPage';

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

/** Un shift abierto que espera 170 000 en la caja: 50 000 de fondo y 120 000 cobrados en efectivo. */
const waiting = (): ShiftState =>
  openState({ sales: { cashCount: 3, cashAmount: 120_000, otherCount: 2, otherAmount: 48_500 } });

async function mount(state: ShiftState) {
  const shifts = new FakeShifts(state);
  const local = createTestLocal();
  rememberPerson(local, profile);
  local.stores.dataOf('ana').device = { id: 'dev-1', code: 'AA' };
  const view = renderScreen(<CloseShiftPage />, { local, shifts, path: '/mostrador/turno/cerrar' });
  await local.workspace.resume();
  return { ...view, shifts, local };
}

const field = () => screen.getByLabelText('Efectivo contado');
const type = (text: string) => {
  fireEvent.change(field(), { target: { value: text } });
};
const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar turno' }));
};

describe('CloseShiftPage', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(<CloseShiftPage />, { path: '/mostrador/turno/cerrar' });

    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('says it is loading while it reads what is saved', async () => {
    await mount({ status: 'loading' });

    expect(await screen.findByText('Cargando el turno…')).toBeDefined();
    expect(screen.queryByLabelText('Efectivo contado')).toBeNull();
  });

  describe.each<[string, ShiftState]>([
    ['there is no shift', { status: 'none' }],
    ['the shift is already closed', closedState()],
    ['what is saved could not be read', { status: 'failed' }],
  ])('when %s', (_name, state) => {
    it('says there is nothing to close, and goes back to the shift', async () => {
      await mount(state);

      expect(await screen.findByRole('heading', { level: 1, name: 'Cerrar turno' })).toBeDefined();
      expect(screen.getByText('No tienes un turno abierto que cerrar.')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver al turno' }).getAttribute('href')).toBe(
        '/mostrador/turno',
      );
      expect(screen.queryByLabelText('Efectivo contado')).toBeNull();
    });
  });

  describe('with an open shift', () => {
    it('asks for the cash that is in the drawer', async () => {
      await mount(waiting());

      expect(await screen.findByRole('heading', { level: 1, name: 'Cerrar turno' })).toBeDefined();
      expect(
        screen.getByText(
          'Cuenta el efectivo que hay en la caja y escríbelo. Te decimos si cuadra.',
        ),
      ).toBeDefined();
      expect(
        screen.getByText('Billetes y monedas, sin contar lo que cobraste con otro medio.'),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver al turno' })).toBeDefined();
    });

    it('says nothing about the difference until there is a number', async () => {
      await mount(waiting());
      await screen.findByLabelText('Efectivo contado');

      expect(screen.queryByText(/Esperabas/)).toBeNull();
      type('5o');
      expect(screen.queryByText(/Esperabas/)).toBeNull();
    });

    it('says how much is missing while the person types, and that closing like that is kept on record', async () => {
      await mount(waiting());
      await screen.findByLabelText('Efectivo contado');

      type('168000');

      expect(screen.getByText('Faltan $ 2.000')).toBeDefined();
      expect(
        screen.getByText(
          'Esperabas $ 170.000 y contaste $ 168.000. Si cierras así, queda anotado.',
        ),
      ).toBeDefined();
    });

    it('says how much is over', async () => {
      await mount(waiting());
      await screen.findByLabelText('Efectivo contado');

      type('171500');

      expect(screen.getByText('Sobran $ 1.500')).toBeDefined();
      expect(
        screen.getByText(
          'Esperabas $ 170.000 y contaste $ 171.500. Si cierras así, queda anotado.',
        ),
      ).toBeDefined();
    });

    it('says the drawer balances, with no warning about keeping it on record', async () => {
      await mount(waiting());
      await screen.findByLabelText('Efectivo contado');

      type('170000');

      expect(screen.getByText('La caja cuadra')).toBeDefined();
      expect(screen.getByText('Esperabas $ 170.000 y contaste $ 170.000.')).toBeDefined();
      expect(screen.queryByText(/queda anotado/)).toBeNull();
    });

    it('takes the tone from the difference, and a zero as a count like any other', async () => {
      await mount(waiting());
      await screen.findByLabelText('Efectivo contado');

      type('170000');
      expect(document.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('ok');

      type('0');
      expect(screen.getByText('Faltan $ 170.000')).toBeDefined();
      expect(document.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('warn');
    });

    it('closes the shift with the cash that was counted and goes back to the shift', async () => {
      const { shifts } = await mount(waiting());
      await screen.findByLabelText('Efectivo contado');
      type('168000');

      submit();

      await waitFor(() => {
        expect(shifts.closed).toEqual([168_000]);
      });
      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/turno');
      });
    });

    it('does not flash "nothing to close" while it saves, although the shift is already closed by then', async () => {
      const { shifts } = await mount(waiting());
      const saving = deferred<undefined>();
      shifts.close = async (amount) => {
        shifts.closed.push(amount);
        shifts.set(closedState(amount));
        await saving.promise;
      };
      await screen.findByLabelText('Efectivo contado');
      type('168000');

      submit();

      await screen.findByRole('button', { name: 'Guardando…' });
      expect(screen.queryByText('No tienes un turno abierto que cerrar.')).toBeNull();
      await act(async () => {
        saving.resolve(undefined);
        await saving.promise;
      });
    });

    it.each([
      ['', 'Escribe el efectivo que hay en la caja. Si está vacía, escribe 0.'],
      ['168.000', 'Escribe el efectivo en pesos, solo con números.'],
      ['-1', 'Escribe el efectivo en pesos, solo con números.'],
    ])('does not close with %j: it says what is wrong under the field', async (text, message) => {
      const { shifts } = await mount(waiting());
      await screen.findByLabelText('Efectivo contado');

      type(text);
      submit();

      expect(field().getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText(message)).toBeDefined();
      expect(document.activeElement).toBe(field());
      expect(shifts.closed).toEqual([]);
    });

    it('stops complaining as soon as the person writes again', async () => {
      await mount(waiting());
      await screen.findByLabelText('Efectivo contado');
      type('x');
      submit();
      expect(field().getAttribute('aria-invalid')).toBe('true');

      type('1');

      expect(field().getAttribute('aria-invalid')).toBeNull();
    });

    it('says it is saving while it saves, and does not take the same tap twice', async () => {
      const { shifts } = await mount(waiting());
      const saving = deferred<undefined>();
      shifts.close = async (amount) => {
        shifts.closed.push(amount);
        await saving.promise;
      };
      await screen.findByLabelText('Efectivo contado');
      type('168000');

      submit();

      const busy = await screen.findByRole<HTMLButtonElement>('button', { name: 'Guardando…' });
      expect(busy.disabled).toBe(true);
      expect(field().hasAttribute('disabled')).toBe(true);
      fireEvent.click(busy);
      expect(shifts.closed).toEqual([168_000]);
      await act(async () => {
        saving.resolve(undefined);
        await saving.promise;
      });
    });

    it('takes the warning away as soon as the person writes again', async () => {
      const { shifts } = await mount(waiting());
      shifts.failNext = new Error('disco lleno');
      await screen.findByLabelText('Efectivo contado');
      type('168000');
      submit();
      await screen.findByRole('alert');

      type('16800');

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('stops keeping the form up after a failure: if the shift is closed from elsewhere then, there is nothing to close', async () => {
      const { shifts } = await mount(waiting());
      shifts.failNext = new Error('disco lleno');
      await screen.findByLabelText('Efectivo contado');
      type('168000');
      submit();
      await screen.findByRole('alert');

      act(() => {
        shifts.set(closedState());
      });

      expect(await screen.findByText('No tienes un turno abierto que cerrar.')).toBeDefined();
    });

    it('keeps the form with what the shift expected last, not with what it expected when the screen opened', async () => {
      const { shifts } = await mount(openState());
      const saving = deferred<undefined>();
      shifts.close = async (amount) => {
        shifts.closed.push(amount);
        shifts.set(closedState(amount));
        await saving.promise;
      };
      await screen.findByLabelText('Efectivo contado');
      act(() => {
        shifts.set(waiting());
      });
      type('168000');

      submit();

      await screen.findByRole('button', { name: 'Guardando…' });
      expect(screen.getByText(/Esperabas \$ 170\.000/)).toBeDefined();
      await act(async () => {
        saving.resolve(undefined);
        await saving.promise;
      });
    });

    it('says why the shift was not closed, and stays to try again', async () => {
      const { shifts } = await mount(waiting());
      shifts.failNext = new NoOpenShiftError();
      await screen.findByLabelText('Efectivo contado');
      type('168000');

      submit();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('No pudimos cerrar el turno');
      expect(alert.textContent).toContain('No hay un turno abierto que cerrar.');
      expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/turno/cerrar');
    });
  });

  it('follows the shift: if it is closed from elsewhere, there is nothing left to close', async () => {
    const { shifts } = await mount(waiting());
    await screen.findByLabelText('Efectivo contado');

    act(() => {
      shifts.set(closedState());
    });

    expect(await screen.findByText('No tienes un turno abierto que cerrar.')).toBeDefined();
  });
});
