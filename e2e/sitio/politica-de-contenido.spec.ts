import { expect, test } from '@playwright/test';
import { conLasReglasDelSitio } from '../support/sitio';

// La landing con la politica de contenido de verdad (la de `sitio/dist/_headers`, que `vite preview` no aplica). Si la politica
// bloquea un script, una fuente o una imagen, el navegador lo anota en la consola y lanza un evento: aqui se
// recoge todo eso mientras se abre la pagina y se usa cada cosa que se descarga aparte o habla con otro sitio.
test('nothing is blocked and nothing logs an error while the page is opened and used', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') errores.push(mensaje.text());
  });
  page.on('pageerror', (error) => {
    errores.push(error.message);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (evento) => {
      console.error(
        `Politica de contenido: ${evento.violatedDirective} bloqueo ${evento.blockedURI}`,
      );
    });
  });
  await conLasReglasDelSitio(page);

  await page.goto('/');
  for (const pestana of ['IVA', 'Caja', 'Vender']) {
    await page.getByRole('tab', { name: pestana }).click();
    await expect(page.getByRole('tabpanel', { name: pestana })).toBeVisible();
  }
  await page.getByRole('switch', { name: 'Simular una caída de internet' }).first().click();
  await page.getByRole('button', { name: 'Cambiar entre tema claro y oscuro' }).first().click();
  await page.waitForTimeout(500);

  expect(errores).toEqual([]);
});

test('the policy is really on: the page asked for, and got, the headers of the site', async ({
  page,
}) => {
  await conLasReglasDelSitio(page);

  const respuesta = await page.goto('/');

  const politica = respuesta?.headers()['content-security-policy'] ?? '';
  expect(politica).toContain("default-src 'self'");
  expect(politica).toContain("script-src 'self' 'sha256-");
  expect(respuesta?.headers()['x-content-type-options']).toBe('nosniff');
});
