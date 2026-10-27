import { expect, test, type Page } from '@playwright/test';
import { conLasReglasDelSitio } from '../support/sitio';

// «Movimiento reducido apaga todo lo que se mueve» (C4-L7). Se comprueba en el navegador, que es el unico que sabe lo que de verdad
// se aplica: cada elemento de la pagina, con sus ::before y ::after, tiene que quedar sin una transicion ni una animacion que dure
// mas de un milisegundo. Y la misma revision, sin pedir menos movimiento, tiene que encontrar cosas que se mueven: si no, la prueba
// estaria ciega y daria verde por no mirar.

/** Los elementos que tienen ahora una transicion o una animacion de mas de un milisegundo. */
async function lasQueSeMueven(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const dura = (lista: string): boolean =>
      lista.split(',').some((valor) => {
        const tiempo = valor.trim();
        return parseFloat(tiempo) * (tiempo.endsWith('ms') ? 1 : 1000) > 1;
      });
    const encontrados: string[] = [];
    for (const elemento of document.querySelectorAll('*')) {
      for (const pseudo of [null, '::before', '::after']) {
        const estilo = getComputedStyle(elemento, pseudo);
        const transicion = estilo.transitionProperty !== 'none' && dura(estilo.transitionDuration);
        const animacion = estilo.animationName !== 'none' && dura(estilo.animationDuration);
        if (transicion || animacion) {
          const clases = (elemento.getAttribute('class') ?? '').slice(0, 90);
          encontrados.push(
            `${elemento.localName}${pseudo ?? ''}[${clases}] ${animacion ? 'animation' : 'transition'}`,
          );
        }
      }
    }
    return encontrados;
  });
}

/** Cuantas animaciones estan corriendo ahora mismo en la pagina. */
const animacionesCorriendo = (page: Page): Promise<number> =>
  page.evaluate(
    () => document.getAnimations().filter((animacion) => animacion.playState === 'running').length,
  );

/** Retiene la descarga de la calculadora, para ver el esqueleto que se muestra mientras baja. */
async function frenarLaCalculadora(page: Page): Promise<void> {
  await page.route(/\/assets\/CalculadoraIva-.*\.js$/, async (ruta) => {
    await new Promise((listo) => setTimeout(listo, 2_500));
    await ruta.fallback();
  });
}

async function abrir(page: Page): Promise<void> {
  await conLasReglasDelSitio(page);
  await page.goto('/');
}

test.describe('landing with less motion asked for', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing on the page has a transition or an animation that lasts more than a millisecond', async ({
    page,
  }) => {
    await abrir(page);

    expect(await lasQueSeMueven(page)).toEqual([]);
  });

  test('not even the skeleton of a demonstration that is still downloading', async ({ page }) => {
    await frenarLaCalculadora(page);
    await abrir(page);

    await page.getByRole('tab', { name: 'IVA' }).click();
    await expect(page.getByText('Cargando la demostración…')).toBeAttached();

    expect(await lasQueSeMueven(page)).toEqual([]);
    expect(await animacionesCorriendo(page)).toBe(0);
  });

  test('the sale does not travel through the diagram when the switch is flipped', async ({
    page,
  }) => {
    await abrir(page);

    await page.getByRole('switch', { name: 'Simular una caída de internet' }).first().click();
    // Mas que lo que espera el dibujo antes de que salga una venta (1,4 s) mas lo que tarda en llegar (0,7 s).
    await page.waitForTimeout(3_000);

    await expect(page.locator('.viaje')).toHaveCount(0);
    expect(await animacionesCorriendo(page)).toBe(0);
    expect(await lasQueSeMueven(page)).toEqual([]);
  });

  test('the page jumps to the anchors instead of sliding', async ({ page }) => {
    await abrir(page);

    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    ).toBe('auto');
  });
});

test.describe('landing without asking for less motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the same review does find things that move: transitions, the skeleton and the sale', async ({
    page,
  }) => {
    await frenarLaCalculadora(page);
    await abrir(page);

    // El dibujo solo se mueve mientras se ve en pantalla: se lleva el interruptor a la vista y se corta el internet.
    const interruptor = page.getByRole('switch', { name: 'Simular una caída de internet' }).first();
    await interruptor.scrollIntoViewIfNeeded();
    await interruptor.click();
    await expect(page.locator('.viaje').first()).toBeAttached({ timeout: 10_000 });
    expect(await animacionesCorriendo(page)).toBeGreaterThan(0);

    await page.getByRole('tab', { name: 'IVA' }).click();
    await expect(page.getByText('Cargando la demostración…')).toBeAttached();
    const lasQueSeMueve = await lasQueSeMueven(page);

    expect(lasQueSeMueve.some((fila) => fila.includes('animate-pulse'))).toBe(true);
    expect(lasQueSeMueve.some((fila) => fila.endsWith('transition'))).toBe(true);
  });

  test('the page slides to the anchors', async ({ page }) => {
    await abrir(page);

    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior),
    ).toBe('smooth');
  });
});
