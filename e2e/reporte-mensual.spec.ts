import { expect, test } from '@playwright/test';
import { openBusiness, serverSales } from './support/api';
import { goToAdmin, openCounter, openShift, sellCash, signIn, waitForCopy } from './support/app';

// C4-R1: el reporte mensual de punta a punta (ADR 0035 del backend). Se vende en el mostrador, con la API y la base reales, y el reporte
// del mes tiene que decir lo mismo que los recibos: el IVA de cada venta, separado como se declara, y lo cobrado por medio de pago.

test.describe('el reporte mensual', () => {
  test('says what was sold this month by rate and kind, how it was paid, and moves between months', async ({
    page,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await openCounter(page);
    await openShift(page, 50_000);
    await waitForCopy(page, 'arroz', 'Arroz 500 g');
    // Pan 19 % + leche 5 % en una venta y arroz (exento) en otra, las dos en efectivo.
    await sellCash(page, [
      { search: 'pan', name: 'Pan tajado' },
      { search: 'leche', name: 'Leche 1 L' },
    ]);
    await sellCash(page, [{ search: 'arroz', name: 'Arroz 500 g' }]);

    await page.getByRole('link', { name: 'Administración' }).click();
    await goToAdmin(page, 'Reportes');

    await expect(page.getByRole('heading', { level: 1, name: 'Reporte mensual' })).toBeVisible();
    const sales = page.getByRole('region', { name: 'Ventas del mes' });
    await expect(sales).toBeVisible();
    await expect(sales.getByText('2 ventas')).toBeVisible();

    // El IVA se saca venta por venta, como dice cada recibo: 2.800 al 19 % son 2.353 de base y 447 de IVA; 4.500 al 5 %, 4.286 y 214.
    const rows = sales.getByRole('list', { name: 'Ventas por tarifa' }).getByRole('listitem');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('Gravado 19 %');
    await expect(rows.nth(0)).toContainText('$ 2.800');
    await expect(rows.nth(0)).toContainText('Base $ 2.353 · IVA $ 447');
    await expect(rows.nth(1)).toContainText('Gravado 5 %');
    await expect(rows.nth(1)).toContainText('$ 4.500');
    await expect(rows.nth(1)).toContainText('Base $ 4.286 · IVA $ 214');
    await expect(rows.nth(2)).toContainText('Exento');
    await expect(rows.nth(2)).toContainText('$ 3.200');
    await expect(rows.nth(3)).toContainText('Excluido');
    await expect(rows.nth(3)).toContainText('$ 0');

    const totals = sales.getByRole('group', { name: 'Totales de las ventas' });
    await expect(totals).toContainText('Base sin IVA');
    await expect(totals).toContainText('$ 9.839');
    await expect(totals).toContainText('$ 661');
    await expect(totals).toContainText('Total vendido');
    await expect(totals).toContainText('$ 10.500');

    const payments = sales.getByRole('group', { name: 'Cobrado por medio de pago' });
    await expect(payments).toContainText('Efectivo');
    await expect(payments).toContainText('$ 10.500');
    await expect(payments).toContainText('Tarjeta');
    await expect(payments).toContainText('Transferencia');

    // Lo que el reporte suma es lo que el servidor guardo de las ventas, no otra cuenta.
    const stored = (await serverSales(business)).reduce((sum, sale) => sum + sale.total, 0);
    expect(stored).toBe(10_500);

    // Sin anulaciones no hay bloque de anulaciones, y el aviso de lo que el reporte no es siempre se ve.
    await expect(page.getByRole('region', { name: 'Anulaciones del mes' })).toHaveCount(0);
    await expect(page.getByRole('note', { name: 'Para qué sirve este reporte' })).toContainText(
      'Este reporte es de control interno, no es tu declaración de IVA',
    );

    // El mes anterior no tuvo ventas; el siguiente esta cerrado porque es el futuro, y volver trae las ventas de hoy.
    const next = page.getByRole('button', { name: 'Mes siguiente' });
    await expect(next).toBeDisabled();
    await page.getByRole('button', { name: 'Mes anterior' }).click();
    await expect(page.getByText(/^En .+ no hubo ventas\.$/)).toBeVisible();
    await expect(sales).toHaveCount(0);
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.getByRole('region', { name: 'Ventas del mes' })).toBeVisible();
  });
});
