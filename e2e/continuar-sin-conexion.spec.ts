import { expect, test } from '@playwright/test';
import { openBusiness, serverSales } from './support/api';
import { openCounter, openShift, sellCash, signIn, syncStatus, waitForCopy } from './support/app';

test.describe('seguir sin conexión y volver a entrar', () => {
  test('when the network is back the card of the sync says that the password is missing, and its button takes the person to sign in without losing the sale', async ({
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
    await page.reload();

    // La sesion no sobrevive a recargar (ADR 0022): se sigue con lo guardado en este equipo, y sin sesion.
    await page.getByRole('button', { name: 'Continuar sin conexión' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Vender' })).toBeVisible();
    await expect(syncStatus(page)).toContainText('por enviar');

    // Vuelve la red. Sin sesion el envio se niega, y la tarjeta dice que falta (no que caducó una sesion que no hubo).
    await context.setOffline(false);
    await expect(syncStatus(page)).toContainText('Falta entrar con tu contraseña');
    await expect(syncStatus(page)).toContainText('1 registro por enviar');
    expect(await serverSales(business)).toHaveLength(0);

    // Su boton hace algo: lleva a entrar, con la persona ya elegida y lo guardado donde estaba.
    await syncStatus(page).getByRole('button', { name: 'Entrar con contraseña' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
    await expect(page.getByText('Último en este equipo')).toBeVisible();
    await expect(page.getByLabel('Correo')).toHaveValue(business.credentials.email);

    await page.getByLabel('Contraseña').fill(business.credentials.password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();

    await expect
      .poll(async () => (await serverSales(business)).length, { timeout: 40_000 })
      .toBe(1);
    const [sale] = await serverSales(business);
    expect(sale?.folio).toBe('AA-000001');
  });

  test('with a connection the sign-in page does not offer to continue without one, and offers it again when the network is cut', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await page.reload();

    // La sesion no sobrevive a recargar (ADR 0022): la pantalla de entrar recuerda a la persona.
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
    await expect(page.getByText('Último en este equipo')).toBeVisible();
    // Mientras comprueba la conexion el boton puede verse; en cuanto el servidor responde se va (ADR 0038).
    const continuar = page.getByRole('button', { name: 'Continuar sin conexión' });
    await expect(continuar).toBeHidden();
    await expect(
      page.getByText('Lo que tienes guardado en este equipo se conserva.'),
    ).toBeVisible();
    await expect(page.getByLabel('Correo')).toHaveValue(business.credentials.email);

    // Se corta la red: ahora si es el camino.
    await context.setOffline(true);
    await expect(continuar).toBeVisible();
    await context.setOffline(false);
    await expect(continuar).toBeHidden();
  });
});
