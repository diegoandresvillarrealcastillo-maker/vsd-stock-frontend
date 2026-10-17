import { fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Role } from '../../domain/model/permissions';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { lastPage } from '../../../test/support/catalog';
import { createFakeInventory, testMovement, testStockItem } from '../../../test/support/inventory';
import { renderScreen } from '../../../test/support/screens';
import { StockHistoryPage } from './StockHistoryPage';

const ARROZ = testStockItem({ productId: 'arroz', name: 'Arroz 500 g', quantityMilli: 6000 });
const AJUSTE = testMovement({
  id: 'm1',
  kind: 'adjustment',
  deltaMilli: -2000,
  reason: 'Se cayeron dos paquetes',
  createdAt: new Date(2026, 9, 17, 15, 12),
});
const COMPRA = testMovement({
  id: 'm2',
  kind: 'purchase',
  deltaMilli: 24_000,
  reason: 'Pedido de octubre',
  createdAt: new Date(2026, 9, 17, 11, 2),
});
const VENTA = testMovement({
  id: 'm3',
  kind: 'sale',
  deltaMilli: -16_000,
  reason: null,
  createdAt: new Date(2026, 9, 16, 18, 40),
});

function setup(
  role: Role = 'owner',
  inventory = createFakeInventory([ARROZ]),
  state?: unknown,
  movements = [AJUSTE, COMPRA, VENTA],
) {
  inventory.listMovements.mockResolvedValue(lastPage(movements));
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const view = renderScreen(
    <Routes>
      <Route path="/inventario/:productId" element={<StockHistoryPage />} />
    </Routes>,
    { path: '/inventario/arroz', auth, inventory, state },
  );
  return { ...view, inventory };
}

const refused = (code: string) =>
  new ApiError({
    class: 'permanent',
    status: 404,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status: 404,
      detail: 'texto del servidor',
      instance: '/v1/products/arroz',
      code,
      traceId: 't-1',
    } satisfies Problem,
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });
const rows = () => within(screen.getByRole('list', { name: 'Historial' })).getAllByRole('listitem');

describe('StockHistoryPage', () => {
  it('shows the product and what there is of it', async () => {
    const { inventory } = setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Arroz 500 g' })).toBeDefined();
    expect(screen.getByText('Hay 6 und. Cada fila es algo que pasó y no se borra.')).toBeDefined();
    expect(inventory.findStock).toHaveBeenCalledWith('arroz');
    expect(inventory.listMovements).toHaveBeenCalledWith('arroz');
    expect(screen.getByRole('link', { name: 'Volver a existencias' }).getAttribute('href')).toBe(
      '/inventario',
    );
  });

  it('says it is loading while the movements arrive', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    await screen.findByRole('list', { name: 'Historial' });
  });

  it('lists what happened, the newest first as the server sends it, with its sign, its reason and its moment', async () => {
    setup();
    await screen.findByRole('list', { name: 'Historial' });

    expect(rows()).toHaveLength(3);
    expect(rows()[0]?.textContent).toContain('Ajuste');
    expect(rows()[0]?.textContent).toContain('− 2 und');
    expect(rows()[0]?.textContent).toContain('Se cayeron dos paquetes · 17 oct, 3:12 p. m.');
    expect(rows()[1]?.textContent).toContain('Compra');
    expect(rows()[1]?.textContent).toContain('+ 24 und');
    expect(rows()[1]?.textContent).toContain('Pedido de octubre · 17 oct, 11:02 a. m.');
  });

  it('shows only the moment when the movement has no reason', async () => {
    setup();
    await screen.findByRole('list', { name: 'Historial' });

    expect(rows()[2]?.textContent).toContain('Venta');
    expect(rows()[2]?.textContent).toContain('16 oct, 6:40 p. m.');
    expect(rows()[2]?.textContent).not.toContain(' · ');
  });

  it('calls a voided sale by its name', async () => {
    setup('owner', undefined, undefined, [testMovement({ kind: 'void', deltaMilli: 1000 })]);

    await screen.findByRole('list', { name: 'Historial' });

    expect(rows()[0]?.textContent).toContain('Anulación');
  });

  it('writes the quantities in the unit of the product', async () => {
    setup(
      'owner',
      createFakeInventory([
        testStockItem({ productId: 'arroz', unit: 'kilogram', quantityMilli: 2500 }),
      ]),
      undefined,
      [testMovement({ deltaMilli: 1500, kind: 'purchase' })],
    );

    expect(
      await screen.findByText('Hay 2,5 kg. Cada fila es algo que pasó y no se borra.'),
    ).toBeDefined();
    expect(rows()[0]?.textContent).toContain('+ 1,5 kg');
  });

  it('says there is no history yet', async () => {
    setup('owner', undefined, undefined, []);

    expect(await screen.findByText('Este producto todavía no tiene movimientos.')).toBeDefined();
  });

  it('offers the manager to adjust the stock, and encodes the id', async () => {
    setup('admin');

    const link = await screen.findByRole('link', { name: 'Ajustar existencia' });

    expect(link.getAttribute('href')).toBe('/inventario/arroz/ajustar');
  });

  it('does not offer the cashier to adjust the stock', async () => {
    setup('cashier');
    await screen.findByRole('list', { name: 'Historial' });

    expect(screen.queryByRole('link', { name: 'Ajustar existencia' })).toBeNull();
  });

  it('shows the notice that the previous screen left', async () => {
    setup('owner', undefined, { notice: 'Ajuste guardado.' });

    expect(await screen.findByText('Ajuste guardado.')).toBeDefined();
  });

  it('does not show a notice that is not text', async () => {
    setup('owner', undefined, { notice: 3 });
    await screen.findByRole('list', { name: 'Historial' });

    expect(screen.queryByText('3')).toBeNull();
  });

  describe('paging', () => {
    it('loads more, with the cursor of the last page, and keeps what was shown', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.listMovements
        .mockResolvedValueOnce({ items: [AJUSTE], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [COMPRA], nextCursor: null });
      renderScreen(
        <Routes>
          <Route path="/inventario/:productId" element={<StockHistoryPage />} />
        </Routes>,
        { path: '/inventario/arroz', inventory, auth: authAs('owner') },
      );
      await screen.findByText('Ajuste');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText('Compra')).toBeDefined();
      expect(screen.getByText('Ajuste')).toBeDefined();
      expect(inventory.listMovements).toHaveBeenLastCalledWith('arroz', 'c1');
    });
  });

  describe('when something goes wrong', () => {
    it('says the product does not exist', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.findStock.mockRejectedValue(refused('product-not-found'));
      setup('owner', inventory);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'No encontramos ese producto' }),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver a existencias' })).toBeDefined();
    });

    it('says it could not load the stock, and tries again when asked', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.findStock.mockRejectedValueOnce(network);
      setup('owner', inventory);

      expect(await screen.findByText('No pudimos cargar el producto')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Arroz 500 g' })).toBeDefined();
    });

    it('says it could not load the history, and tries again when asked', async () => {
      const inventory = createFakeInventory([ARROZ]);
      inventory.listMovements
        .mockRejectedValueOnce(network)
        .mockResolvedValueOnce(lastPage([AJUSTE]));
      renderScreen(
        <Routes>
          <Route path="/inventario/:productId" element={<StockHistoryPage />} />
        </Routes>,
        { path: '/inventario/arroz', inventory, auth: authAs('owner') },
      );

      expect(await screen.findByText('No pudimos cargar el historial')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('Se cayeron dos paquetes · 17 oct, 3:12 p. m.')).toBeDefined();
    });

    it('still shows the history when it can not tell how much there is', async () => {
      const inventory = createFakeInventory([]);
      setup('owner', inventory);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Historial del producto' }),
      ).toBeDefined();
      expect(screen.getByText('Cada fila es algo que pasó y no se borra.')).toBeDefined();
      expect(rows()[0]?.textContent).toContain('− 2');
      expect(rows()[0]?.textContent).not.toContain('und');
    });
  });
});

function authAs(role: Role) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  return auth;
}
