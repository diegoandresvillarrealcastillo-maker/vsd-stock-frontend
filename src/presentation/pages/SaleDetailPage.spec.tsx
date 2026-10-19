import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Product } from '../../domain/model/catalog';
import { formatMoment } from '../../domain/model/moment';
import type { Role } from '../../domain/model/permissions';
import type { SaleDetail } from '../../domain/model/sales-history';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { copiedProduct } from '../../../test/support/fake-copy';
import { createFakePeople, testPerson } from '../../../test/support/people';
import { FakeReadCopy } from '../../../test/support/read-copy';
import { createFakeSalesHistory, testSaleDetail } from '../../../test/support/sales';
import { renderScreen } from '../../../test/support/screens';
import { FakeShifts, openState } from '../../../test/support/shifts';
import { SaleDetailPage } from './SaleDetailPage';

const arroz: Product = copiedProduct(1, { id: 'p-arroz', name: 'Arroz 500 g', unit: 'unit' });
const pan: Product = copiedProduct(2, { id: 'p-pan', name: 'Pan tajado', unit: 'unit' });

const wireProblem = (code: string, status: number) =>
  new ApiError({
    class: 'permanent',
    status,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: code,
      status,
      detail: 'texto del servidor',
      instance: '/v1/sales/sale-1',
      code,
      traceId: 't-1',
    },
    retryAfterMs: null,
  });

interface MountOptions {
  role?: Role;
  sale?: Partial<SaleDetail>;
  stock?: Record<string, number>;
  sales?: ReturnType<typeof createFakeSalesHistory>;
  shifts?: FakeShifts;
  /** El servidor no da la venta. */
  failWith?: ApiError;
}

function mount(options: MountOptions = {}) {
  const role = options.role ?? 'owner';
  const sales = options.sales ?? createFakeSalesHistory();
  if (options.failWith === undefined) {
    sales.get.mockImplementation(() => Promise.resolve(testSaleDetail(options.sale)));
  } else {
    sales.get.mockRejectedValue(options.failWith);
  }
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const copy = new FakeReadCopy({ status: 'ready' }, [arroz, pan]);
  copy.hold([arroz, pan], options.stock ?? {});
  const people = createFakePeople([
    testPerson({ id: 'u-ana', fullName: 'Ana Gómez' }),
    testPerson({ id: 'u-luis', fullName: 'Luis Pérez' }),
  ]);
  const view = renderScreen(
    <Routes>
      <Route path="/mostrador/ventas/:saleId" element={<SaleDetailPage />} />
    </Routes>,
    {
      auth,
      sales,
      copy,
      people,
      shifts: options.shifts ?? new FakeShifts(openState()),
      path: '/mostrador/ventas/sale-1',
    },
  );
  return { ...view, sales };
}

const heading = () => screen.findByRole('heading', { level: 1 });
const card = () => screen.findByRole('group', { name: 'Comprobante' });
const row = (container: HTMLElement, label: string) =>
  within(container).getByText(label).nextSibling?.textContent;

describe('SaleDetailPage', () => {
  it('asks for the sale of the address', async () => {
    const { sales } = mount();

    await heading();

    expect(sales.get).toHaveBeenCalledWith('sale-1');
  });

  it('names the sale by its folio, says where it is, when and by whom, and the shift if it is this one', async () => {
    mount({ sale: { shiftId: openState().shift.shiftId } });

    expect((await heading()).textContent).toBe('Venta AA-000141');
    expect(screen.getByText('Enviada')).toBeDefined();
    expect(screen.getByText('3:10 p. m. · Ana Gómez · Turno de las 8:02 a. m.')).toBeDefined();
  });

  it('does not say the shift when it is another one: it can not be known from here', async () => {
    mount();

    await heading();

    expect(screen.getByText('3:10 p. m. · Ana Gómez')).toBeDefined();
  });

  it('lists what was sold with the names the device knows, each line with what it cost', async () => {
    mount();

    const receipt = await card();

    expect(row(receipt, '2 × Arroz 500 g')).toBe('$ 6.400');
    expect(row(receipt, '3 × Pan tajado')).toBe('$ 8.400');
  });

  it('says a product that the device does not know by what it is, without inventing its name', async () => {
    mount({
      sale: {
        lines: [
          {
            productId: 'p-viejo',
            quantityMilli: 1_000,
            unitPrice: 5_000,
            discount: 0,
            taxRateBp: 0,
          },
        ],
        payments: [{ method: 'cash', amount: 5_000, reference: null }],
        total: 5_000,
        summary: { total: 5_000, base: 5_000, tax: 0, byRate: [] },
      },
    });

    expect(row(await card(), '1 × Producto')).toBe('$ 5.000');
  });

  it('says the discount of a line in its sentence, and the unit of what is weighed', async () => {
    const queso = copiedProduct(3, { id: 'p-queso', name: 'Queso', unit: 'kilogram' });
    const { copy } = mount({
      sale: {
        lines: [
          {
            productId: 'p-queso',
            quantityMilli: 1_500,
            unitPrice: 8_000,
            discount: 500,
            taxRateBp: 0,
          },
        ],
        payments: [{ method: 'cash', amount: 11_500, reference: null }],
        total: 11_500,
        summary: { total: 11_500, base: 11_500, tax: 0, byRate: [] },
      },
    });
    copy.hold([queso]);

    expect(row(await card(), '1,5 kg × Queso (− $ 500)')).toBe('$ 11.500');
  });

  it('splits the tax of each rate that has tax, and says the total', async () => {
    mount();

    const receipt = await card();

    expect(row(receipt, 'Base sin IVA')).toBe('$ 12.437');
    expect(row(receipt, 'IVA 19 % incluido')).toBe('$ 2.363');
    expect(row(receipt, 'Total')).toBe('$ 14.800');
    expect(within(receipt).queryByText(/IVA 0 %/)).toBeNull();
  });

  it('says how it was paid, with the reference of a card or a transfer', async () => {
    mount({
      sale: {
        payments: [
          { method: 'cash', amount: 10_000, reference: null },
          { method: 'card', amount: 4_800, reference: 'Visa 4455' },
        ],
      },
    });

    const receipt = await card();

    expect(row(receipt, 'Efectivo')).toBe('$ 10.000');
    expect(row(receipt, 'Tarjeta · Visa 4455')).toBe('$ 4.800');
  });

  describe('what happened to it', () => {
    it('says nothing of a clean sale', async () => {
      mount();

      await heading();

      expect(screen.queryByText('Qué pasó')).toBeNull();
    });

    it('says what the server found strange, in sentences', async () => {
      mount({ sale: { attention: true, needsAdjustment: true, flags: ['late-shift'] } });

      await heading();

      expect(screen.getByText('Qué pasó')).toBeDefined();
      expect(
        screen.getByText(
          'Se vendió sin existencias. La venta es válida; falta ajustar la existencia.',
        ),
      ).toBeDefined();
      expect(screen.getByText('Se vendió después de que el turno se cerró.')).toBeDefined();
      expect(screen.getByText('Requiere atención')).toBeDefined();
    });

    it('says who reviewed it and what they wrote, once it was reviewed', async () => {
      const reviewedAt = new Date(2026, 9, 19, 16, 0);
      mount({
        sale: {
          needsAdjustment: true,
          review: { reviewedAt, reviewedByUserId: 'u-luis', note: 'Se ajustó el inventario' },
        },
      });

      await heading();

      expect(screen.getByText('Revisada')).toBeDefined();
      expect(
        screen.getByText(
          `Revisada el ${formatMoment(reviewedAt)} por Luis Pérez. Nota: Se ajustó el inventario.`,
        ),
      ).toBeDefined();
    });

    it('does not repeat the full stop when what they wrote already ends with one', async () => {
      const voidedAt = new Date(2026, 9, 19, 16, 20);
      mount({
        sale: {
          voided: {
            voidedAt,
            voidedByUserId: 'u-luis',
            operationId: 'op-void',
            reason: 'Se equivocó el cajero.',
          },
        },
      });

      await heading();

      expect(
        screen.getByText(
          `Anulada el ${formatMoment(voidedAt)} por Luis Pérez. Motivo: Se equivocó el cajero.`,
        ),
      ).toBeDefined();
    });

    it('says who reviewed it even when they wrote nothing', async () => {
      const reviewedAt = new Date(2026, 9, 19, 16, 0);
      mount({ sale: { review: { reviewedAt, reviewedByUserId: 'u-luis', note: null } } });

      await heading();

      expect(
        screen.getByText(`Revisada el ${formatMoment(reviewedAt)} por Luis Pérez.`),
      ).toBeDefined();
    });

    it('says who voided it, when and why, and offers nothing more to do with it', async () => {
      const voidedAt = new Date(2026, 9, 19, 16, 20);
      mount({
        sale: {
          voided: {
            voidedAt,
            voidedByUserId: 'u-luis',
            operationId: 'op-void',
            reason: 'El cliente se arrepintió',
          },
        },
      });

      await heading();

      expect(screen.getByText('Anulada')).toBeDefined();
      expect(
        screen.getByText(
          `Anulada el ${formatMoment(voidedAt)} por Luis Pérez. Motivo: El cliente se arrepintió.`,
        ),
      ).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Anular venta' })).toBeNull();
    });

    it('says another person of the business when it does not know who it was', async () => {
      const voidedAt = new Date(2026, 9, 19, 16, 20);
      mount({
        sale: {
          voided: { voidedAt, voidedByUserId: 'u-nadie', operationId: 'op-void', reason: 'Error' },
        },
      });

      await heading();

      expect(
        screen.getByText(`Anulada el ${formatMoment(voidedAt)} por Otra persona. Motivo: Error.`),
      ).toBeDefined();
    });
  });

  describe('what can be done', () => {
    it('offers to void it to whoever can, and leads to where it is done', async () => {
      mount({ role: 'owner' });

      const link = await screen.findByRole('link', { name: 'Anular venta' });

      expect(link.getAttribute('href')).toBe('/mostrador/ventas/sale-1/anular');
    });

    it('offers it to an administrator, who is also management', async () => {
      mount({ role: 'admin' });

      expect(await screen.findByRole('link', { name: 'Anular venta' })).toBeDefined();
    });

    it('offers nothing to a cashier: they can look at their sale and nothing else', async () => {
      mount({ role: 'cashier', sale: { attention: true, needsAdjustment: true } });

      await heading();

      expect(screen.queryByRole('link', { name: 'Anular venta' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Marcar como revisada' })).toBeNull();
      expect(screen.queryByRole('link', { name: /Ajustar la existencia/ })).toBeNull();
    });

    it('leads to adjusting the stock of the product that is left without, when the sale went below zero', async () => {
      mount({
        sale: { attention: true, needsAdjustment: true },
        stock: { 'p-arroz': 12_000, 'p-pan': -2_000 },
      });

      const link = await screen.findByRole('link', { name: 'Ajustar la existencia de Pan tajado' });

      expect(link.getAttribute('href')).toBe('/inventario/p-pan/ajustar');
      expect(screen.queryByRole('link', { name: /Arroz/ })).toBeNull();
    });

    it('offers every product of the sale when it can not tell which one is left without', async () => {
      mount({ sale: { attention: true, needsAdjustment: true } });

      expect(
        await screen.findByRole('link', { name: 'Ajustar la existencia de Arroz 500 g' }),
      ).toBeDefined();
      expect(
        screen.getByRole('link', { name: 'Ajustar la existencia de Pan tajado' }),
      ).toBeDefined();
    });

    it('offers nothing to adjust when every product has stock again, but still lets it be reviewed', async () => {
      mount({
        sale: { attention: true, needsAdjustment: true },
        stock: { 'p-arroz': 12_000, 'p-pan': 5_000 },
      });

      expect(await screen.findByRole('button', { name: 'Marcar como revisada' })).toBeDefined();
      expect(screen.queryByRole('link', { name: /Ajustar la existencia/ })).toBeNull();
    });

    it('offers only the products it does not know when the others are known to have stock', async () => {
      mount({
        sale: { attention: true, needsAdjustment: true },
        stock: { 'p-arroz': 12_000 },
      });

      expect(
        await screen.findByRole('link', { name: 'Ajustar la existencia de Pan tajado' }),
      ).toBeDefined();
      expect(screen.queryByRole('link', { name: /Arroz/ })).toBeNull();
    });

    it('offers a product once, even when it was sold in two lines', async () => {
      mount({
        sale: {
          attention: true,
          needsAdjustment: true,
          lines: [
            {
              productId: 'p-pan',
              quantityMilli: 1_000,
              unitPrice: 2_800,
              discount: 0,
              taxRateBp: 0,
            },
            {
              productId: 'p-pan',
              quantityMilli: 2_000,
              unitPrice: 2_800,
              discount: 0,
              taxRateBp: 0,
            },
          ],
          payments: [{ method: 'cash', amount: 8_400, reference: null }],
          total: 8_400,
          summary: { total: 8_400, base: 8_400, tax: 0, byRate: [] },
        },
      });

      await screen.findByRole('link', { name: 'Ajustar la existencia de Pan tajado' });

      expect(screen.getAllByRole('link', { name: /Ajustar la existencia/ })).toHaveLength(1);
    });

    it('does not offer to adjust the stock of a sale that did not go below zero', async () => {
      mount({ sale: { attention: true, flags: ['late-shift'] } });

      await heading();

      expect(screen.queryByRole('link', { name: /Ajustar la existencia/ })).toBeNull();
    });

    it('goes back to the sales', async () => {
      mount();

      const link = await screen.findByRole('link', { name: 'Volver a las ventas' });

      expect(link.getAttribute('href')).toBe('/mostrador/ventas');
    });
  });

  describe('reviewing it', () => {
    it('is offered only for what is in the tray', async () => {
      mount({ sale: { attention: false } });

      await heading();

      expect(screen.queryByRole('button', { name: 'Marcar como revisada' })).toBeNull();
    });

    it('sends the note that was written, and says it was reviewed, and asks again how many are left', async () => {
      const sales = createFakeSalesHistory();
      sales.attentionCount.mockResolvedValue({ count: 1, more: false });
      mount({ sales, sale: { attention: true, needsAdjustment: true } });
      fireEvent.change(await screen.findByLabelText('Nota (opcional)'), {
        target: { value: '  Se ajustó  el inventario ' },
      });
      await waitFor(() => {
        expect(sales.attentionCount).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Marcar como revisada' }));

      expect(await screen.findByText('La venta quedó revisada.')).toBeDefined();
      expect(sales.review).toHaveBeenCalledWith('sale-1', 'Se ajustó el inventario');
      expect(sales.get).toHaveBeenCalledTimes(2);
      await waitFor(() => {
        expect(sales.attentionCount).toHaveBeenCalledTimes(2);
      });
    });

    it('sends no note when none was written', async () => {
      const { sales } = mount({ sale: { attention: true } });

      fireEvent.click(await screen.findByRole('button', { name: 'Marcar como revisada' }));

      await screen.findByText('La venta quedó revisada.');
      expect(sales.review).toHaveBeenCalledWith('sale-1', null);
    });

    it('does not send a note that is too long, and says so', async () => {
      const { sales } = mount({ sale: { attention: true } });
      fireEvent.change(await screen.findByLabelText('Nota (opcional)'), {
        target: { value: 'x'.repeat(201) },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Marcar como revisada' }));

      expect(screen.getByText('Es muy largo: 200 letras como máximo.')).toBeDefined();
      expect(screen.getByLabelText('Nota (opcional)').getAttribute('aria-invalid')).toBe('true');
      expect(sales.review).not.toHaveBeenCalled();
    });

    it('says what went wrong when the server did not take it, and lets it be tried again', async () => {
      const { sales } = mount({ sale: { attention: true } });
      sales.review.mockRejectedValueOnce(wireProblem('sale-not-found', 404));

      fireEvent.click(await screen.findByRole('button', { name: 'Marcar como revisada' }));

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Esa venta no existe en tu negocio.',
      );
      expect(screen.getByRole('button', { name: 'Marcar como revisada' })).toBeDefined();
    });
  });

  describe('when it can not be read', () => {
    it('says that the sale is not there, in words, and lets the sales be reached from there', async () => {
      mount({ failWith: wireProblem('sale-not-found', 404) });

      expect(await screen.findByText('No pudimos cargar la venta')).toBeDefined();
      expect(screen.getByText('Esa venta no existe en tu negocio.')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver a las ventas' })).toBeDefined();
    });

    it('asks again when told to, and shows the sale if the server answers this time', async () => {
      const { sales } = mount({ failWith: wireProblem('sale-not-found', 404) });
      await screen.findByText('No pudimos cargar la venta');
      sales.get.mockImplementation(() => Promise.resolve(testSaleDetail()));

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect((await heading()).textContent).toBe('Venta AA-000141');
      expect(sales.get).toHaveBeenCalledTimes(2);
    });

    it('waits while it loads, saying so', async () => {
      const sales = createFakeSalesHistory();
      sales.get.mockReturnValue(new Promise(() => undefined));
      renderScreen(
        <Routes>
          <Route path="/mostrador/ventas/:saleId" element={<SaleDetailPage />} />
        </Routes>,
        {
          sales,
          auth: (() => {
            const auth = createTestAuth({ stored: testSession('ana') });
            auth.answer(testMe('ana', 'owner'));
            return auth;
          })(),
          path: '/mostrador/ventas/sale-1',
        },
      );

      expect(await screen.findByText('Cargando la venta…')).toBeDefined();
    });
  });
});
