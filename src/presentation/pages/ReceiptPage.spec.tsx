import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatMoment, formatTime } from '../../domain/model/moment';
import type { SalePayment } from '../../domain/model/sale-receipt';
import {
  createTestSelling,
  item,
  saleId,
  type TestSelling,
} from '../../../test/support/fake-selling';
import { renderScreen } from '../../../test/support/screens';
import { ReceiptPage } from './ReceiptPage';

const arroz = item(1, { name: 'Arroz 500 g', unitPrice: 3_200, taxRateBp: 1_900 });
const aceite = item(2, { name: 'Aceite 1 L', unitPrice: 12_500, taxRateBp: 1_900 });
const pan = item(3, { name: 'Pan tajado', unitPrice: 2_800, taxRateBp: 1_900 });
const queso = item(4, { name: 'Queso', unit: 'kilogram', unitPrice: 20_000, taxRateBp: 5_00 });
const harina = item(5, { name: 'Harina', unitPrice: 2_000, taxRateBp: 0 });

/** La venta del diseno ya cobrada: 2 arroz, 1 aceite con $ 500 de descuento y 3 panes = $ 26.800. */
async function sold(payment: SalePayment = { method: 'cash', received: 30_000 }) {
  const t = await createTestSelling();
  t.selling.add(arroz);
  t.selling.add(arroz);
  t.selling.add(aceite);
  t.selling.setDiscount(aceite.id, 500);
  t.selling.add(pan);
  t.selling.add(pan);
  t.selling.add(pan);
  await t.selling.confirm(payment);
  return t;
}

function mount(t: TestSelling) {
  return renderScreen(<ReceiptPage />, {
    local: t.local,
    shifts: t.shifts,
    selling: t.selling,
    copy: t.copy,
    sync: t.sync,
    path: '/mostrador/comprobante',
  });
}

describe('ReceiptPage', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(<ReceiptPage />, { path: '/mostrador/comprobante' });

    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('goes back to the sale when there is no receipt to show', async () => {
    const t = await createTestSelling();
    mount(t);

    await waitFor(() => {
      expect(screen.getByTestId('ruta').textContent).toBe('/mostrador');
    });
  });

  describe('what it says of the sale', () => {
    it('names the sale by its folio, and says it is saved in this device and goes out when it can', async () => {
      const t = await sold();
      mount(t);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Venta AA-000001' }),
      ).toBeDefined();
      expect(
        screen.getByText('Guardada en este equipo. Se envía cuando haya conexión.'),
      ).toBeDefined();
    });

    it('says the server has it once the sale left the queue', async () => {
      const t = await sold();
      mount(t);
      await screen.findByText('Guardada en este equipo. Se envía cuando haya conexión.');

      await act(async () => {
        await t.local.stores.lastStore.resolveOperations([saleId(1)]);
        t.sync.set({ pending: 0, lastSyncedAt: new Date('2026-10-19T14:00:00.000Z') });
      });

      expect(await screen.findByText('Guardada y enviada al servidor.')).toBeDefined();
    });

    it('looks again when only the number of operations waiting changes', async () => {
      const t = await sold();
      t.sync.set({ pending: 1 });
      mount(t);
      await screen.findByText('Guardada en este equipo. Se envía cuando haya conexión.');

      await act(async () => {
        await t.local.stores.lastStore.resolveOperations([saleId(1)]);
        t.sync.set({ pending: 0 });
      });

      expect(await screen.findByText('Guardada y enviada al servidor.')).toBeDefined();
    });

    it('looks again when only the number of operations that need attention changes', async () => {
      const t = await sold();
      mount(t);
      await screen.findByText('Guardada en este equipo. Se envía cuando haya conexión.');

      await act(async () => {
        await t.local.stores.lastStore.markAttention(saleId(1), {
          class: 'permanent',
          status: 400,
          code: 'invalid',
        });
        t.sync.set({ attention: 1 });
      });

      expect(
        await screen.findByText(
          'Guardada en este equipo. El servidor no la aceptó: la gerencia puede revisarla.',
        ),
      ).toBeDefined();
    });

    it('looks at the new sale when the receipt changes under the same screen', async () => {
      const t = await sold();
      mount(t);
      await act(async () => {
        await t.local.stores.lastStore.resolveOperations([saleId(1)]);
        t.sync.set({ lastSyncedAt: new Date('2026-10-19T14:00:00.000Z') });
      });
      await screen.findByText('Guardada y enviada al servidor.');

      await act(async () => {
        t.selling.newSale();
        t.selling.add(arroz);
        await t.selling.confirm({ method: 'cash', received: 3_200 });
      });

      expect(
        await screen.findByText('Guardada en este equipo. Se envía cuando haya conexión.'),
      ).toBeDefined();
    });

    it('says when, who and in which shift', async () => {
      const t = await sold();
      mount(t);

      const when = formatMoment(new Date('2026-10-19T13:02:00.000Z'));
      const since = formatTime(new Date('2026-10-19T13:02:00.000Z'));
      expect(await screen.findByText(`${when} · Ana Gómez · Turno de las ${since}`)).toBeDefined();
    });

    it('lists what was sold, each line with what it cost, the discount in its sentence', async () => {
      const t = await sold();
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });
      const row = (label: string) => within(receipt).getByText(label).nextSibling?.textContent;
      expect(row('2 × Arroz 500 g')).toBe('$ 6.400');
      expect(row('1 × Aceite 1 L (− $ 500)')).toBe('$ 12.000');
      expect(row('3 × Pan tajado')).toBe('$ 8.400');
    });

    it('splits the tax, and says the total', async () => {
      const t = await sold();
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });
      const row = (label: string) => within(receipt).getByText(label).nextSibling?.textContent;
      expect(row('Base sin IVA')).toBe('$ 22.521');
      expect(row('IVA 19 % incluido')).toBe('$ 4.279');
      expect(row('Total')).toBe('$ 26.800');
    });

    it('says what was received in cash, and the change', async () => {
      const t = await sold();
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });
      const row = (label: string) => within(receipt).getByText(label).nextSibling?.textContent;
      expect(row('Efectivo recibido')).toBe('$ 30.000');
      expect(row('Vuelto')).toBe('$ 3.200');
    });

    it('says a card, with its reference, and no change', async () => {
      const t = await sold({ method: 'card', reference: 'Visa 4455' });
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });
      const row = (label: string) => within(receipt).getByText(label).nextSibling?.textContent;
      expect(row('Pagado con tarjeta')).toBe('$ 26.800');
      expect(row('Referencia')).toBe('Visa 4455');
      expect(within(receipt).queryByText('Vuelto')).toBeNull();
      expect(within(receipt).queryByText('Efectivo recibido')).toBeNull();
    });

    it('says a transfer without a reference when there is none', async () => {
      const t = await sold({ method: 'transfer', reference: null });
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });
      expect(within(receipt).getByText('Pagado con transferencia')).toBeDefined();
      expect(within(receipt).queryByText('Referencia')).toBeNull();
    });

    it('leaves out the rate that has no tax, as the sale does', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      t.selling.add(harina);
      await t.selling.confirm({ method: 'cash', received: 10_000 });
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });

      expect(within(receipt).getByText('IVA 19 % incluido')).toBeDefined();
      expect(within(receipt).queryByText(/IVA 0 %/)).toBeNull();
    });

    it('says the unit of what is weighed', async () => {
      const t = await createTestSelling();
      t.selling.add(queso);
      t.selling.setQuantity(queso.id, 1_250);
      await t.selling.confirm({ method: 'cash', received: 30_000 });
      mount(t);

      const receipt = await screen.findByRole('group', { name: 'Comprobante' });
      expect(within(receipt).getByText('1,25 kg × Queso').nextSibling?.textContent).toBe(
        '$ 25.000',
      );
    });

    it('says it is not an invoice', async () => {
      const t = await sold();
      mount(t);

      expect(await screen.findByText('Comprobante de venta — no es factura')).toBeDefined();
      expect(screen.getByText('Es el comprobante de la venta en este equipo.')).toBeDefined();
    });
  });

  describe('starting another sale', () => {
    it('offers it, closes the receipt and goes to the sale', async () => {
      const t = await sold();
      mount(t);

      fireEvent.click(await screen.findByRole('button', { name: 'Nueva venta' }));

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/mostrador');
      });
      expect(t.selling.current().receipt).toBeNull();
    });
  });
});
