import { defineConfig, devices } from '@playwright/test';
import {
  APPLICATION_DATABASE_URL,
  BACKEND_DIR,
  FAKE_PUBLISHABLE_KEY,
  PORTS,
  PREPARE_DATABASE_URL,
  URLS,
} from './e2e/support/stack';

const inCi = process.env['CI'] !== undefined;

/**
 * Pruebas en un navegador de verdad (C3-15, ADR 0030): la web real, ya compilada, contra la API real y una base real. Chromium bloquea
 * el CI (es el navegador del telefono Android del negocio de referencia); Firefox y WebKit se corren y se informan, pero no bloquean.
 *
 * La pila (identidad de mentira, API y web) la levanta Playwright; la base la tiene que haber levantado quien corre las pruebas
 * (`npm run db:up` en el backend). Detalle en `docs/pruebas-en-navegador.md`.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // Cada prueba abre su propio negocio: no comparten datos y pueden correr juntas.
  fullyParallel: true,
  workers: inCi ? 2 : 3,
  forbidOnly: inCi,
  retries: inCi ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: inCi ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: URLS.web,
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
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: [
    {
      // El servicio de identidad de mentira del backend: habla como Supabase Auth en lo unico que usan la web y la API.
      name: 'identidad',
      command: `node scripts/dev-identity.ts --port ${String(PORTS.identity)}`,
      cwd: BACKEND_DIR,
      url: `${URLS.identity}/.well-known/jwks.json`,
      reuseExistingServer: !inCi,
      timeout: 60_000,
    },
    {
      // La API real: compila, deja la base con el esquema real y arranca. Sin `.env`: todo viene de aqui.
      name: 'api',
      command: 'npm run build && node scripts/db-prepare.ts && node dist/infrastructure/main.js',
      cwd: BACKEND_DIR,
      url: `${URLS.api}/health`,
      reuseExistingServer: !inCi,
      timeout: 180_000,
      env: {
        PORT: String(PORTS.api),
        TEST_DATABASE_URL: PREPARE_DATABASE_URL,
        DATABASE_URL: APPLICATION_DATABASE_URL,
        AUTH_ISSUER: URLS.identity,
        AUTH_JWKS_URL: `${URLS.identity}/.well-known/jwks.json`,
        AUTH_AUDIENCE: 'authenticated',
        CORS_ORIGINS: URLS.web,
      },
    },
    {
      // La web real, compilada con las direcciones de esta pila (lo que lleva VITE_ queda dentro del paquete) y servida tal cual:
      // el service worker solo existe en lo compilado. El modo `e2e` es el unico que deja hablar http con el servicio de identidad de
      // mentira (ver `resolveAuthConfig`).
      name: 'web',
      command: `npm run build:e2e && npx vite preview --host localhost --port ${String(PORTS.web)} --strictPort`,
      url: URLS.web,
      reuseExistingServer: !inCi,
      timeout: 180_000,
      env: {
        VITE_API_URL: URLS.api,
        VITE_AUTH_URL: URLS.identity,
        VITE_AUTH_PUBLISHABLE_KEY: FAKE_PUBLISHABLE_KEY,
      },
    },
  ],
});
