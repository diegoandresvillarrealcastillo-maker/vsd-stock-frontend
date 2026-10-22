import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { lastPage } from '../../../test/support/catalog';
import { createFakeInventory, testStockItem } from '../../../test/support/inventory';
import { renderScreen } from '../../../test/support/screens';
import { StockPage } from './StockPage';

const ARROZ = testStockItem({
  productId: 'arroz',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  quantityMilli: 6000,
  minStockMilli: 10_000,
  belowMinimum: true,
});
const AZUCAR = testStockItem({
  productId: 'azucar',
  name: 'Azúcar 1 kg',
  sku: 'AZU-1K',
  unit: 'kilogram',
  quantityMilli: 2500,
  minStockMilli: 5000,
  belowMinimum: true,
});
const ACEITE = testStockItem({
  productId: 'aceite',
  name: 'Aceite 1 L',
  sku: 'ACE-1L',
  unit: 'liter',
  quantityMilli: 24_000,
  minStockMilli: null,
});
const SAL = testStockItem({
  productId: 'sal',
  name: 'Sal 500 g',
  sku: 'SAL-5',
  quantityMilli: 0,
  minStockMilli: 2000,
  belowMinimum: false,
});
const VIEJO = testStockItem({
  productId: 'viejo',
  name: 'Frijol viejo',
  sku: 'FRI-V',
  active: false,
  quantityMilli: 3000,
});
const DEBE = testStockItem({
  productId: 'debe',
  name: 'Panela',
  sku: 'PAN-1',
  quantityMilli: -1500,
});

function setup(
  role: Role = 'owner',
  inventory = createFakeInventory([ARROZ, AZUCAR, ACEITE, SAL, VIEJO, DEBE]),
) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const view = renderScreen(<StockPage />, { path: '/inventario', auth, inventory });
  return { ...view, inventory };
}

const failure = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });
const rows = () =>
  within(screen.getByRole('list', { name: 'Existencias' })).getAllByRole('listitem');
const search = (text: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: text } });
  fireEvent.submit(screen.getByRole('search'));
};

describe('StockPage', () => {
  it('says it is loading while the stock arrives, and then asks for all of it', async () => {
    const { inventory } = setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando existencias');
    await screen.findByText('Arroz 500 g');
    expect(inventory.listStock).toHaveBeenCalledWith({});
  });

  it('shows what there is of each product, in its unit, and its SKU', async () => {
    setup();
    await screen.findByText('Arroz 500 g');

    expect(rows()[0]?.textContent).toContain('6 und');
    expect(rows()[0]?.textContent).toContain('ARR-500 · mínimo 10 und');
    expect(rows()[1]?.textContent).toContain('2,5 kg');
    expect(rows()[1]?.textContent).toContain('AZU-1K · mínimo 5 kg');
    expect(rows()[2]?.textContent).toContain('24 L');
    expect(rows()[3]?.textContent).toContain('0 und');
  });

  it('says when a product has no minimum', async () => {
    setup();
    await screen.findByText('Arroz 500 g');

    expect(rows()[2]?.textContent).toContain('ACE-1L · sin mínimo');
  });

  it('warns about what is below its minimum, in words and not only in color', async () => {
    setup();
    await screen.findByText('Arroz 500 g');

    expect(within(rows()[0]!).getByText('Bajo el mínimo')).toBeDefined();
    expect(within(rows()[1]!).getByText('Bajo el mínimo')).toBeDefined();
    expect(within(rows()[2]!).queryByText('Bajo el mínimo')).toBeNull();
    expect(within(rows()[3]!).queryByText('Bajo el mínimo')).toBeNull();
  });

  it('marks an archived product and a negative stock', async () => {
    setup();
    await screen.findByText('Arroz 500 g');

    expect(within(rows()[4]!).getByText('Archivado')).toBeDefined();
    expect(within(rows()[5]!).getByText('Negativa')).toBeDefined();
    // Cero no es negativo.
    expect(within(rows()[3]!).queryByText('Negativa')).toBeNull();
    expect(rows()[5]?.textContent).toContain('-1,5 und');
    expect(within(rows()[0]!).queryByText('Archivado')).toBeNull();
    expect(within(rows()[0]!).queryByText('Negativa')).toBeNull();
  });

  it('takes the person to the history of the product they choose, and encodes the id', async () => {
    setup('cashier', createFakeInventory([testStockItem({ productId: 'a/b', name: 'Raro' })]));

    const link = await screen.findByRole('link', { name: /Raro/ });

    expect(link.getAttribute('href')).toBe('/inventario/a%2Fb');
  });

  it('lets every role see the stock', async () => {
    setup('cashier');

    expect(await screen.findByText('Arroz 500 g')).toBeDefined();
  });

  describe('looking for a product', () => {
    it('asks for what was typed when the person sends the search', async () => {
      const { inventory } = setup();
      await screen.findByText('Arroz 500 g');

      search('  arroz ');

      await screen.findByText('Arroz 500 g');
      expect(inventory.listStock).toHaveBeenLastCalledWith({ search: 'arroz' });
    });

    it('filters what is below the minimum, and goes back to everything', async () => {
      const { inventory } = setup();
      await screen.findByText('Arroz 500 g');
      expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe(
        'true',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Por debajo del mínimo' }));
      await screen.findByText('Arroz 500 g');
      expect(inventory.listStock).toHaveBeenLastCalledWith({ belowMinimum: true });
      expect(
        screen.getByRole('button', { name: 'Por debajo del mínimo' }).getAttribute('aria-pressed'),
      ).toBe('true');

      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      await screen.findByText('Arroz 500 g');
      expect(inventory.listStock).toHaveBeenLastCalledWith({});
    });

    it('keeps the search when the filter changes', async () => {
      const { inventory } = setup();
      await screen.findByText('Arroz 500 g');
      search('arroz');
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Por debajo del mínimo' }));
      await screen.findByText('Arroz 500 g');

      expect(inventory.listStock).toHaveBeenLastCalledWith({ search: 'arroz', belowMinimum: true });
    });

    it('says there is nothing for that search, and says what was searched', async () => {
      const { inventory } = setup();
      await screen.findByText('Arroz 500 g');
      inventory.listStock.mockResolvedValue(lastPage([]));

      search('zzz');

      expect(await screen.findByText(/No encontramos productos con «zzz»/)).toBeDefined();
    });

    it('says that nothing is below the minimum, which is good news', async () => {
      const { inventory } = setup();
      await screen.findByText('Arroz 500 g');
      inventory.listStock.mockResolvedValue(lastPage([]));

      fireEvent.click(screen.getByRole('button', { name: 'Por debajo del mínimo' }));

      expect(
        await screen.findByText('Ningún producto está por debajo de su mínimo.'),
      ).toBeDefined();
    });

    it('says there is nothing yet when there are no products', async () => {
      setup('owner', createFakeInventory([]));

      expect(await screen.findByText('Todavía no hay productos con existencias.')).toBeDefined();
    });
  });

  describe('paging', () => {
    it('loads more and keeps what was already shown', async () => {
      const inventory = createFakeInventory([]);
      inventory.listStock
        .mockResolvedValueOnce({ items: [ARROZ], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [ACEITE], nextCursor: null });
      setup('owner', inventory);
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText('Aceite 1 L')).toBeDefined();
      expect(screen.getByText('Arroz 500 g')).toBeDefined();
      expect(inventory.listStock).toHaveBeenLastCalledWith({}, 'c1');
      expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    });

    it('says why it could not load more, and lets the person try again', async () => {
      const inventory = createFakeInventory([]);
      inventory.listStock
        .mockResolvedValueOnce({ items: [ARROZ], nextCursor: 'c1' })
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce({ items: [ACEITE], nextCursor: null });
      setup('owner', inventory);
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      expect(await screen.findByText('No pudimos cargar más')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText('Aceite 1 L')).toBeDefined();
      expect(screen.queryByText('No pudimos cargar más')).toBeNull();
    });
  });

  it('says it could not load, and loads again when asked', async () => {
    const inventory = createFakeInventory([ARROZ]);
    inventory.listStock.mockRejectedValueOnce(failure);
    setup('owner', inventory);

    expect(await screen.findByText('No pudimos cargar las existencias')).toBeDefined();
    expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Arroz 500 g')).toBeDefined();
  });
});
