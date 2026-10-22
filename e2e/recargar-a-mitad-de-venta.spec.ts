import { expect, test } from '@playwright/test';
import { openBusiness, serverSales } from './support/api';
import {
  addProduct,
  openCounter,
  openShift,
  sellCash,
  signIn,
  syncStatus,
  waitForCopy,
} from './support/app';

test.describe('recargar a mitad de una venta', () => {
  test('without a network the page opens from the device: the shift and the saved sale are there, only the cart that was being made is lost', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await openCounter(page);
    await openShift(page, 20_000);
    await waitForCopy(page, 'arroz', 'Arroz 500 g');
    // El service worker tiene que haber guardado la interfaz antes de cortar la red.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await sellCash(page, [{ search: 'arroz', name: 'Arroz 500 g' }]);
    await addProduct(page, 'pan', 'Pan tajado'); // la segunda venta queda a medias, sin cobrar

    await page.reload();

    // La sesion no sobrevive a recargar (ADR 0022): se ofrece seguir con lo guardado en este equipo.
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
    await expect(page.getByText('Último en este equipo')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar sin conexión' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Vender' })).toBeVisible();
    await expect(page.getByText(/Turno abierto desde las/)).toBeVisible();
    await expect(syncStatus(page)).toContainText('por enviar');
    await expect(page.getByText('La venta está vacía')).toBeVisible();
    expect(await serverSales(business)).toHaveLength(0);

    // Vuelve la red. Para ENVIAR lo guardado hay que volver a entrar con la contraseña: ahi se prueba quien eres (ADR 0022).
    await context.setOffline(false);
    await page.getByRole('link', { name: 'Entrar con contraseña' }).click();
    await page.getByLabel('Contraseña').fill(business.credentials.password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();

    await expect
      .poll(async () => (await serverSales(business)).length, { timeout: 40_000 })
      .toBe(1);
    const [sale] = await serverSales(business);
    expect(sale?.folio).toBe('AA-000001');
    expect(sale?.total).toBe(3_200);
    // La venta que estaba a medias no existe en ninguna parte: nunca se cobro.
    expect(await serverSales(business)).toHaveLength(1);
  });
});
