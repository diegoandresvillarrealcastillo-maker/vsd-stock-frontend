import { expect, test } from '@playwright/test';
import { expectAccessible, expectTheme } from '../support/axe';
import { conLasReglasDelSitio } from '../support/sitio';

// La landing entera con axe en el navegador real (C4-L7): contraste de color, nombres de los controles, orden de los encabezados y
// regiones, que jsdom no ve. En tema claro y en tema oscuro (lo da el navegador con `prefers-color-scheme`, como en un telefono),
// a 375 px, donde se vende, y a 1280 px, donde se mira desde una oficina. axe lee toda la pagina, no solo lo que se ve en pantalla.
const anchos = [
  { nombre: 'phone', ancho: 375, alto: 812 },
  { nombre: 'desktop', ancho: 1280, alto: 800 },
] as const;

for (const theme of ['light', 'dark'] as const) {
  for (const { nombre, ancho, alto } of anchos) {
    test.describe(`landing accessibility, ${theme} theme, ${nombre}`, () => {
      test.use({ colorScheme: theme, viewport: { width: ancho, height: alto } });

      test.beforeEach(async ({ page }) => {
        await conLasReglasDelSitio(page);
        await page.goto('/');
        await expectTheme(page, theme);
      });

      test('the whole page', async ({ page }) => {
        await expectAccessible(page, 'La landing');
      });

      test('with each demonstration of the band open', async ({ page }) => {
        for (const pestana of ['Vender', 'IVA', 'Caja']) {
          await page.getByRole('tab', { name: pestana }).click();
          await expect(page.getByRole('tabpanel', { name: pestana })).toBeVisible();
          // Las demos de IVA y Caja bajan aparte: se espera a que llegue lo suyo y no el esqueleto.
          if (pestana !== 'Vender') {
            await expect(
              page.getByRole('tabpanel', { name: pestana }).getByRole('textbox'),
            ).toBeVisible();
          }
          await expectAccessible(page, `La demo «${pestana}»`);
        }
      });

      // Las preguntas comparten nombre (`<details name>`): el navegador deja abierta una sola, asi que se abren la primera y la ultima.
      for (const cual of ['first', 'last'] as const) {
        test(`with the ${cual} question of the page open`, async ({ page }) => {
          const pregunta = page.locator('details')[cual]();
          await pregunta.locator('summary').click();
          await expect(pregunta).toHaveJSProperty('open', true);
          await expectAccessible(
            page,
            `La ${cual === 'first' ? 'primera' : 'ultima'} pregunta, abierta`,
          );
        });
      }
    });
  }
}
