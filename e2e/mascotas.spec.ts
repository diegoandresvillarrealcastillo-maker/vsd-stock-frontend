import { expect, test, type Page } from '@playwright/test';
import { openBusiness } from './support/api';
import { goToAdmin, goToCounter, openCounter, openShift, signIn } from './support/app';
import { expectAccessible, expectTheme } from './support/axe';

// C4-M3: las mascotas en la aplicacion, en un navegador de verdad. Lo que jsdom no ve: que el dibujo SE CARGUE sin red (Ori dormida
// es justo la que se ve cuando se cae la conexion y tiene que venir del dispositivo), que el CSS la deje quieta con movimiento reducido,
// que el boton la apague de verdad y la elija recordar, y que ninguna pantalla se desborde a 375 px.

const cara = (page: Page, name: string) => page.getByRole('img', { name });
const switchOf = (page: Page) => page.getByRole('button', { name: 'Mostrar mascotas' });

/** El dibujo ya se pinto: terminó de cargar y tiene tamaño. Una imagen que no llegó sigue en el DOM, con su texto, pero vacía. */
async function drawn(page: Page, name: string): Promise<boolean> {
  return cara(page, name).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
}

test.describe('las mascotas en la aplicación', () => {
  test('Ori wakes up when the server answers, falls asleep when the network is cut and wakes up again, drawn from the device each time', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await expect(cara(page, 'Ori, con gesto tranquilo')).toBeVisible();
    await expect.poll(() => drawn(page, 'Ori, con gesto tranquilo')).toBe(true);
    // El service worker tiene que haber guardado a Ori dormida ANTES de que se corte la red: es la que se ve sin ella.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await expect(page.getByRole('status').getByText('Sin conexión')).toBeVisible();
    await expect(cara(page, 'Ori, durmiendo')).toBeVisible();
    // Sin red: el dibujo llega del service worker, no de internet.
    await expect.poll(() => drawn(page, 'Ori, durmiendo')).toBe(true);
    await expectAccessible(page, 'Inicio sin conexión, con Ori dormida');

    await context.setOffline(false);
    await expect(cara(page, 'Ori, con gesto tranquilo')).toBeVisible({ timeout: 30_000 });
    await expect(cara(page, 'Ori, durmiendo')).toHaveCount(0);
  });

  test('the card does not overflow the phone and the page does not scroll sideways, with Ori on it', async ({
    page,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await expect(cara(page, 'Ori, con gesto tranquilo')).toBeVisible();

    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      window: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.window);
    const box = await cara(page, 'Ori, con gesto tranquilo').boundingBox();
    expect(box?.width).toBe(64);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(widths.window);
  });

  test('they move only for who did not ask for less motion', async ({ page }) => {
    const business = await openBusiness();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await signIn(page, business.credentials);
    const face = cara(page, 'Ori, con gesto tranquilo');
    await expect(face).toBeVisible();
    const animation = () => face.evaluate((img) => getComputedStyle(img).animationName);

    expect(await animation()).toBe('mascota-flotar');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await animation()).toBe('none');
  });

  test('the switch takes them away and remembers it for the next time, with no gap left behind', async ({
    page,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await expect(cara(page, 'Ori, con gesto tranquilo')).toBeVisible();
    await expect(switchOf(page)).toHaveAttribute('aria-pressed', 'true');

    await switchOf(page).click();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(switchOf(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('status').getByText('En línea')).toBeVisible();

    // La sesion vive solo en la memoria de la pestaña (ADR 0022): al recargar hay que entrar de nuevo, y lo que se recuerda es la eleccion.
    await page.reload();
    await signIn(page, business.credentials);
    await expect(page.getByRole('status').getByText('En línea')).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(switchOf(page)).toHaveAttribute('aria-pressed', 'false');

    await switchOf(page).click();
    await expect(cara(page, 'Ori, con gesto tranquilo')).toBeVisible();
  });

  test('Ojo de Gato reads while the cash is counted and is happy only when the drawer balances', async ({
    page,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await openCounter(page);
    await openShift(page, 50_000);
    await page.getByRole('link', { name: 'Cerrar turno' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cerrar turno' })).toBeVisible();

    await expect(cara(page, 'Ojo de Gato, con gesto tranquilo')).toBeVisible();
    await expect.poll(() => drawn(page, 'Ojo de Gato, con gesto tranquilo')).toBe(true);

    await page.getByLabel('Efectivo contado').fill('49000');
    await expect(page.getByText('Faltan $ 1.000')).toBeVisible();
    await expect(cara(page, 'Ojo de Gato, con gesto tranquilo')).toBeVisible();

    await page.getByLabel('Efectivo contado').fill('50000');
    await expect(page.getByText('La caja cuadra')).toBeVisible();
    await expect(cara(page, 'Ojo de Gato, feliz')).toBeVisible();
    await expect.poll(() => drawn(page, 'Ojo de Gato, feliz')).toBe(true);
    await expectAccessible(page, 'Cerrar turno, la caja cuadra, con Ojo de Gato');
  });

  test('Ojo de Gato is also there in the dark theme, and still passes axe', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await expectTheme(page, 'dark');
    await openCounter(page);
    await openShift(page, 50_000);
    await page.getByRole('link', { name: 'Cerrar turno' }).click();
    await page.getByLabel('Efectivo contado').fill('50000');
    await expect(cara(page, 'Ojo de Gato, feliz')).toBeVisible();

    await expectAccessible(page, 'Cerrar turno en tema oscuro, con Ojo de Gato');
  });

  test('Fungito sleeps in an empty catalog and is not there once there are products', async ({
    page,
  }) => {
    const empty = await openBusiness([]);
    await signIn(page, empty.credentials);
    await goToAdmin(page, 'Catálogo');
    await expect(page.getByText('Todavía no tienes productos.')).toBeVisible();
    await expect(cara(page, 'Fungito, durmiendo')).toBeVisible();
    await expect.poll(() => drawn(page, 'Fungito, durmiendo')).toBe(true);
    await expectAccessible(page, 'Catálogo vacío, con Fungito dormido');
  });

  test('the catalog with products has no Fungito, and the counter and the charge flow have no mascots at all', async ({
    page,
  }) => {
    const business = await openBusiness();
    await signIn(page, business.credentials);
    await goToAdmin(page, 'Catálogo');
    await expect(page.getByRole('list', { name: 'Productos' })).toBeVisible();
    await expect(cara(page, 'Fungito, durmiendo')).toHaveCount(0);

    await goToAdmin(page, 'Inicio');
    await openCounter(page);
    await expect(page.getByRole('img')).toHaveCount(0);
    await openShift(page, 0);
    await goToCounter(page, 'Mostrador');
    await expect(page.getByRole('img')).toHaveCount(0);
  });
});
