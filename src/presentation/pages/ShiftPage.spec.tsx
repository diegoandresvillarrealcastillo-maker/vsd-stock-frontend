import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DeviceNotRegisteredError,
  NoWorkspaceError,
  ShiftAlreadyOpenError,
} from '../../domain/model/local-errors';
import type { LocalProfile } from '../../domain/model/local-profile';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { deferred } from '../../../test/support/deferred';
import { createTestLocal, rememberPerson } from '../../../test/support/local';
import { renderScreen } from '../../../test/support/screens';
import { FakeShifts, closedState, openState } from '../../../test/support/shifts';
import type { ShiftState } from '../../domain/ports/in/shifts';
import { ShiftPage } from './ShiftPage';

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

/** La pantalla de una persona que reanudo el mostrador sin conexion, con el dispositivo ya registrado. */
async function mount(state: ShiftState, options: { registered?: boolean } = {}) {
  const shifts = new FakeShifts(state);
  const local = createTestLocal();
  rememberPerson(local, profile);
  if (options.registered !== false) local.stores.dataOf('ana').device = { id: 'dev-1', code: 'AA' };
  const view = renderScreen(<ShiftPage />, { local, shifts, path: '/mostrador/turno' });
  await local.workspace.resume();
  return { ...view, shifts, local };
}

const field = () => screen.getByLabelText('Efectivo inicial');
const type = (text: string) => {
  fireEvent.change(field(), { target: { value: text } });
};
const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Abrir turno' }));
};

describe('ShiftPage', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(<ShiftPage />, { path: '/mostrador/turno' });

    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  describe('while it reads what is saved', () => {
    it('says it is loading, in a region that is announced', async () => {
      await mount({ status: 'loading' });

      expect(await screen.findByRole('status')).toBeDefined();
      expect(screen.getByText('Cargando el turno…')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
    });

    it('says it could not read it, offers to try again, and does not offer to open a shift', async () => {
      const { shifts } = await mount({ status: 'failed' });

      expect(await screen.findByRole('alert')).toBeDefined();
      expect(screen.getByText('No pudimos leer el turno de este equipo')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(shifts.refreshes).toBe(1);
    });
  });

  describe('when there is no shift', () => {
    it('asks for the cash that is in the drawer', async () => {
      await mount({ status: 'none' });

      expect(await screen.findByRole('heading', { level: 1, name: 'Turno de caja' })).toBeDefined();
      expect(
        screen.getByText('No tienes un turno abierto. Ábrelo con el efectivo que hay en la caja.'),
      ).toBeDefined();
      expect(field()).toBeDefined();
      expect(
        screen.getByText('Cuéntalo antes de empezar. Si la caja está vacía, escribe 0.'),
      ).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abrir turno' })).toBeDefined();
      expect(field().getAttribute('inputmode')).toBe('numeric');
      expect(field().getAttribute('aria-required')).toBe('true');
    });

    it('opens the shift with the cash that was written', async () => {
      const { shifts } = await mount({ status: 'none' });
      await screen.findByLabelText('Efectivo inicial');

      type('50000');
      submit();

      await waitFor(() => {
        expect(shifts.opened).toEqual([50_000]);
      });
    });

    it('opens with an empty drawer: zero is an amount', async () => {
      const { shifts } = await mount({ status: 'none' });
      await screen.findByLabelText('Efectivo inicial');

      type('0');
      submit();

      await waitFor(() => {
        expect(shifts.opened).toEqual([0]);
      });
    });

    it('shows the shift as soon as it is open', async () => {
      const { shifts } = await mount({ status: 'none' });
      shifts.onOpened = () => {
        shifts.set(openState());
      };
      await screen.findByLabelText('Efectivo inicial');

      type('50000');
      submit();

      expect(await screen.findByText(/Abierto desde las 8:02 a\. m\./)).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
    });

    it.each([
      ['', 'Escribe el efectivo que hay en la caja. Si está vacía, escribe 0.'],
      ['5o.000', 'Escribe el efectivo en pesos, solo con números.'],
      ['50.000', 'Escribe el efectivo en pesos, solo con números.'],
      ['-5', 'Escribe el efectivo en pesos, solo con números.'],
    ])('does not open with %j: it says what is wrong under the field', async (text, message) => {
      const { shifts } = await mount({ status: 'none' });
      await screen.findByLabelText('Efectivo inicial');

      type(text);
      submit();

      const input = field();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText(message)).toBeDefined();
      expect(document.activeElement).toBe(input);
      expect(shifts.opened).toEqual([]);
    });

    it('stops complaining as soon as the person writes again', async () => {
      await mount({ status: 'none' });
      await screen.findByLabelText('Efectivo inicial');
      type('5o');
      submit();
      expect(field().getAttribute('aria-invalid')).toBe('true');

      type('50');

      expect(field().getAttribute('aria-invalid')).toBeNull();
    });

    it('says it is saving while it saves, and does not take the same tap twice', async () => {
      const { shifts } = await mount({ status: 'none' });
      const saving = deferred<undefined>();
      shifts.open = async (amount) => {
        shifts.opened.push(amount);
        await saving.promise;
      };
      await screen.findByLabelText('Efectivo inicial');
      type('50000');

      submit();

      const busy = await screen.findByRole<HTMLButtonElement>('button', { name: 'Guardando…' });
      expect(busy.disabled).toBe(true);
      expect(field().hasAttribute('disabled')).toBe(true);
      fireEvent.click(busy);
      expect(shifts.opened).toEqual([50_000]);
      await act(async () => {
        saving.resolve(undefined);
        await saving.promise;
      });
    });

    it('takes the warning away as soon as the person writes again', async () => {
      const { shifts } = await mount({ status: 'none' });
      shifts.failNext = new Error('disco lleno');
      await screen.findByLabelText('Efectivo inicial');
      type('50000');
      submit();
      await screen.findByRole('alert');

      type('5000');

      expect(screen.queryByRole('alert')).toBeNull();
    });

    it.each([
      [new ShiftAlreadyOpenError(), 'Ya hay un turno abierto en este equipo.'],
      [
        new DeviceNotRegisteredError(),
        'Este equipo todavía no está registrado. Conéctate a internet una vez para registrarlo.',
      ],
      [new NoWorkspaceError(), 'Nadie está trabajando en este equipo. Entra de nuevo.'],
      [new Error('disco lleno'), 'No pudimos completar esto.'],
    ])('tells why the shift was not opened: %s', async (error, message) => {
      const { shifts } = await mount({ status: 'none' });
      shifts.failNext = error;
      await screen.findByLabelText('Efectivo inicial');
      type('50000');

      submit();

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain(message);
      expect(alert.textContent).not.toContain('disco lleno');
    });
  });

  describe('when the server does not know this device yet', () => {
    it('does not ask for the cash: the shift could not be sent, and says what to do', async () => {
      await mount({ status: 'none' }, { registered: false });

      expect(await screen.findByText('Este equipo todavía no está registrado')).toBeDefined();
      expect(
        screen.getByText('Conéctate a internet una vez para registrarlo y poder abrir el turno.'),
      ).toBeDefined();
      expect(screen.queryByLabelText('Efectivo inicial')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Abrir turno' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull();
    });

    it('does not offer to register it while it is being registered', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testMe('ana', 'cashier'));
      const local = createTestLocal();
      const registering = deferred<undefined>();
      local.registry.holdNext = registering.promise.then(() => undefined);
      renderScreen(<ShiftPage />, {
        auth,
        local,
        shifts: new FakeShifts({ status: 'none' }),
        path: '/mostrador/turno',
      });
      await waitFor(() => {
        expect(local.registry.calls).toHaveLength(1);
      });

      expect(await screen.findByText('Este equipo todavía no está registrado')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull();

      registering.resolve(undefined);
      expect(await screen.findByLabelText('Efectivo inicial')).toBeDefined();
    });

    it('offers to register it when there is a connection', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testMe('ana', 'cashier'));
      const local = createTestLocal();
      local.registry.failNext = new Error('sin red');
      renderScreen(<ShiftPage />, {
        auth,
        local,
        shifts: new FakeShifts({ status: 'none' }),
        path: '/mostrador/turno',
      });

      fireEvent.click(await screen.findByRole('button', { name: 'Registrar' }));

      await waitFor(() => {
        expect(local.workspace.current()?.deviceCode).toBe('AA');
      });
      expect(await screen.findByLabelText('Efectivo inicial')).toBeDefined();
    });
  });

  describe('with an open shift', () => {
    it('says since when, and what is expected in the drawer, with what was sold', async () => {
      await mount(
        openState({
          sales: { cashCount: 3, cashAmount: 120_000, otherCount: 2, otherAmount: 48_500 },
        }),
      );

      expect(await screen.findByRole('heading', { level: 1, name: 'Turno de caja' })).toBeDefined();
      expect(
        screen.getByText('Abierto desde las 8:02 a. m. Todo lo que vendas queda en este turno.'),
      ).toBeDefined();
      const summary = screen.getByRole('group', { name: 'Resumen del turno' });
      expect(within(summary).getByText('Efectivo inicial').nextSibling?.textContent).toBe(
        '$ 50.000',
      );
      expect(within(summary).getByText('Ventas en efectivo (3)').nextSibling?.textContent).toBe(
        '$ 120.000',
      );
      expect(within(summary).getByText('Ventas con otro medio (2)').nextSibling?.textContent).toBe(
        '$ 48.500',
      );
      expect(
        within(summary).getByText('Efectivo esperado en la caja').nextSibling?.textContent,
      ).toBe('$ 170.000');
    });

    it('with nothing sold yet, expects only what it was opened with', async () => {
      await mount(openState());

      const summary = await screen.findByRole('group', { name: 'Resumen del turno' });
      expect(within(summary).getByText('Ventas en efectivo (0)').nextSibling?.textContent).toBe(
        '$ 0',
      );
      expect(
        within(summary).getByText('Efectivo esperado en la caja').nextSibling?.textContent,
      ).toBe('$ 50.000');
    });

    it('goes to sell, or to close the shift', async () => {
      await mount(openState());

      const sell = await screen.findByRole('link', { name: 'Ir a vender' });
      const close = screen.getByRole('link', { name: 'Cerrar turno' });

      expect(sell.getAttribute('href')).toBe('/mostrador');
      expect(close.getAttribute('href')).toBe('/mostrador/turno/cerrar');
      expect(screen.queryByLabelText('Efectivo inicial')).toBeNull();
    });

    it('does not say anything about the server while the opening is waiting or accepted', async () => {
      await mount(openState({}, 'confirmed'));

      await screen.findByRole('heading', { name: 'Turno de caja' });
      expect(screen.queryByText(/El servidor no aceptó/)).toBeNull();
    });

    it('says when the server did not accept the opening, and that what is sold is kept here', async () => {
      await mount(openState({}, 'attention'));

      expect(
        await screen.findByText('El servidor no aceptó la apertura de este turno'),
      ).toBeDefined();
      expect(screen.getByText(/lo que vendas se guarda en este equipo/)).toBeDefined();
    });
  });

  describe('with the shift closed', () => {
    it('says when it was opened and closed, what was expected, what was counted and what is missing', async () => {
      await mount(closedState(168_000));

      expect(await screen.findByRole('heading', { level: 1, name: 'Turno cerrado' })).toBeDefined();
      expect(screen.getByText('Abrió a las 8:02 a. m. y cerró a las 6:15 p. m.')).toBeDefined();
      const summary = screen.getByRole('group', { name: 'Resumen del cierre' });
      expect(within(summary).getByText('Esperado en la caja').nextSibling?.textContent).toBe(
        '$ 170.000',
      );
      expect(within(summary).getByText('Contado').nextSibling?.textContent).toBe('$ 168.000');
      expect(within(summary).getByText('Diferencia').nextSibling?.textContent).toBe('− $ 2.000');
    });

    it('says what is over with a plus sign, and a drawer that balances as zero', async () => {
      const { unmount } = await mount(closedState(171_500));
      const over = await screen.findByRole('group', { name: 'Resumen del cierre' });
      expect(within(over).getByText('Diferencia').nextSibling?.textContent).toBe('+ $ 1.500');
      unmount();

      await mount(closedState(170_000));
      const even = await screen.findByRole('group', { name: 'Resumen del cierre' });
      expect(within(even).getByText('Diferencia').nextSibling?.textContent).toBe('$ 0');
    });

    it('says the arqueo is the one of this device while the server does not have the closing', async () => {
      await mount(closedState(168_000, {}, { closing: 'waiting' }));

      expect(await screen.findByText('Falta confirmar con el servidor')).toBeDefined();
      expect(
        screen.getByText(
          'El arqueo definitivo se calcula cuando el servidor reciba todas tus ventas. Mientras tanto, este es el de tu dispositivo.',
        ),
      ).toBeDefined();
    });

    it('says the server has it, once it does', async () => {
      await mount(closedState(168_000, {}, { closing: 'confirmed' }));

      expect(await screen.findByText('El servidor ya tiene este turno')).toBeDefined();
      expect(screen.queryByText('Falta confirmar con el servidor')).toBeNull();
    });

    it('says the server did not accept the closing', async () => {
      await mount(closedState(168_000, {}, { closing: 'attention' }));

      expect(
        await screen.findByText('El servidor no aceptó el cierre de este turno'),
      ).toBeDefined();
    });

    it('offers to open another shift, and shows the form when asked', async () => {
      await mount(closedState());

      fireEvent.click(await screen.findByRole('button', { name: 'Abrir otro turno' }));

      expect(await screen.findByLabelText('Efectivo inicial')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Abrir turno' })).toBeDefined();
      expect(screen.queryByRole('group', { name: 'Resumen del cierre' })).toBeNull();
    });

    it('goes back to the summary when what is on screen turns out to be another shift', async () => {
      const { shifts } = await mount(closedState());
      fireEvent.click(await screen.findByRole('button', { name: 'Abrir otro turno' }));
      await screen.findByLabelText('Efectivo inicial');

      act(() => {
        shifts.set(closedState(100_000, { shiftId: 'a0000000-0000-4000-8000-0000000000ff' }));
      });

      expect(await screen.findByRole('group', { name: 'Resumen del cierre' })).toBeDefined();
      expect(screen.queryByLabelText('Efectivo inicial')).toBeNull();
    });

    it('does not offer another shift while the server does not know this device', async () => {
      await mount(closedState(), { registered: false });

      await screen.findByRole('heading', { name: 'Turno cerrado' });
      expect(screen.getByText('Este equipo todavía no está registrado')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Abrir otro turno' })).toBeNull();
    });
  });

  it('follows the shift as it changes', async () => {
    const { shifts } = await mount(openState());
    await screen.findByText(/Abierto desde las/);

    act(() => {
      shifts.set(closedState());
    });

    expect(await screen.findByRole('heading', { name: 'Turno cerrado' })).toBeDefined();
  });
});
