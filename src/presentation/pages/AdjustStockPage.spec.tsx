import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeInventory, testStockItem } from '../../../test/support/inventory';
import { renderScreen } from '../../../test/support/screens';
import { AdjustStockPage } from './AdjustStockPage';

const ARROZ = testStockItem({ productId: 'arroz', name: 'Arroz 500 g', quantityMilli: 6000 });
const AZUCAR = testStockItem({
  productId: 'arroz',
  name: 'Azúcar 1 kg',
  unit: 'kilogram',
  quantityMilli: 2500,
});

function setup(inventory = createFakeInventory([ARROZ])) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(
    <Routes>
      <Route path="/inventario/:productId/ajustar" element={<AdjustStockPage />} />
    </Routes>,
    { path: '/inventario/arroz/ajustar', auth, inventory },
  );
  return { ...view, inventory };
}

const problem = (code: string, status: number, errors?: Problem['errors']): Problem => ({
  type: `urn:vsd-stock:problem:${code}`,
  title: 't',
  status,
  detail: 'texto del servidor',
  instance: '/v1/stock-adjustments',
  code,
  traceId: 't-1',
  ...(errors === undefined ? {} : { errors }),
});
const refused = (code: string, status: number, errors?: Problem['errors']) =>
  new ApiError({
    class: status === 409 ? 'conflict' : 'permanent',
    status,
    problem: problem(code, status, errors),
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function fillSubtract() {
  await screen.findByRole('heading', { level: 1, name: 'Ajustar existencia' });
  fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));
  type('Cuánto', '2');
  type('Motivo (obligatorio)', '  Se cayeron dos paquetes ');
}

describe('AdjustStockPage', () => {
  it('says it is loading, and then says what is being adjusted and how much there is', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ajustar existencia' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Arroz 500 g · hoy hay 6 und. Esto agrega un movimiento; no cambia el número a mano.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver al historial' }).getAttribute('href')).toBe(
      '/inventario/arroz',
    );
  });

  it('does not choose for the person whether the adjustment adds or subtracts', async () => {
    setup();
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByRole('radio', { name: 'Sumar' }).hasAttribute('checked')).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Sumar' }).checked).toBe(false);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Restar' }).checked).toBe(false);
  });

  describe('what it says while the person writes', () => {
    it('says what the stock would be, for what is counted in whole units', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });

      expect(screen.getByText('En unidades enteras (und).')).toBeDefined();
      fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));
      type('Cuánto', '2');

      expect(screen.getByText('En unidades enteras (und). Quedarían 4 und.')).toBeDefined();
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));
      expect(screen.getByText('En unidades enteras (und). Quedarían 8 und.')).toBeDefined();
    });

    it('asks for a comma and says what the stock would be, for what is weighed', async () => {
      setup(createFakeInventory([AZUCAR]));
      await screen.findByRole('heading', { level: 1 });

      expect(screen.getByText('En kg. Usa coma para los decimales.')).toBeDefined();
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));
      type('Cuánto', '1,5');

      expect(screen.getByText('En kg. Usa coma para los decimales. Quedarían 4 kg.')).toBeDefined();
    });

    it('does not say what the stock would be before it knows whether it adds or subtracts', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });

      type('Cuánto', '2');

      expect(screen.queryByText(/Quedarían/)).toBeNull();
    });

    it('does not say what the stock would be with a quantity that does not make sense', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));

      type('Cuánto', '2,5');

      expect(screen.queryByText(/Quedarían/)).toBeNull();
    });

    it('says when the stock would be negative', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));

      type('Cuánto', '10');

      expect(screen.getByText('En unidades enteras (und). Quedarían -4 und.')).toBeDefined();
    });
  });

  describe('saving', () => {
    it('sends a subtraction as a negative quantity, with the reason trimmed, and goes back to the history', async () => {
      const { inventory } = setup();
      await fillSubtract();

      save();

      await screen.findByText('/inventario/arroz');
      expect(inventory.adjust).toHaveBeenCalledTimes(1);
      expect(inventory.adjust).toHaveBeenCalledWith({
        operationId: expect.stringMatching(UUID) as string,
        productId: 'arroz',
        deltaMilli: -2000,
        reason: 'Se cayeron dos paquetes',
      });
      expect(screen.getByTestId('estado').textContent).toContain('Ajuste guardado.');
    });

    it('sends an addition as a positive quantity, in thousandths', async () => {
      const { inventory } = setup(createFakeInventory([AZUCAR]));
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));
      type('Cuánto', '1,5');
      type('Motivo (obligatorio)', 'Llegó una caja');

      save();

      await screen.findByText('/inventario/arroz');
      expect(inventory.adjust.mock.calls[0]?.[0].deltaMilli).toBe(1500);
    });

    it('says the adjustment was already registered when the server repeats its answer', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockImplementation((input) =>
        Promise.resolve({
          movement: {
            id: 'm',
            operationId: input.operationId,
            productId: input.productId,
            kind: 'adjustment',
            deltaMilli: input.deltaMilli,
            reason: input.reason,
            createdAt: new Date(),
          },
          replayed: true,
        }),
      );
      setup(inventory);
      await fillSubtract();

      save();

      await screen.findByText('/inventario/arroz');
      expect(screen.getByTestId('estado').textContent).toContain(
        'Ese ajuste ya estaba registrado: la existencia no cambió otra vez.',
      );
    });

    it('does not send twice if the button is pressed again while it is sending', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockReturnValue(new Promise(() => undefined));
      setup(inventory);
      await fillSubtract();

      save();
      const sending = await screen.findByRole('button', { name: 'Enviando…' });
      fireEvent.click(sending);

      expect(inventory.adjust).toHaveBeenCalledTimes(1);
    });

    it('tries again with the same operation id after a failure, so the server never applies it twice', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockRejectedValueOnce(network);
      setup(inventory);
      await fillSubtract();

      save();
      expect(await screen.findByText('No pudimos guardar el ajuste')).toBeDefined();
      save();

      await screen.findByText('/inventario/arroz');
      expect(inventory.adjust).toHaveBeenCalledTimes(2);
      expect(inventory.adjust.mock.calls[1]?.[0].operationId).toBe(
        inventory.adjust.mock.calls[0]?.[0].operationId,
      );
    });

    it('uses a different operation id for each adjustment screen it opens', async () => {
      const first = setup();
      await fillSubtract();
      save();
      await screen.findByText('/inventario/arroz');
      const firstId = first.inventory.adjust.mock.calls[0]?.[0].operationId;
      first.unmount();

      const second = setup();
      await fillSubtract();
      save();
      await screen.findByText('/inventario/arroz');

      expect(second.inventory.adjust.mock.calls[0]?.[0].operationId).not.toBe(firstId);
    });
  });

  describe('what it asks for before sending anything', () => {
    it('asks whether it adds or subtracts, and puts the cursor on the options', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      type('Cuánto', '2');
      type('Motivo (obligatorio)', 'Se cayeron');

      save();

      expect(screen.getByText('Elige si suma o resta.')).toBeDefined();
      expect(document.activeElement?.getAttribute('name')).toBe('sentido');
      expect(inventory.adjust).not.toHaveBeenCalled();
    });

    it('asks for the quantity, and does not accept zero', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));
      type('Motivo (obligatorio)', 'x');

      save();
      expect(screen.getAllByText('Escribe la cantidad.').length).toBeGreaterThan(0);
      expect(document.activeElement?.id).toBe('cantidad');

      type('Cuánto', '0');
      save();

      expect(screen.getAllByText('La cantidad no puede ser cero.').length).toBeGreaterThan(0);
      expect(inventory.adjust).not.toHaveBeenCalled();
    });

    it('does not accept a fraction for what is counted in whole units', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));
      type('Cuánto', '1,5');
      type('Motivo (obligatorio)', 'x');

      save();

      expect(
        screen.getAllByText('Este producto se cuenta por unidades enteras.').length,
      ).toBeGreaterThan(0);
      expect(inventory.adjust).not.toHaveBeenCalled();
    });

    it('requires the reason, which stays written in the history', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));
      type('Cuánto', '2');
      type('Motivo (obligatorio)', '   ');

      save();

      expect(screen.getByText('Escribe el motivo del ajuste.')).toBeDefined();
      expect(document.activeElement?.id).toBe('motivo');
      expect(inventory.adjust).not.toHaveBeenCalled();
    });

    it('does not accept a reason longer than the server accepts', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));
      type('Cuánto', '2');
      type('Motivo (obligatorio)', 'a'.repeat(501));

      save();

      expect(screen.getByText('El motivo es muy largo: 500 letras como máximo.')).toBeDefined();
      expect(inventory.adjust).not.toHaveBeenCalled();
    });

    it('accepts a reason of exactly 500 letters', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));
      type('Cuánto', '2');
      type('Motivo (obligatorio)', 'a'.repeat(500));

      save();

      await screen.findByText('/inventario/arroz');
      expect(inventory.adjust).toHaveBeenCalledTimes(1);
    });

    it('takes the message away when the person starts to fix it', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });
      save();
      expect(screen.getByText('Elige si suma o resta.')).toBeDefined();

      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));

      expect(screen.queryByText('Elige si suma o resta.')).toBeNull();
    });
  });

  describe('when the server refuses', () => {
    it('puts what the server says about each field on that field', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockRejectedValue(
        refused('validation-failed', 400, [
          { pointer: '/deltaMilli', code: 'not-whole', detail: 'No lleva decimales.' },
          { pointer: '/reason', code: 'too-long', detail: 'El motivo es muy largo.' },
        ]),
      );
      setup(inventory);
      await fillSubtract();

      save();

      expect(await screen.findByText('No lleva decimales.')).toBeDefined();
      expect(screen.getByText('El motivo es muy largo.')).toBeDefined();
    });

    it('says the operation id was already used with other data, and offers to see the history', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockRejectedValue(refused('operation-id-reused', 409));
      setup(inventory);
      await fillSubtract();

      save();

      expect(await screen.findByText('No pudimos guardar el ajuste')).toBeDefined();
      expect(
        screen.getByText(
          'Esto ya se había registrado con otros datos. Revisa lo que ya quedó guardado antes de repetirlo.',
        ),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Ver el historial' }).getAttribute('href')).toBe(
        '/inventario/arroz',
      );
    });

    it('says there is no connection and keeps what was written', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockRejectedValue(network);
      setup(inventory);
      await fillSubtract();

      save();

      expect(await screen.findByText('No pudimos guardar el ajuste')).toBeDefined();
      expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
      expect(screen.getByLabelText<HTMLInputElement>('Cuánto').value).toBe('2');
      expect(screen.queryByRole('link', { name: 'Ver el historial' })).toBeNull();
    });
  });

  describe('when it can not load', () => {
    it('says the product does not exist', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.findStock.mockRejectedValue(refused('product-not-found', 404));
      setup(inventory);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'No encontramos ese producto' }),
      ).toBeDefined();
    });

    it('says it could not load, and tries again when asked', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.findStock.mockRejectedValueOnce(network);
      setup(inventory);

      expect(await screen.findByText('No pudimos cargar el producto')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Ajustar existencia' }),
      ).toBeDefined();
    });

    it('does not let the person adjust what it can not see how much there is of', async () => {
      setup(createFakeInventory([]));

      expect(await screen.findByText('No pudimos saber cuánto hay de este producto')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Guardar ajuste' })).toBeNull();
    });
  });

  describe('small things that are easy to get wrong', () => {
    it('does not count the spaces around the reason against the limit', async () => {
      const { inventory } = setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Restar' }));
      type('Cuánto', '2');
      type('Motivo (obligatorio)', `${'a'.repeat(500)}   `);

      save();

      await screen.findByText('/inventario/arroz');
      expect(inventory.adjust).toHaveBeenCalledTimes(1);
    });

    it('does not say what the stock would be for a quantity of zero', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'Sumar' }));

      type('Cuánto', '0');

      expect(screen.queryByText(/Quedarían/)).toBeNull();
    });

    it('takes away why it could not save as soon as the person writes again', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.adjust.mockRejectedValue(network);
      setup(inventory);
      await fillSubtract();
      save();
      await screen.findByText('No pudimos guardar el ajuste');

      type('Motivo (obligatorio)', 'Otro motivo');

      expect(screen.queryByText('No pudimos guardar el ajuste')).toBeNull();
    });
  });
});
