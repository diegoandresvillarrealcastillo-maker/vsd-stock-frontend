import { expect, test, type Page } from '@playwright/test';
import { openBusiness, serverSales } from './support/api';
import { goToCounter, openCounter, openShift, sellCash, signIn, waitForCopy } from './support/app';
import { expectAccessible, expectTheme } from './support/axe';

// C4-A1: el folio propio de las anulaciones de punta a punta (ADR 0036 del backend). Se vende y se anula en el mostrador, con la API y la
// base reales: el servidor da el numero en el orden en que se anula, no en el de las ventas, y la aplicacion lo muestra en el detalle, en
// la lista y en el aviso al volver a la venta.

/** Desde la lista de ventas del turno: abre la venta de ese folio, la anula con ese motivo y espera a ver el detalle. */
async function voidSale(page: Page, folio: string, reason: string): Promise<void> {
  await goToCounter(page, 'Ventas');
  await page
    .getByRole('list', { name: 'Ventas', exact: true })
    .getByRole('link', { name: new RegExp(folio) })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: `Venta ${folio}` })).toBeVisible();
  await page.getByRole('link', { name: 'Anular venta' }).click();
  await page.getByLabel('Motivo (obligatorio)').fill(reason);
  await page.getByRole('button', { name: 'Anular venta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: `Venta ${folio}` })).toBeVisible();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`el folio de la anulación, en tema ${theme === 'light' ? 'claro' : 'oscuro'}`, () => {
    test.use({ colorScheme: theme });

    test('numbers the voids in the order they are made and shows each folio in the sale and in the list', async ({
      page,
    }) => {
      const business = await openBusiness();
      await signIn(page, business.credentials);
      await expectTheme(page, theme);
      await openCounter(page);
      await openShift(page, 50_000);
      await waitForCopy(page, 'arroz', 'Arroz 500 g');
      const first = await sellCash(page, [{ search: 'arroz', name: 'Arroz 500 g' }]);
      const second = await sellCash(page, [{ search: 'pan', name: 'Pan tajado' }]);
      await expect
        .poll(async () => (await serverSales(business)).length, { timeout: 40_000 })
        .toBe(2);

      // Se anula primero la SEGUNDA venta: el numero sigue el orden en que se anula, no el de las ventas.
      await voidSale(page, second, 'Se arrepintió');
      await expect(page.getByText('La venta quedó anulada con el folio ANU-000001.')).toBeVisible();
      await expect(page.getByText('Folio de la anulación ANU-000001')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: `Venta ${second}` })).toBeVisible();
      await expectAccessible(page, 'Venta anulada, con el folio de la anulación');

      await voidSale(page, first, 'Error del cajero');
      await expect(page.getByText('La venta quedó anulada con el folio ANU-000002.')).toBeVisible();
      await expect(page.getByText('Folio de la anulación ANU-000002')).toBeVisible();

      // La lista dice el folio de la venta y el de la anulacion, cada uno en su fila.
      await goToCounter(page, 'Ventas');
      const rows = page.getByRole('list', { name: 'Ventas', exact: true }).getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: first })).toContainText('Anulación ANU-000002');
      await expect(rows.filter({ hasText: second })).toContainText('Anulación ANU-000001');
      await expectAccessible(page, 'Ventas, con dos anuladas');

      // Lo que la pantalla muestra es lo que el servidor guardo.
      const stored = await serverSales(business);
      expect(Object.fromEntries(stored.map((sale) => [sale.folio, sale.voided?.folio]))).toEqual({
        [first]: 'ANU-000002',
        [second]: 'ANU-000001',
      });
    });
  });
}
