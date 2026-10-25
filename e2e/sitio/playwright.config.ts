import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { PUERTO_DEL_SITIO, URL_DEL_SITIO } from '../support/sitio';

const inCi = process.env['CI'] !== undefined;
const raiz = resolve(import.meta.dirname, '..', '..');

/**
 * Las pruebas en navegador de la landing (C4-L7): la pagina ya compilada (`npm run build:sitio`) en Chromium, con las reglas de
 * `_headers` puestas. No necesitan la API, la base ni el servicio de identidad: la landing no los usa, y lo unico que le pregunta a
 * PRE (`GET /health`, el chip de la demo) lo contesta cada prueba. Se corren con `npm run e2e:sitio`.
 *
 * Solo Chromium, el navegador del telefono Android del negocio de referencia (igual que lo unico que bloquea en `playwright.config.ts`).
 * Detalle en `docs/rendimiento-de-la-landing.md`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: resolve(raiz, 'test-results'),
  fullyParallel: true,
  workers: inCi ? 2 : 3,
  forbidOnly: inCi,
  retries: inCi ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: inCi
    ? [['list'], ['html', { open: 'never', outputFolder: resolve(raiz, 'playwright-report') }]]
    : [['list']],
  use: {
    baseURL: URL_DEL_SITIO,
    // El ancho de un telefono: es donde se vende.
    viewport: { width: 375, height: 812 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    // Compila la landing (la parte del navegador, la prerenderizada y las reglas) y la sirve tal cual sale.
    name: 'sitio',
    command: `npm run build:sitio && npm run preview:sitio -- --host localhost --port ${String(PUERTO_DEL_SITIO)} --strictPort`,
    cwd: raiz,
    url: URL_DEL_SITIO,
    reuseExistingServer: !inCi,
    timeout: 180_000,
  },
});
