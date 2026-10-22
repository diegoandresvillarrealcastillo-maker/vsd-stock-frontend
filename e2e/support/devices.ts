import type { Browser, BrowserContext, Page } from '@playwright/test';
import { URLS } from './stack';

/**
 * Un dispositivo virtual: un contexto de navegador propio, con su propio almacenamiento (su propia base cifrada, su propia cola y su
 * propio contador de folios), como si fuera otro telefono. Lleva las mismas opciones que las demas pruebas, porque `browser.newContext`
 * no las hereda.
 *
 * `serviceWorkers: 'block'` es para las pruebas que interceptan peticiones (`page.route`): WebKit no intercepta las de una pagina
 * controlada por un service worker. El de esta aplicacion solo guarda la interfaz y no toca el envio, asi que esas pruebas no lo pierden.
 */
export async function newDevice(
  browser: Browser,
  options: { serviceWorkers?: 'allow' | 'block' } = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: URLS.web,
    viewport: { width: 375, height: 812 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    serviceWorkers: options.serviceWorkers ?? 'allow',
  });
  return { context, page: await context.newPage() };
}

/** Un generador de numeros que repite siempre lo mismo con la misma semilla: una corrida que falla se puede volver a vivir. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
