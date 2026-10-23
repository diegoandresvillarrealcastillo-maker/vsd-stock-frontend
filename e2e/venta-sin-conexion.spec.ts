import { expect, test } from '@playwright/test';
import { openBusiness, serverSaleLines, serverSales, serverStock } from './support/api';
import { openCounter, openShift, sellCash, signIn, syncStatus, waitForCopy } from './support/app';

test.describe('vender sin conexión', () => {
  test('a sale made with the network cut is kept on this device, says so, and reaches the server once when the network returns', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await openCounter(page);
    await openShift(page, 50_000);
    await waitForCopy(page, 'arroz', 'Arroz 500 g');

    // La red se corta DE VERDAD: ni la pagina ni su service worker llegan a ninguna parte.
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);

    const folio = await sellCash(page, [{ search: 'arroz', name: 'Arroz 500 g' }]);

    // El folio se da al instante, sin preguntar al servidor, y la pantalla dice donde esta la venta: solo en este equipo.
    expect(folio).toBe('AA-000001');
    await expect(syncStatus(page)).toContainText('Sin conexión');
    await expect(syncStatus(page)).toContainText('por enviar');
    expect(await serverSales(business)).toHaveLength(0);

    // Vuelve la red: el motor envia solo, sin que nadie toque nada.
    await context.setOffline(false);
    await expect
      .poll(async () => (await serverSales(business)).length, { timeout: 40_000 })
      .toBe(1);
    await expect(syncStatus(page)).toContainText(/Todo enviado|Nada por enviar/);

    // Lo que el servidor guardo es la venta de este equipo, una sola vez y sin nada raro.
    const [sale] = await serverSales(business);
    expect(sale?.folio).toBe('AA-000001');
    expect(sale?.folioConflict).toBe(false);
    expect(sale?.total).toBe(3_200);
    expect(sale?.attention).toBe(false);
    expect(sale?.needsAdjustment).toBe(false);

    // Y la existencia bajo en el servidor: 100 menos 1.
    const stock = await serverStock(business);
    expect(stock.find((item) => item.name === 'Arroz 500 g')?.quantityMilli).toBe(99_000);
  });

  test('several sales made without a network are sent in order, each once, with their own folio', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await openCounter(page);
    await openShift(page, 0);
    await waitForCopy(page, 'pan', 'Pan tajado');

    await context.setOffline(true);
    const folios = [
      await sellCash(page, [{ search: 'arroz', name: 'Arroz 500 g' }]),
      await sellCash(page, [{ search: 'pan', name: 'Pan tajado' }]),
      await sellCash(page, [{ search: 'leche', name: 'Leche 1 L' }]),
    ];
    expect(folios).toEqual(['AA-000001', 'AA-000002', 'AA-000003']);

    await context.setOffline(false);
    await expect
      .poll(async () => (await serverSales(business)).length, { timeout: 40_000 })
      .toBe(3);

    const sales = await serverSales(business);
    expect(sales.map((sale) => sale.folio).sort()).toEqual(folios);
    expect(sales.map((sale) => sale.total).sort()).toEqual([2_800, 3_200, 4_500]);
    expect(sales.every((sale) => !sale.folioConflict && !sale.attention)).toBe(true);

    // Cada linea llego con el tipo tributario del producto que se vendio (ADR 0034): exento el arroz, gravados el pan y la leche.
    const kinds = new Map<string, string>();
    for (const sale of sales) {
      for (const line of await serverSaleLines(business, sale.id)) {
        kinds.set(line.productId, `${line.taxKind}:${String(line.taxRateBp)}`);
      }
    }
    expect(Object.fromEntries(business.products.map((p) => [p.name, kinds.get(p.id)]))).toEqual({
      'Arroz 500 g': 'exempt:0',
      'Pan tajado': 'taxed:1900',
      'Leche 1 L': 'taxed:500',
    });
  });
});
