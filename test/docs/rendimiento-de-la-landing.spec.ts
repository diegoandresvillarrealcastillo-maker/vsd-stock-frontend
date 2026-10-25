// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUERTO_DEL_SITIO } from '../../e2e/support/sitio';

// Lo que C4-L7 vigila de la landing (rendimiento, accesibilidad y movimiento reducido) es una barrera que solo se ve cuando falla: si
// el trabajo del CI cambia de nombre, si Lighthouse se mide con otro perfil que el del resto del proyecto, si el presupuesto sube
// sin que el documento lo diga o si alguien quita las pruebas de navegador del CI, nadie avisa. Estas pruebas vigilan los
// trabajos, las configuraciones y el documento.
const raiz = resolve(import.meta.dirname, '../..');

function leer(ruta: string): string {
  expect(existsSync(resolve(raiz, ruta)), `falta ${ruta}`).toBe(true);
  return readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
}

/** Una frase de un documento como se lee: partida entre dos lineas (Prettier ajusta la prosa) sigue siendo la misma frase. */
const prosa = (ruta: string): string => leer(ruta).replaceAll(/\s+/g, ' ');

const flujo = leer('.github/workflows/ci.yml');
const paquete = JSON.parse(leer('package.json')) as { scripts: Record<string, string> };

/** El bloque de un trabajo del CI: desde su clave hasta el siguiente trabajo (dos espacios de sangria y dos puntos). */
function trabajo(clave: string): string {
  const inicio = flujo.search(new RegExp(`^  ${clave}:$`, 'm'));
  expect(inicio, `falta el trabajo ${clave} en ci.yml`).toBeGreaterThanOrEqual(0);
  const resto = flujo.slice(inicio + 1);
  const siguiente = resto.search(/^ {2}[a-z][a-z0-9_-]*:$/m);
  return siguiente === -1 ? resto : resto.slice(0, siguiente);
}

const sinComentarios = (texto: string): string =>
  texto
    .split('\n')
    .filter((linea) => !linea.trimStart().startsWith('#'))
    .join('\n');

describe('the Lighthouse job of the landing', () => {
  const bloque = sinComentarios(trabajo('landing'));

  it('is called «Landing (Lighthouse)», a name nobody renames by accident', () => {
    expect(bloque).toContain('name: Landing (Lighthouse)');
  });

  it('builds the landing first and then audits it, in that order', () => {
    const compilar = bloque.indexOf('run: npm run build:sitio');
    const auditar = bloque.indexOf('run: npm run lighthouse:sitio');

    expect(compilar).toBeGreaterThanOrEqual(0);
    expect(auditar).toBeGreaterThan(compilar);
  });

  it('can block: accessibility has to be perfect, so the job never lets itself fail', () => {
    expect(bloque).not.toContain('continue-on-error');
  });

  it('keeps the reports even when the audit fails, to see what failed', () => {
    expect(bloque).toMatch(/if: always\(\)\n\s+uses: actions\/upload-artifact@/);
    expect(bloque).toContain('name: informes-lighthouse-landing');
    expect(bloque).toContain('path: .lighthouseci/');
  });
});

describe('the browser job of the landing', () => {
  const bloque = sinComentarios(trabajo('landing-navegador'));

  it('is called «Landing (navegador)»', () => {
    expect(bloque).toContain('name: Landing (navegador)');
  });

  it('installs Chromium alone and without the system packages, like the blocking job of the app: the runner already has them', () => {
    expect(bloque).toContain('run: npx playwright install chromium\n');
    expect(bloque).not.toContain('--with-deps');
  });

  it('runs the tests of the landing with their own command, after installing', () => {
    const instalar = bloque.indexOf('npx playwright install chromium');
    const probar = bloque.indexOf('run: npm run e2e:sitio');

    expect(instalar).toBeGreaterThanOrEqual(0);
    expect(probar).toBeGreaterThan(instalar);
  });

  it('can block, and keeps the report even when it fails', () => {
    expect(bloque).not.toContain('continue-on-error');
    expect(bloque).toMatch(/if: always\(\)\n\s+uses: actions\/upload-artifact@/);
    expect(bloque).toContain('name: informes-navegador-landing');
  });

  it('does not need the backend, the database or the identity service: the landing uses none of them', () => {
    expect(bloque).not.toContain('postgres');
    expect(bloque).not.toContain('vsd-stock-backend');
  });
});

describe('the Lighthouse configuration of the landing', () => {
  interface Configuracion {
    ci: {
      collect: { staticDistDir: string; numberOfRuns: number; settings: Record<string, unknown> };
      assert: { assertions: Record<string, unknown> };
      upload: Record<string, unknown>;
    };
  }
  const aplicacion = JSON.parse(leer('lighthouserc.json')) as Configuracion;
  const landing = JSON.parse(leer('lighthouserc.sitio.json')) as Configuracion;

  it('audits the folder the landing builds into, not the one of the app', () => {
    expect(landing.ci.collect.staticDistDir).toBe('./sitio/dist');
    expect(aplicacion.ci.collect.staticDistDir).toBe('./dist');
  });

  it('uses the same phone profile as the rest of the project: it does not override the emulation of Lighthouse', () => {
    expect(landing.ci.collect.settings).toEqual(aplicacion.ci.collect.settings);
    expect(landing.ci.collect.numberOfRuns).toBe(aplicacion.ci.collect.numberOfRuns);
    for (const clave of ['formFactor', 'screenEmulation', 'throttling', 'throttlingMethod']) {
      expect(landing.ci.collect.settings).not.toHaveProperty(clave);
    }
  });

  it('asks for a perfect accessibility, and only warns when performance or best practices fall below 0.9', () => {
    expect(landing.ci.assert.assertions).toEqual({
      'categories:accessibility': ['error', { minScore: 1 }],
      'categories:performance': ['warn', { minScore: 0.9 }],
      'categories:best-practices': ['warn', { minScore: 0.9 }],
    });
    expect(landing.ci.assert.assertions).toEqual(aplicacion.ci.assert.assertions);
  });

  it('is run by its own command, next to the one of the app', () => {
    expect(paquete.scripts['lighthouse:sitio']).toContain('--config=lighthouserc.sitio.json');
    expect(paquete.scripts['lighthouse']).toContain('--config=lighthouserc.json');
  });
});

describe('the browser tests of the landing', () => {
  const principal = leer('playwright.config.ts');
  const sitio = leer('e2e/sitio/playwright.config.ts');

  it('have their own command', () => {
    expect(paquete.scripts['e2e:sitio']).toBe(
      'playwright test --config e2e/sitio/playwright.config.ts',
    );
  });

  it('are left out of the run of the app, which needs a stack the landing does not use', () => {
    expect(principal).toContain("testIgnore: 'sitio/**'");
  });

  it('run in Chromium only and at the width of a phone', () => {
    expect(sitio).toContain("name: 'chromium'");
    expect(sitio).not.toContain("name: 'firefox'");
    expect(sitio).not.toContain("name: 'webkit'");
    expect(sitio).toContain('width: 375');
  });

  it('build the landing and serve it exactly as it comes out, on a port of their own', () => {
    expect(sitio).toContain('npm run build:sitio && npm run preview:sitio');
    expect(sitio).toContain('--strictPort');
    expect(PUERTO_DEL_SITIO).not.toBe(4129);
    expect(PUERTO_DEL_SITIO).not.toBe(4173);
  });

  it('are part of what the type checker and the linter read, because they live in e2e/', () => {
    expect(leer('tsconfig.e2e.json')).toContain('"e2e"');
    expect(leer('tsconfig.eslint.json')).toContain('"e2e"');
  });

  it('measure the first load against the budget that is written in scripts/presupuesto-sitio.json', () => {
    expect(leer('e2e/sitio/carga-inicial.spec.ts')).toContain('presupuesto-sitio.json');
  });
});

describe('the document', () => {
  const documento = prosa('docs/rendimiento-de-la-landing.md');
  const presupuesto = JSON.parse(leer('scripts/presupuesto-sitio.json')) as Record<string, number>;

  it('names every limit of the budget with its number, so the document and the file cannot drift apart', () => {
    for (const [clave, limite] of Object.entries(presupuesto)) {
      expect(documento, clave).toContain(`\`${clave}\``);
      expect(documento, `${clave}: ${String(limite)}`).toMatch(
        new RegExp(`\`${clave}\`[^|]*\\|\\s*${String(limite)}\\s`),
      );
    }
  });

  it('gives the commands to run what the CI runs', () => {
    for (const texto of [
      'npm run build:sitio',
      'npm run lighthouse:sitio',
      'npm run e2e:sitio',
      'CHROME_PATH',
    ]) {
      expect(documento).toContain(texto);
    }
  });

  it('names the two jobs of the CI, with the names they have', () => {
    expect(documento).toContain('«Landing (Lighthouse)»');
    expect(documento).toContain('«Landing (navegador)»');
  });

  it('says what was measured, with the profile of the phone and the date', () => {
    expect(documento).toContain('Moto G Power');
    expect(documento).toContain('23 de octubre de 2026');
    expect(documento).toMatch(/accesibilidad 100/i);
  });

  it('says what it does not cover, and that the reading aloud is still to be done', () => {
    expect(documento).toContain('Lo que no cubre');
    expect(documento).toContain('lectura en voz alta');
    expect(documento).toMatch(/teléfono real/);
  });

  it('keeps what Lighthouse suggests and was left undone, with the reason', () => {
    expect(documento).toContain('Lo que Lighthouse sugiere y no se hizo');
    expect(documento).toContain('logo-stock.webp');
    expect(documento).toContain('meta description');
  });

  it('is linked from the README, from CONTRIBUTING.md and from the document of performance of the app', () => {
    expect(leer('README.md')).toContain('docs/rendimiento-de-la-landing.md');
    expect(leer('CONTRIBUTING.md')).toContain('docs/rendimiento-de-la-landing.md');
    expect(leer('docs/rendimiento.md')).toContain('rendimiento-de-la-landing.md');
  });
});
