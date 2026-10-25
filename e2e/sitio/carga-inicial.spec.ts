import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { API_DE_PRE } from '../../sitio/pagina/destinos';
import { excesos, pesoEnLaRed, type Presupuesto, type Respuesta } from '../support/peso';
import { conLasReglasDelSitio, responderLaSonda, URL_DEL_SITIO } from '../support/sitio';

// La carga inicial de la landing (C4-L7): lo que baja un telefono entre abrir la pagina y que la red se quede quieta, sin tocar nada.
// Se mide en el navegador real, que es quien sabe que fuentes e imagenes se piden de verdad (las fuentes llevan `unicode-range` y las
// imagenes de mas abajo cargan solo cuando se ven). El presupuesto vive en `scripts/presupuesto-sitio.json`, con su razon en
// `docs/rendimiento-de-la-landing.md`.
const presupuesto = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '..', '..', 'scripts', 'presupuesto-sitio.json'),
    'utf8',
  ),
) as Presupuesto;

/** Abre la pagina y junta todo lo que baja hasta que la red se queda quieta. */
async function cargar(page: Page): Promise<Respuesta[]> {
  const respuestas: Respuesta[] = [];
  const pendientes: Promise<void>[] = [];
  page.on('response', (respuesta) => {
    pendientes.push(
      respuesta.body().then(
        (cuerpo) => {
          respuestas.push({
            url: respuesta.url(),
            tipo: respuesta.headers()['content-type'] ?? '',
            cuerpo,
          });
        },
        // Una redireccion o una respuesta sin cuerpo no pesa nada.
        () => undefined,
      ),
    );
  });
  await responderLaSonda(page, 'despierta');
  await conLasReglasDelSitio(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await Promise.all(pendientes);
  return respuestas;
}

const delSitio = (respuestas: readonly Respuesta[]): Respuesta[] =>
  respuestas.filter((respuesta) => respuesta.url.startsWith(URL_DEL_SITIO));

test('the first load stays inside the weight budget', async ({ page }) => {
  const peso = pesoEnLaRed(delSitio(await cargar(page)));
  test.info().annotations.push({ type: 'peso', description: JSON.stringify(peso) });

  expect(excesos(peso, presupuesto)).toEqual([]);
});

test('asks nobody for anything but its own site and the health of the PRE API', async ({
  page,
}) => {
  const respuestas = await cargar(page);

  const deOtros = respuestas
    .filter((respuesta) => !respuesta.url.startsWith(URL_DEL_SITIO))
    .map((respuesta) => respuesta.url);
  expect(deOtros).toEqual([`${API_DE_PRE}/health`]);
});

test('does not download the demonstrations of IVA and Caja until they are chosen', async ({
  page,
}) => {
  const respuestas = await cargar(page);
  const nombres = delSitio(respuestas).map((respuesta) => respuesta.url);

  expect(nombres.filter((url) => /CalculadoraIva|ArqueoDeEjemplo/.test(url))).toEqual([]);

  const calculadora = page.waitForRequest(/\/assets\/CalculadoraIva-.*\.js$/, { timeout: 10_000 });
  await page.getByRole('tab', { name: 'IVA' }).click();
  await calculadora;
  await expect(page.getByRole('tabpanel', { name: 'IVA' }).getByRole('textbox')).toBeVisible();

  const arqueo = page.waitForRequest(/\/assets\/ArqueoDeEjemplo-.*\.js$/, { timeout: 10_000 });
  await page.getByRole('tab', { name: 'Caja' }).click();
  await arqueo;
  await expect(page.getByRole('tabpanel', { name: 'Caja' }).getByRole('textbox')).toBeVisible();
});

test('does not download the pictures that are far below until they are about to be seen', async ({
  page,
}) => {
  const respuestas = delSitio(await cargar(page));
  const imagenes = respuestas.filter((respuesta) => respuesta.tipo.startsWith('image/'));

  // El logo, la mascota de la entrada y, a lo sumo, el icono de la pestana: las otras mascotas bajan cuando se ven.
  expect(imagenes.length).toBeLessThanOrEqual(3);
});
