import { expect, test } from '@playwright/test';
import { duplicates, openBusiness, serverSales } from './support/api';
import { openCounter, openShift, sellCash, signIn, syncStatus, waitForCopy } from './support/app';

test.describe('dos pestañas del mismo equipo', () => {
  test('both tabs sell without a network, take their folios from the same counter, and every sale reaches the server once', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await openCounter(page);
    await openShift(page, 0);
    await waitForCopy(page, 'arroz', 'Arroz 500 g');

    // La segunda pestaña es del mismo equipo: comparte lo guardado (la cola, el turno, el contador de folios) y tambien entra.
    const other = await context.newPage();
    await signIn(other, business.credentials);
    await openCounter(other);
    await waitForCopy(other, 'pan', 'Pan tajado');

    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    const folios = [
      await sellCash(page, [{ search: 'arroz', name: 'Arroz 500 g' }]),
      await sellCash(other, [{ search: 'pan', name: 'Pan tajado' }]),
      await sellCash(page, [{ search: 'leche', name: 'Leche 1 L' }]),
      await sellCash(other, [{ search: 'arroz', name: 'Arroz 500 g' }]),
    ];

    // Un solo contador: ninguna de las dos pestañas repite el numero de la otra.
    expect(new Set(folios).size).toBe(4);
    expect(folios.every((folio) => folio.startsWith('AA-'))).toBe(true);

    // Vuelve la red y las dos pestañas intentan enviar a la vez: el candado entre pestañas deja pasar de a una.
    await context.setOffline(false);
    await expect
      .poll(async () => (await serverSales(business)).length, { timeout: 40_000 })
      .toBe(4);
    // Y se espera un momento mas: si alguna pestaña enviara otra vez lo mismo, apareceria una venta de mas.
    // La pestaña que no envio se entera de que ya no hay nada pendiente en su siguiente vuelta (unos 30 s): hasta entonces sigue
    // diciendo lo ultimo que supo. Lo que importa es que converge y que ninguna de las dos manda otra vez lo mismo.
    await expect(syncStatus(page)).toContainText(/Todo enviado|Nada por enviar/, {
      timeout: 60_000,
    });
    await expect(syncStatus(other)).toContainText(/Todo enviado|Nada por enviar/, {
      timeout: 60_000,
    });

    const sales = await serverSales(business);
    expect(sales).toHaveLength(4);
    expect(duplicates(sales.map((sale) => sale.operationId))).toEqual([]);
    expect(duplicates(sales.map((sale) => sale.folio))).toEqual([]);
    expect(sales.map((sale) => sale.folio).sort()).toEqual([...folios].sort());
    expect(sales.every((sale) => !sale.folioConflict && !sale.attention)).toBe(true);
  });
});
