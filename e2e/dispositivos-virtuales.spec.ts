import { expect, test, type Page } from '@playwright/test';
import {
  BASIC_PRODUCTS,
  deviceCodes,
  duplicates,
  openBusiness,
  serverSales,
  serverShiftCash,
  serverShifts,
  serverStock,
} from './support/api';
import { newDevice, seededRandom } from './support/devices';
import { openCounter, openShift, sellCash, signIn, syncStatus, waitForCopy } from './support/app';

const DEVICES = 3;
const SALES_EACH = 5;
const OPENING = 20_000;
// Una corrida que falla se puede volver a vivir con la misma semilla: `E2E_SEED=123 npm run e2e`.
const SEED = Number(process.env['E2E_SEED'] ?? 20261022);

test.describe('varios dispositivos a la vez', () => {
  test(`${String(DEVICES)} devices sell in their own order without a network, each loses the answer of its first batch, and the server ends with every sale once and a cash that adds up`, async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const random = seededRandom(SEED);
    const business = await openBusiness(
      BASIC_PRODUCTS.map((product) => ({ ...product, stock: 200 })),
    );
    const devices = await Promise.all(
      Array.from({ length: DEVICES }, () => newDevice(browser, { serviceWorkers: 'block' })),
    );

    // Cada dispositivo entra, abre su turno y baja la copia, CON conexion (registrar un dispositivo la exige).
    for (const { page } of devices) {
      await signIn(page, business.credentials);
      await openCounter(page);
      await openShift(page, OPENING);
      await waitForCopy(page, 'arroz', 'Arroz 500 g');
    }
    expect(await deviceCodes(business)).toEqual(['AA', 'AB', 'AC']);

    // Se corta la red de TODOS y cada uno vende lo suyo, en el orden y con los productos que le toquen.
    const sold = new Map<string, number>();
    const cashOf = new Map<Page, number>();
    await Promise.all(devices.map(({ context }) => context.setOffline(true)));
    await Promise.all(
      devices.map(async ({ page }) => {
        await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
        let cash = 0;
        for (let sale = 0; sale < SALES_EACH; sale += 1) {
          const product = BASIC_PRODUCTS[Math.floor(random() * BASIC_PRODUCTS.length)]!;
          await sellCash(page, [{ search: product.sku.toLowerCase(), name: product.name }]);
          sold.set(product.name, (sold.get(product.name) ?? 0) + 1);
          cash += product.unitPrice;
        }
        cashOf.set(page, cash);
      }),
    );

    // El primer envio de cada dispositivo LLEGA al servidor pero la respuesta se pierde: el dispositivo cree que fallo y reenvia lo mismo.
    const lost = new Map<Page, number>();
    for (const { page } of devices) {
      lost.set(page, 0);
      await page.route('**/v1/sync', async (route) => {
        if (route.request().method() === 'POST' && lost.get(page) === 0) {
          lost.set(page, 1);
          await route.fetch();
          await route.abort('connectionreset');
          return;
        }
        await route.continue();
      });
    }
    await Promise.all(devices.map(({ context }) => context.setOffline(false)));

    const expected = DEVICES * SALES_EACH;
    await expect
      .poll(async () => (await serverSales(business)).length, { timeout: 90_000 })
      .toBe(expected);
    for (const { page } of devices) {
      await expect(syncStatus(page)).toContainText(/Todo enviado|Nada por enviar/, {
        timeout: 90_000,
      });
    }
    expect([...lost.values()]).toEqual(Array(DEVICES).fill(1));

    // Lo que el servidor tiene: cada venta UNA vez, sin folios repetidos, sin nada que pida atencion.
    const sales = await serverSales(business);
    expect(sales).toHaveLength(expected);
    expect(duplicates(sales.map((sale) => sale.operationId))).toEqual([]);
    expect(duplicates(sales.map((sale) => sale.folio))).toEqual([]);
    expect(new Set(sales.map((sale) => sale.folio.slice(0, 2)))).toEqual(
      new Set(['AA', 'AB', 'AC']),
    );
    expect(
      sales.every((sale) => !sale.folioConflict && !sale.attention && !sale.needsAdjustment),
    ).toBe(true);

    // La existencia es la de antes menos lo vendido, producto por producto.
    const stock = await serverStock(business);
    for (const product of BASIC_PRODUCTS) {
      const item = stock.find((candidate) => candidate.name === product.name);
      expect(item?.quantityMilli, product.name).toBe((200 - (sold.get(product.name) ?? 0)) * 1_000);
    }

    // Y la caja de cada dispositivo cuadra: lo inicial mas lo vendido en efectivo, ni un peso de mas ni de menos.
    const shifts = await serverShifts(business);
    expect(shifts).toHaveLength(DEVICES);
    const expectedTotals = [...cashOf.values()].map((cash) => OPENING + cash).sort((a, b) => a - b);
    const serverTotals: number[] = [];
    for (const shift of shifts) {
      serverTotals.push((await serverShiftCash(business, shift.id)).summary.expectedAmount);
    }
    expect(serverTotals.sort((a, b) => a - b)).toEqual(expectedTotals);

    await Promise.all(devices.map(({ context }) => context.close()));
  });
});
