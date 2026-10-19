import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { QueuedOperation } from '../../domain/model/outbox';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakePeople, testPerson } from '../../../test/support/people';
import { createFakeSalesHistory, testSaleRecord } from '../../../test/support/sales';
import { renderScreen } from '../../../test/support/screens';
import { FakeShifts, openState } from '../../../test/support/shifts';
import { createTestLocal } from '../../../test/support/local';
import { SalesPage } from './SalesPage';

const SHIFT = openState().shift.shiftId;

const sale = (n: number, overrides: Parameters<typeof testSaleRecord>[0] = {}) =>
  testSaleRecord({
    id: `sale-${String(n)}`,
    operationId: `op-${String(n)}`,
    folio: `AA-00014${String(n)}`,
    ...overrides,
  });

const queuedSale = (n: number, overrides: Partial<QueuedOperation> = {}): QueuedOperation => ({
  operationId: `local-${String(n)}`,
  kind: 'sale',
  shiftId: null,
  body: {
    operationId: `local-${String(n)}`,
    shiftId: SHIFT,
    folio: `AB-00000${String(n)}`,
    total: 26_800,
    deviceTime: new Date(2026, 9, 19, 15, 42).toISOString(),
  },
  createdAt: new Date(2026, 9, 19, 15, 42).toISOString(),
  state: 'pending',
  attempts: 0,
  attention: null,
  ...overrides,
});

interface MountOptions {
  role?: Role | null;
  path?: string;
  sales?: ReturnType<typeof createFakeSalesHistory>;
  shifts?: FakeShifts;
  queue?: QueuedOperation[];
}

function mount(options: MountOptions = {}) {
  const role = options.role === undefined ? 'owner' : options.role;
  const sales = options.sales ?? createFakeSalesHistory([sale(1), sale(2)]);
  const auth = createTestAuth(role === null ? {} : { stored: testSession('ana') });
  if (role !== null) auth.answer(testMe('ana', role));
  const local = createTestLocal();
  if (options.queue !== undefined) local.stores.dataOf('ana').queue.push(...options.queue);
  const people = createFakePeople([
    testPerson({ id: 'u-ana', fullName: 'Ana Gómez' }),
    testPerson({ id: 'u-luis', fullName: 'Luis Pérez' }),
  ]);
  const view = renderScreen(<SalesPage />, {
    auth,
    local,
    sales,
    people,
    shifts: options.shifts ?? new FakeShifts(openState()),
    path: options.path ?? '/mostrador/ventas',
  });
  return { ...view, sales, people };
}

const list = () => screen.findByRole('list', { name: 'Ventas' });
const rowOf = async (folio: string) =>
  (await screen.findByText(folio)).closest('li') as HTMLElement;

describe('SalesPage', () => {
  describe('the tabs', () => {
    it('offers the shift, everything and the tray to whoever can see everything', async () => {
      mount({ role: 'owner' });

      const tabs = await screen.findByRole('navigation', { name: 'Qué ventas ver' });

      expect(
        within(tabs).getByRole('link', { name: 'Mi turno' }).getAttribute('aria-current'),
      ).toBe('page');
      expect(
        within(tabs).getByRole('link', { name: 'Todas' }).getAttribute('aria-current'),
      ).toBeNull();
      expect(
        within(tabs)
          .getByRole('link', { name: /Atención/ })
          .getAttribute('href'),
      ).toBe('/mostrador/ventas?vista=atencion');
    });

    it('offers only the shift to a cashier, so there is nothing to choose', async () => {
      mount({ role: 'cashier' });

      await list();

      expect(screen.queryByRole('navigation', { name: 'Qué ventas ver' })).toBeNull();
    });

    it('does not let a cashier get to what is not theirs by writing it in the address', async () => {
      const { sales } = mount({ role: 'cashier', path: '/mostrador/ventas?vista=atencion' });

      await list();

      expect(sales.list).toHaveBeenCalledWith({ view: 'shift', shiftId: SHIFT });
      expect(screen.getByText('Las de tu turno de hoy.')).toBeDefined();
    });

    it('says how many ask for attention in its tab', async () => {
      const sales = createFakeSalesHistory([sale(1)]);
      sales.attentionCount.mockResolvedValue({ count: 3, more: false });
      mount({ sales });

      const tab = await screen.findByRole('link', { name: /Atención/ });

      await waitFor(() => {
        expect(tab.textContent).toBe('Atención 3');
      });
    });
  });

  describe('the sales of the shift', () => {
    it('asks for the ones of the shift of this device, and says that is what it shows', async () => {
      const { sales } = mount();

      await list();

      expect(sales.list).toHaveBeenCalledWith({ view: 'shift', shiftId: SHIFT });
      expect(screen.getByRole('heading', { level: 1, name: 'Ventas' })).toBeDefined();
      expect(screen.getByText('Las de tu turno de hoy.')).toBeDefined();
    });

    it('shows each one with its folio, where it is, when and by whom, and what it was', async () => {
      mount({
        sales: createFakeSalesHistory([
          sale(1, { total: 12_400, attention: true, needsAdjustment: true }),
          sale(2, { userId: 'u-luis', total: 8_500 }),
          sale(3, {
            total: 4_200,
            voided: {
              voidedAt: new Date(2026, 9, 19, 16, 20),
              voidedByUserId: 'u-ana',
              operationId: 'op-void',
              reason: 'Error',
            },
          }),
          sale(4, {
            total: 3_000,
            review: {
              reviewedAt: new Date(2026, 9, 19, 16, 30),
              reviewedByUserId: 'u-ana',
              note: null,
            },
          }),
        ]),
      });

      const first = await rowOf('AA-000141');
      expect(within(first).getByText('Requiere atención')).toBeDefined();
      expect(within(first).getByText('3:10 p. m. · Ana Gómez')).toBeDefined();
      expect(within(first).getByText('$ 12.400')).toBeDefined();
      const second = await rowOf('AA-000142');
      expect(within(second).getByText('Enviada')).toBeDefined();
      expect(within(second).getByText('3:10 p. m. · Luis Pérez')).toBeDefined();
      expect(within(await rowOf('AA-000143')).getByText('Anulada')).toBeDefined();
      expect(within(await rowOf('AA-000144')).getByText('Revisada')).toBeDefined();
    });

    it('leads each one to its detail', async () => {
      mount();

      const link = within(await rowOf('AA-000141')).getByRole('link');

      expect(link.getAttribute('href')).toBe('/mostrador/ventas/sale-1');
    });

    it('says the name of someone it does not know as another person of the business', async () => {
      mount({ sales: createFakeSalesHistory([sale(1, { userId: 'u-nadie' })]) });

      expect(within(await rowOf('AA-000141')).getByText('3:10 p. m. · Otra persona')).toBeDefined();
    });

    it('says the name of a cashier from what is saved here, since they can not see the people', async () => {
      const { people } = mount({ role: 'cashier' });

      await list();

      expect(people.listEveryone).not.toHaveBeenCalled();
      expect(within(await rowOf('AA-000141')).getByText('3:10 p. m. · Ana Gómez')).toBeDefined();
    });

    it('says there are none when there are none', async () => {
      mount({ sales: createFakeSalesHistory([]) });

      expect(await screen.findByText('Todavía no hay ventas en este turno.')).toBeDefined();
      expect(screen.queryByRole('list', { name: 'Ventas' })).toBeNull();
    });

    it('waits while it loads, saying so', async () => {
      const sales = createFakeSalesHistory();
      sales.list.mockReturnValue(new Promise(() => undefined));
      mount({ sales });

      expect(await screen.findByText('Cargando ventas…')).toBeDefined();
    });

    it('does not ask for anything while there is no shift in this device, and says why', async () => {
      const { sales } = mount({ shifts: new FakeShifts({ status: 'none' }) });

      expect(await screen.findByText('Todavía no abriste un turno en este equipo')).toBeDefined();
      expect(sales.list).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'Abrir turno' }).getAttribute('href')).toBe(
        '/mostrador/turno',
      );
    });
  });

  describe('everything and the tray', () => {
    it('asks for every sale of the business', async () => {
      const { sales } = mount({ path: '/mostrador/ventas?vista=todas' });

      await list();

      expect(sales.list).toHaveBeenCalledWith({ view: 'all' });
      expect(screen.getByText('Todas las del negocio, la más nueva primero.')).toBeDefined();
    });

    it('asks for the tray, and says what it is', async () => {
      const { sales } = mount({ path: '/mostrador/ventas?vista=atencion' });

      await list();

      expect(sales.list).toHaveBeenCalledWith({ view: 'attention' });
      expect(
        screen.getByText(
          'Lo que el servidor aceptó marcado o no aceptó, para que alguien lo mire.',
        ),
      ).toBeDefined();
    });

    it('says everything is in order when the tray is empty', async () => {
      mount({
        path: '/mostrador/ventas?vista=atencion',
        sales: createFakeSalesHistory([]),
      });

      expect(await screen.findByText('Todo en orden: ninguna venta pide atención.')).toBeDefined();
    });

    it('says there are none when the business has not sold', async () => {
      mount({ path: '/mostrador/ventas?vista=todas', sales: createFakeSalesHistory([]) });

      expect(await screen.findByText('Todavía no hay ventas.')).toBeDefined();
    });

    it('goes to the tab that is touched', async () => {
      const { sales } = mount();
      await list();

      fireEvent.click(await screen.findByRole('link', { name: 'Todas' }));

      await waitFor(() => {
        expect(sales.list).toHaveBeenCalledWith({ view: 'all' });
      });
      expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/ventas');
    });
  });

  describe('more of them', () => {
    it('asks for the next page and adds it to what is shown', async () => {
      const sales = createFakeSalesHistory();
      sales.list.mockResolvedValueOnce({ items: [sale(1)], nextCursor: 'p2' });
      sales.list.mockResolvedValueOnce({ items: [sale(2)], nextCursor: null });
      mount({ sales });
      await rowOf('AA-000141');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await rowOf('AA-000142')).toBeDefined();
      expect(sales.list).toHaveBeenLastCalledWith({ view: 'shift', shiftId: SHIFT, cursor: 'p2' });
      expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    });
  });

  describe('when the server can not be asked', () => {
    it('says what happened and lets the person try again', async () => {
      const sales = createFakeSalesHistory();
      sales.list.mockRejectedValueOnce(new Error('boom'));
      mount({ sales });

      expect(await screen.findByText('No pudimos cargar las ventas')).toBeDefined();
      sales.list.mockResolvedValue({ items: [sale(1)], nextCursor: null });
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await rowOf('AA-000141')).toBeDefined();
    });
  });

  describe('what is still in this device', () => {
    it('shows the sale that waits to be sent, with its folio, its hour and its total, and not as a link', async () => {
      mount({ queue: [queuedSale(1)] });

      const row = await rowOf('AB-000001');

      expect(within(row).getByText('Por enviar')).toBeDefined();
      expect(within(row).getByText('3:42 p. m. · Ana Gómez')).toBeDefined();
      expect(within(row).getByText('$ 26.800')).toBeDefined();
      expect(within(row).queryByRole('link')).toBeNull();
    });

    it('puts it before the ones the server has', async () => {
      mount({ queue: [queuedSale(1)] });

      await rowOf('AB-000001');
      await list();
      const rows = screen.getAllByRole('listitem');

      expect(rows[0]?.textContent).toContain('AB-000001');
      expect(rows[1]?.textContent).toContain('AA-000141');
    });

    it('does not show a sale that the server already has: it is in the list', async () => {
      mount({
        queue: [queuedSale(1)],
        sales: createFakeSalesHistory([sale(1, { operationId: 'local-1', folio: 'AB-000001' })]),
      });

      await rowOf('AB-000001');

      expect(screen.getAllByText('AB-000001')).toHaveLength(1);
    });

    it('says when the server did not accept it, and where it is shown: the tray', async () => {
      mount({
        path: '/mostrador/ventas?vista=atencion',
        sales: createFakeSalesHistory([]),
        queue: [
          queuedSale(1, {
            state: 'attention',
            attention: { class: 'permanent', status: 400, code: 'unknown-shift' },
          }),
        ],
      });

      const row = await rowOf('AB-000001');

      expect(within(row).getByText('El servidor no la aceptó')).toBeDefined();
    });

    it('keeps the one that the server did not accept among the sales of the shift too', async () => {
      mount({
        sales: createFakeSalesHistory([]),
        queue: [
          queuedSale(1, {
            state: 'attention',
            attention: { class: 'permanent', status: 400, code: 'unknown-shift' },
          }),
        ],
      });

      expect(within(await rowOf('AB-000001')).getByText('El servidor no la aceptó')).toBeDefined();
    });

    it('does not put what waits in the tray: the server has not marked it', async () => {
      mount({
        path: '/mostrador/ventas?vista=atencion',
        sales: createFakeSalesHistory([]),
        queue: [queuedSale(1)],
      });

      expect(await screen.findByText('Todo en orden: ninguna venta pide atención.')).toBeDefined();
      expect(screen.queryByText('AB-000001')).toBeNull();
    });

    it('is shown even when the server can not be asked: it is the only thing that can be seen', async () => {
      const sales = createFakeSalesHistory();
      sales.list.mockRejectedValue(new Error('boom'));
      mount({ sales, queue: [queuedSale(1)] });

      expect(await screen.findByText('No pudimos cargar las ventas')).toBeDefined();
      expect(await rowOf('AB-000001')).toBeDefined();
    });
  });
});
