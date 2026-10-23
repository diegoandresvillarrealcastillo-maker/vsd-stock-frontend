import { expect, test, type Page } from '@playwright/test';
import { openBusiness } from './support/api';
import { signIn } from './support/app';

// C4-R0: las pantallas de administracion bajan cuando alguien entra a una, no con el arranque; y como el service worker guarda toda la
// interfaz (C3-07), lo que bajo una vez abre tambien sin red.

const ADMINISTRATION = /\/assets\/administration-[^/]+\.js$/;

/** Las direcciones que ESTA pagina pidio por su cuenta (no cuenta lo que el service worker baja al instalarse). */
const requested = (page: Page) =>
  page.evaluate(() =>
    performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname),
  );

test.describe('la administración baja cuando se entra a ella', () => {
  test('the start does not ask for the administration screens, the first one asks for them once, and the device keeps them for when the network fails', async ({
    page,
    context,
  }) => {
    const business = await openBusiness();

    // El arranque: la pantalla de ingresar abre sin pedir la administracion.
    await page.goto('/ingresar');
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
    expect((await requested(page)).filter((path) => ADMINISTRATION.test(path))).toEqual([]);

    // Al entrar, Inicio es una pantalla de administracion: ahi baja, en un solo archivo.
    await signIn(page, business.credentials);
    const asked = (await requested(page)).filter((path) => ADMINISTRATION.test(path));
    expect(asked).toHaveLength(1);
    const [administration = ''] = asked;

    // El service worker ya guardo ese archivo junto con el resto de la interfaz.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    const saved = await page.evaluate(async () => {
      const name = (await caches.keys()).find((key) => key.startsWith('vsd-stock-shell-'));
      if (name === undefined) return [];
      const cache = await caches.open(name);
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    });
    expect(saved).toContain(administration);

    // Y abre sin red: una pagina nueva, con la red cortada, lo recibe del dispositivo.
    await context.setOffline(true);
    const offline = await context.newPage();
    await offline.goto('/ingresar');
    const screen = await offline.evaluate(async (path) => {
      const module = (await import(path)) as Record<string, unknown>;
      return typeof module['CatalogPage'];
    }, administration);
    expect(screen).toBe('function');
  });
});
