import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { settle } from '../../../test/support/connection';
import { deferred } from '../../../test/support/deferred';
import { createTestSelling, item, type TestSelling } from '../../../test/support/fake-selling';
import { renderScreen } from '../../../test/support/screens';
import { PayPage } from './PayPage';

const arroz = item(1, {
  name: 'Arroz 500 g',
  unitPrice: 3_200,
  taxRateBp: 1_900,
  taxKind: 'taxed',
});
const aceite = item(2, {
  name: 'Aceite 1 L',
  unitPrice: 12_500,
  taxRateBp: 1_900,
  taxKind: 'taxed',
});
const pan = item(3, { name: 'Pan tajado', unitPrice: 2_800, taxRateBp: 1_900, taxKind: 'taxed' });

/** La venta del diseno: 2 arroz, 1 aceite con $ 500 de descuento y 3 panes = $ 26.800. */
function fill(t: TestSelling) {
  t.selling.add(arroz);
  t.selling.add(arroz);
  t.selling.add(aceite);
  t.selling.setDiscount(aceite.id, 500);
  t.selling.add(pan);
  t.selling.add(pan);
  t.selling.add(pan);
}

async function mount(options: { cart?: boolean } = {}) {
  const t = await createTestSelling();
  if (options.cart !== false) fill(t);
  const view = renderScreen(<PayPage />, {
    local: t.local,
    shifts: t.shifts,
    selling: t.selling,
    copy: t.copy,
    sync: t.sync,
    path: '/mostrador/cobrar',
  });
  return { ...view, t };
}

const received = () => screen.getByLabelText('Efectivo recibido');
const typeReceived = (text: string) => {
  fireEvent.change(received(), { target: { value: text } });
};
const confirm = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Confirmar venta' });

describe('PayPage', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(<PayPage />, { path: '/mostrador/cobrar' });

    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('goes back to the sale when there is nothing to charge', async () => {
    await mount({ cart: false });

    await waitFor(() => {
      expect(screen.getByTestId('ruta').textContent).toBe('/mostrador');
    });
  });

  describe('what is asked', () => {
    it('says the total to charge, how many products, and that the tax is already inside', async () => {
      await mount();

      expect(await screen.findByText('Total a cobrar')).toBeDefined();
      expect(screen.getByText('$ 26.800')).toBeDefined();
      expect(screen.getByText('3 productos · IVA incluido')).toBeDefined();
    });

    it('offers the three ways to pay, with cash chosen', async () => {
      await mount();

      const group = await screen.findByRole('radiogroup', { name: 'Forma de pago' });
      const options = within(group).getAllByRole('radio');

      expect(options.map((option) => option.getAttribute('aria-label') ?? option.id)).toHaveLength(
        3,
      );
      expect(within(group).getByRole('radio', { name: 'Efectivo' })).toHaveProperty(
        'checked',
        true,
      );
      expect(within(group).getByRole('radio', { name: 'Tarjeta' })).toHaveProperty(
        'checked',
        false,
      );
      expect(within(group).getByRole('radio', { name: 'Transferencia' })).toHaveProperty(
        'checked',
        false,
      );
    });

    it('goes back to the sale', async () => {
      await mount();

      const back = await screen.findByRole('link', { name: 'Volver a la venta' });

      expect(back.getAttribute('href')).toBe('/mostrador');
    });
  });

  describe('in cash', () => {
    it('asks for what the customer hands over, and offers to touch the exact amount or the next bills', async () => {
      await mount();

      expect(await screen.findByLabelText('Efectivo recibido')).toBeDefined();
      expect(screen.getByText('Lo que te entrega quien compra.')).toBeDefined();
      const chips = screen.getByRole('group', { name: 'Montos rápidos' });
      expect(
        within(chips)
          .getAllByRole('button')
          .map((chip) => chip.textContent),
      ).toEqual(['Exacto', '$ 30.000', '$ 50.000']);
      expect(received().getAttribute('inputmode')).toBe('numeric');
    });

    it('does not let the sale be confirmed until the cash covers the total', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');

      expect(confirm().disabled).toBe(true);
      expect(screen.queryByText('Vuelto')).toBeNull();
    });

    it('says how much is missing, in the field, and keeps the sale from being confirmed', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');

      typeReceived('25000');

      expect(received().getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Faltan $ 1.800 para completar el total.')).toBeDefined();
      expect(confirm().disabled).toBe(true);
    });

    it('does not charge, and goes to the field, when the form is sent with cash that does not cover the total', async () => {
      const { t } = await mount();
      await screen.findByLabelText('Efectivo recibido');
      typeReceived('1000');

      fireEvent.submit(received().closest('form') as HTMLFormElement);
      await settle();

      expect(t.local.stores.dataOf('ana').queue).toHaveLength(1);
      expect(t.selling.current().receipt).toBeNull();
      expect(document.activeElement).toBe(received());
    });

    it('says what is wrong with what was written, when it is not pesos', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');

      typeReceived('30.000');

      expect(screen.getByText('Escribe el efectivo en pesos, solo con números.')).toBeDefined();
      expect(confirm().disabled).toBe(true);
    });

    it('says the change when the cash covers the total, and lets the sale be confirmed', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');

      typeReceived('30000');

      const change = screen.getByRole('group', { name: 'Vuelto' });
      expect(within(change).getByText('$ 3.200')).toBeDefined();
      expect(confirm().disabled).toBe(false);
      expect(received().getAttribute('aria-invalid')).toBeNull();
    });

    it('says a change of zero for the exact amount', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');

      typeReceived('26800');

      expect(within(screen.getByRole('group', { name: 'Vuelto' })).getByText('$ 0')).toBeDefined();
    });

    it('fills in what is touched: the exact amount, or a bill', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');

      fireEvent.click(screen.getByRole('button', { name: 'Exacto' }));
      expect(received()).toHaveProperty('value', '26800');

      fireEvent.click(screen.getByRole('button', { name: '$ 50.000' }));
      expect(received()).toHaveProperty('value', '50000');
      expect(
        within(screen.getByRole('group', { name: 'Vuelto' })).getByText('$ 23.200'),
      ).toBeDefined();
    });

    it('charges, saves the sale and shows the receipt', async () => {
      const { t } = await mount();
      await screen.findByLabelText('Efectivo recibido');
      typeReceived('30000');

      fireEvent.click(confirm());

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/comprobante');
      });
      const queue = t.local.stores.dataOf('ana').queue;
      expect(queue.map((operation) => operation.kind)).toEqual(['shift-open', 'sale']);
      expect(queue[1]?.body).toMatchObject({
        folio: 'AA-000001',
        total: 26_800,
        payments: [{ method: 'cash', amount: 26_800, reference: null }],
      });
      expect(t.selling.current().receipt).toMatchObject({
        payment: { received: 30_000, change: 3_200 },
      });
    });

    it('says it is saving while it saves, and does not take the same tap twice', async () => {
      const { t } = await mount();
      await screen.findByLabelText('Efectivo recibido');
      typeReceived('30000');
      const saving = deferred<undefined>();
      const real = t.selling.confirm.bind(t.selling);
      let calls = 0;
      t.selling.confirm = async (payment) => {
        calls += 1;
        await saving.promise;
        return await real(payment);
      };

      fireEvent.click(confirm());

      const busy = await screen.findByRole<HTMLButtonElement>('button', { name: 'Guardando…' });
      expect(busy.disabled).toBe(true);
      expect(received().hasAttribute('disabled')).toBe(true);
      for (const radio of screen.getAllByRole('radio'))
        expect(radio.matches(':disabled')).toBe(true);
      for (const name of ['Exacto', '$ 30.000']) {
        expect(screen.getByRole<HTMLButtonElement>('button', { name }).disabled).toBe(true);
      }
      fireEvent.click(busy);
      expect(calls).toBe(1);
      await act(async () => {
        saving.resolve(undefined);
        await saving.promise;
      });
    });
  });

  describe('with a card or a transfer', () => {
    it('does not ask for cash: it asks for a reference that can be left empty', async () => {
      await mount();

      fireEvent.click(await screen.findByRole('radio', { name: 'Tarjeta' }));

      expect(screen.queryByLabelText('Efectivo recibido')).toBeNull();
      expect(screen.getByLabelText('Referencia (opcional)')).toBeDefined();
      expect(screen.getByText('Los últimos dígitos o el número de aprobación.')).toBeDefined();
      expect(confirm().disabled).toBe(false);
      expect(screen.queryByRole('group', { name: 'Montos rápidos' })).toBeNull();
    });

    it('charges the total, with the reference, and counts it as not cash', async () => {
      const { t } = await mount();
      fireEvent.click(await screen.findByRole('radio', { name: 'Tarjeta' }));
      fireEvent.change(screen.getByLabelText('Referencia (opcional)'), {
        target: { value: 'Visa 4455' },
      });

      fireEvent.click(confirm());

      await waitFor(() => {
        expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/comprobante');
      });
      expect(t.local.stores.dataOf('ana').queue[1]?.body['payments']).toEqual([
        { method: 'card', amount: 26_800, reference: 'Visa 4455' },
      ]);
    });

    it('charges a transfer without a reference', async () => {
      const { t } = await mount();
      fireEvent.click(await screen.findByRole('radio', { name: 'Transferencia' }));

      fireEvent.click(confirm());

      await waitFor(() => {
        expect(t.selling.current().receipt).not.toBeNull();
      });
      expect(t.local.stores.dataOf('ana').queue[1]?.body['payments']).toEqual([
        { method: 'transfer', amount: 26_800, reference: null },
      ]);
    });

    it('says what is wrong with a reference that is too long, and does not charge', async () => {
      const { t } = await mount();
      fireEvent.click(await screen.findByRole('radio', { name: 'Tarjeta' }));
      fireEvent.change(screen.getByLabelText('Referencia (opcional)'), {
        target: { value: 'x'.repeat(101) },
      });

      fireEvent.click(confirm());

      expect(screen.getByLabelText('Referencia (opcional)').getAttribute('aria-invalid')).toBe(
        'true',
      );
      expect(screen.getByText('La referencia es muy larga: 100 letras como máximo.')).toBeDefined();
      expect(document.activeElement).toBe(screen.getByLabelText('Referencia (opcional)'));
      await settle();
      expect(t.local.stores.dataOf('ana').queue).toHaveLength(1);
      expect(t.selling.current().receipt).toBeNull();
    });

    it('takes the mistake of the reference away as soon as it is written again', async () => {
      await mount();
      fireEvent.click(await screen.findByRole('radio', { name: 'Tarjeta' }));
      const field = screen.getByLabelText('Referencia (opcional)');
      fireEvent.change(field, { target: { value: 'x'.repeat(101) } });
      fireEvent.click(confirm());
      expect(screen.getByText('La referencia es muy larga: 100 letras como máximo.')).toBeDefined();

      fireEvent.change(field, { target: { value: 'Visa 4455' } });

      expect(screen.queryByText('La referencia es muy larga: 100 letras como máximo.')).toBeNull();
      expect(field.getAttribute('aria-invalid')).toBeNull();
    });

    it('keeps what was written in each way to pay when the person goes back and forth', async () => {
      await mount();
      await screen.findByLabelText('Efectivo recibido');
      typeReceived('30000');

      fireEvent.click(screen.getByRole('radio', { name: 'Tarjeta' }));
      fireEvent.click(screen.getByRole('radio', { name: 'Efectivo' }));

      expect(received()).toHaveProperty('value', '30000');
    });
  });

  describe('when the sale can not be charged', () => {
    it('says why, and keeps the sale as it was, so it can be tried again', async () => {
      const { t } = await mount();
      await screen.findByLabelText('Efectivo recibido');
      typeReceived('30000');
      await act(async () => {
        await t.shifts.close(50_000);
      });

      fireEvent.click(confirm());

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('No pudimos cobrar la venta');
      expect(alert.textContent).toContain(
        'Abre un turno para vender: cada venta queda en un turno de caja.',
      );
      expect(screen.getByTestId('ruta').textContent).toBe('/mostrador/cobrar');
      expect(t.selling.current().cart.lines).toHaveLength(3);
    });

    it('takes the warning away as soon as the person changes what they wrote', async () => {
      const { t } = await mount();
      await screen.findByLabelText('Efectivo recibido');
      typeReceived('30000');
      await act(async () => {
        await t.shifts.close(50_000);
      });
      fireEvent.click(confirm());
      await screen.findByRole('alert');

      typeReceived('50000');

      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
