import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { SaleDetail } from '../../domain/model/sales-history';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeSalesHistory, testSaleDetail } from '../../../test/support/sales';
import { renderScreen } from '../../../test/support/screens';
import { closedState, FakeShifts, openState } from '../../../test/support/shifts';
import { VoidSalePage } from './VoidSalePage';

const wireProblem = (code: string, status: number) =>
  new ApiError({
    class: status === 409 ? 'conflict' : 'permanent',
    status,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: code,
      status,
      detail: 'texto del servidor',
      instance: '/v1/sales/sale-1/void',
      code,
      traceId: 't-1',
    },
    retryAfterMs: null,
  });

const noConnection = new ApiError({
  class: 'network',
  status: null,
  problem: null,
  retryAfterMs: null,
});

const cardOnly: Partial<SaleDetail> = {
  payments: [{ method: 'card', amount: 14_800, reference: 'Visa 4455' }],
};

interface MountOptions {
  sale?: Partial<SaleDetail>;
  shifts?: FakeShifts;
  sales?: ReturnType<typeof createFakeSalesHistory>;
  /** El servidor no da la venta. */
  failWith?: ApiError;
  /** El servidor no contesta nunca: la pantalla se queda cargando. */
  neverAnswers?: boolean;
  /** Un enlace a anular otra venta junto a la pantalla, para probar que al cambiar de venta no queda nada de la anterior. */
  withLinkToAnother?: boolean;
}

function mount(options: MountOptions = {}) {
  const sales = options.sales ?? createFakeSalesHistory();
  if (options.neverAnswers === true) {
    sales.get.mockReturnValue(new Promise(() => undefined));
  } else if (options.failWith === undefined) {
    sales.get.mockImplementation(() => Promise.resolve(testSaleDetail(options.sale)));
  } else {
    sales.get.mockRejectedValue(options.failWith);
  }
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(
    <>
      <Routes>
        <Route path="/mostrador/ventas/:saleId/anular" element={<VoidSalePage />} />
        <Route path="/mostrador/ventas/:saleId" element={<p>el detalle</p>} />
      </Routes>
      {options.withLinkToAnother === true && (
        <Link to="/mostrador/ventas/sale-2/anular">Anular otra</Link>
      )}
    </>,
    {
      auth,
      sales,
      shifts: options.shifts ?? new FakeShifts(openState()),
      path: '/mostrador/ventas/sale-1/anular',
    },
  );
  return { ...view, sales };
}

const heading = () => screen.findByRole('heading', { level: 1 });
const card = () => screen.findByRole('group', { name: 'Qué pasa al anular' });
const row = (container: HTMLElement, label: string) =>
  within(container).getByText(label).nextSibling?.textContent;
const reasonField = () => screen.findByLabelText('Motivo (obligatorio)');
const submit = () => screen.getByRole('button', { name: 'Anular venta' });

describe('VoidSalePage', () => {
  it('asks for the sale of the address', async () => {
    const { sales } = mount();

    await heading();

    expect(sales.get).toHaveBeenCalledWith('sale-1');
  });

  it('names the sale that is going to be voided', async () => {
    mount();

    expect((await heading()).textContent).toBe('Anular la venta AA-000141');
  });

  it('keeps the folio in one piece, so a narrow screen does not break it at the hyphen', async () => {
    mount();

    const title = await heading();

    expect(within(title).getByText('AA-000141').className).toContain('whitespace-nowrap');
  });

  describe('what happens when it is voided', () => {
    it('keeps each amount in one piece, even when what it says is long', async () => {
      mount();

      const receipt = await card();

      expect(within(receipt).getByText('2 productos').className).toContain('whitespace-nowrap');
      expect(within(receipt).getByText('$ 14.800').className).toContain('whitespace-nowrap');
    });

    it('says that the stock goes back, and of how many products', async () => {
      mount();

      expect(row(await card(), 'La existencia vuelve a las bodegas')).toBe('2 productos');
    });

    it('says it in the singular when it is one', async () => {
      mount({
        sale: {
          lines: [
            {
              productId: 'p-pan',
              quantityMilli: 3_000,
              unitPrice: 2_800,
              discount: 0,
              taxRateBp: 0,
            },
          ],
        },
      });

      expect(row(await card(), 'La existencia vuelve a las bodegas')).toBe('1 producto');
    });

    it('says how much cash leaves the till, only the cash of a sale paid in two ways', async () => {
      mount({
        sale: {
          payments: [
            { method: 'cash', amount: 10_000, reference: null },
            { method: 'card', amount: 4_800, reference: 'Visa 4455' },
          ],
        },
      });

      expect(row(await card(), 'Sale de tu caja')).toBe('$ 10.000');
    });

    it('does not talk of the till when nothing was paid in cash', async () => {
      mount({ sale: cardOnly });

      expect(within(await card()).queryByText('Sale de tu caja')).toBeNull();
    });
  });

  describe('the reason', () => {
    it('is asked for, and nothing is sent without it', async () => {
      const { sales } = mount();
      await reasonField();

      fireEvent.click(submit());

      expect(screen.getByText('Escribe por qué se anula la venta.')).toBeDefined();
      expect(screen.getByLabelText('Motivo (obligatorio)').getAttribute('aria-invalid')).toBe(
        'true',
      );
      expect(sales.voidSale).not.toHaveBeenCalled();
    });

    it('is where the keyboard goes when it is missing', async () => {
      mount();
      await reasonField();

      fireEvent.click(submit());

      expect(document.activeElement).toBe(screen.getByLabelText('Motivo (obligatorio)'));
    });

    it('is not kept when the person moves to the voiding of another sale', async () => {
      mount({ withLinkToAnother: true });
      fireEvent.change(await reasonField(), { target: { value: 'Error de la primera' } });

      fireEvent.click(screen.getByRole('link', { name: 'Anular otra' }));

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/ventas/sale-2/anular');
      });
      expect(((await reasonField()) as HTMLInputElement).value).toBe('');
    });

    it('can not be too long, and nothing is sent with it', async () => {
      const { sales } = mount();
      fireEvent.change(await reasonField(), { target: { value: 'x'.repeat(201) } });

      fireEvent.click(submit());

      expect(screen.getByText('Es muy largo: 200 letras como máximo.')).toBeDefined();
      expect(sales.voidSale).not.toHaveBeenCalled();
    });

    it('stops complaining as soon as it is written again', async () => {
      mount();
      await reasonField();
      fireEvent.click(submit());

      fireEvent.change(screen.getByLabelText('Motivo (obligatorio)'), {
        target: { value: 'Error' },
      });

      expect(screen.queryByText('Escribe por qué se anula la venta.')).toBeNull();
    });
  });

  describe('voiding it', () => {
    it('sends the reason as it was written, tidied, with the shift that is open now', async () => {
      const { sales } = mount();
      fireEvent.change(await reasonField(), { target: { value: '  El cliente   se arrepintió ' } });

      fireEvent.click(submit());

      await waitFor(() => {
        expect(sales.voidSale).toHaveBeenCalledTimes(1);
      });
      expect(sales.voidSale).toHaveBeenCalledWith('sale-1', {
        operationId: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        reason: 'El cliente se arrepintió',
        shiftId: openState().shift.shiftId,
      });
    });

    it('repeats the same key when it has to be tried again, so it is never voided twice', async () => {
      const { sales } = mount();
      sales.voidSale.mockRejectedValueOnce(noConnection);
      fireEvent.change(await reasonField(), { target: { value: 'Error' } });
      fireEvent.click(submit());
      await screen.findByRole('alert');

      fireEvent.click(submit());

      await waitFor(() => {
        expect(sales.voidSale).toHaveBeenCalledTimes(2);
      });
      const [first, second] = sales.voidSale.mock.calls.map((call) => call[1].operationId);
      expect(first).toBeDefined();
      expect(second).toBe(first);
    });

    it('goes to the sale, says it was voided and asks again how many need attention', async () => {
      const { sales } = mount();
      await waitFor(() => {
        expect(sales.attentionCount).toHaveBeenCalledTimes(1);
      });
      fireEvent.change(await reasonField(), { target: { value: 'Error' } });

      fireEvent.click(submit());

      await screen.findByText('el detalle');
      expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/ventas/sale-1');
      expect(screen.getByTestId('estado').textContent).toBe(
        JSON.stringify({ notice: 'La venta quedó anulada.' }),
      );
      await waitFor(() => {
        expect(sales.attentionCount).toHaveBeenCalledTimes(2);
      });
    });

    it('says that the cash did not leave again when the server had already voided it', async () => {
      const { sales } = mount();
      sales.voidSale.mockImplementationOnce((saleId, input) =>
        Promise.resolve({
          sale: testSaleDetail({
            id: saleId,
            voided: {
              voidedAt: new Date(2026, 9, 19, 16, 20),
              voidedByUserId: 'u-ana',
              operationId: input.operationId,
              reason: input.reason,
            },
          }),
          replayed: true,
        }),
      );
      fireEvent.change(await reasonField(), { target: { value: 'Error' } });

      fireEvent.click(submit());

      await screen.findByText('el detalle');
      expect(screen.getByTestId('estado').textContent).toBe(
        JSON.stringify({ notice: 'Esa venta ya estaba anulada: el efectivo no salió otra vez.' }),
      );
    });

    it('says what went wrong with the words of the server, and lets it be tried again', async () => {
      const { sales } = mount();
      sales.voidSale.mockRejectedValueOnce(wireProblem('shift-closed', 409));
      fireEvent.change(await reasonField(), { target: { value: 'Error' } });

      fireEvent.click(submit());

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Ese turno ya está cerrado. Abre uno y vuelve a intentarlo.',
      );
      expect(submit().hasAttribute('disabled')).toBe(false);
    });
  });

  describe('the shift the cash comes from', () => {
    it('asks for a shift when there was cash and none is open, and sends nothing', async () => {
      const { sales } = mount({ shifts: new FakeShifts({ status: 'none' }) });

      const link = await screen.findByRole('link', { name: 'Abrir turno' });

      expect(link.getAttribute('href')).toBe('/mostrador/turno');
      expect(screen.getByText('Primero abre un turno')).toBeDefined();
      expect(
        screen.getByText(
          'La venta se pagó con efectivo y ese efectivo sale de la caja de tu turno abierto.',
        ),
      ).toBeDefined();
      expect(submit().hasAttribute('disabled')).toBe(true);
      expect(sales.voidSale).not.toHaveBeenCalled();
    });

    it('sends nothing either when the form is sent by other means than the button', async () => {
      const { sales } = mount({ shifts: new FakeShifts({ status: 'none' }) });
      const field = await reasonField();
      fireEvent.change(field, { target: { value: 'Error' } });

      fireEvent.submit(field.closest('form') as HTMLFormElement);

      expect(sales.voidSale).not.toHaveBeenCalled();
    });

    it('does not take a closed shift for an open one', async () => {
      mount({ shifts: new FakeShifts(closedState()) });

      expect(await screen.findByRole('link', { name: 'Abrir turno' })).toBeDefined();
    });

    it('does not ask for a shift when no cash has to go back, and says there is none', async () => {
      const { sales } = mount({ sale: cardOnly, shifts: new FakeShifts({ status: 'none' }) });
      fireEvent.change(await reasonField(), { target: { value: 'Error' } });

      fireEvent.click(submit());

      await waitFor(() => {
        expect(sales.voidSale).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('link', { name: 'Abrir turno' })).toBeNull();
      expect(sales.voidSale).toHaveBeenCalledWith(
        'sale-1',
        expect.objectContaining({ shiftId: null }) as unknown,
      );
    });
  });

  describe('when it was already voided', () => {
    it('says so and offers no form, only to see the sale', async () => {
      mount({
        sale: {
          voided: {
            voidedAt: new Date(2026, 9, 19, 16, 20),
            voidedByUserId: 'u-ana',
            operationId: 'op-void',
            reason: 'Error',
          },
        },
      });

      expect(await screen.findByText('Esa venta ya estaba anulada')).toBeDefined();
      expect(screen.queryByLabelText('Motivo (obligatorio)')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull();
      expect(screen.getByRole('link', { name: 'Ver la venta' }).getAttribute('href')).toBe(
        '/mostrador/ventas/sale-1',
      );
    });
  });

  describe('when it can not be read', () => {
    it('says that the sale is not there, in words, and lets the sale be reached from there', async () => {
      mount({ failWith: wireProblem('sale-not-found', 404) });

      expect(await screen.findByText('No pudimos cargar la venta')).toBeDefined();
      expect(screen.getByText('Esa venta no existe en tu negocio.')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver a la venta' })).toBeDefined();
    });

    it('asks again when told to, and shows the form if the server answers this time', async () => {
      const { sales } = mount({ failWith: wireProblem('sale-not-found', 404) });
      await screen.findByText('No pudimos cargar la venta');
      sales.get.mockImplementation(() => Promise.resolve(testSaleDetail()));

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect((await heading()).textContent).toBe('Anular la venta AA-000141');
      expect(sales.get).toHaveBeenCalledTimes(2);
    });

    it('waits while it loads, saying so, and can already go back', async () => {
      mount({ neverAnswers: true });

      expect(await screen.findByText('Cargando la venta…')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver a la venta' }).getAttribute('href')).toBe(
        '/mostrador/ventas/sale-1',
      );
    });
  });
});
