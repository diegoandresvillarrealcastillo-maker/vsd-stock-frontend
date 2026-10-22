import { chromium, expect, firefox, test, webkit } from '@playwright/test';
import { newDevice } from './support/devices';

const ENGINES = { chromium, firefox, webkit } as const;
// WebKit se equivocaba solo a veces (alrededor de una de cada tres): con varios navegadores nuevos seguidos la prueba no depende de la suerte.
const FIRST_VISITS = 4;

test.describe('la primera visita', () => {
  test('installs the application without offering a new version, every time a browser starts from nothing', async ({
    browserName,
  }) => {
    // WebKit entregaba «installed» cuando la pagina ya se veia controlada: la primera instalacion parecia una actualizacion y el aviso
    // tapaba el boton de abajo. Pasa en el primer contexto de un navegador recien abierto, por eso cada vuelta abre uno propio.
    for (let visit = 1; visit <= FIRST_VISITS; visit += 1) {
      const browser = await ENGINES[browserName].launch();
      try {
        const { page } = await newDevice(browser);
        await page.goto('/ingresar');
        await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
        // Se deja pasar el tiempo, sin tocar el service worker: preguntarle por `ready` cambia el momento en que llegan sus avisos.
        await page.waitForTimeout(2_000);

        await expect(
          page.getByText('Hay una versión nueva de VSD Stock.'),
          `Visita ${String(visit)}`,
        ).toHaveCount(0);
      } finally {
        await browser.close();
      }
    }
  });
});
