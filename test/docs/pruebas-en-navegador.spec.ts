// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PORTS } from '../../e2e/support/stack';

// Las pruebas en navegador (C3-15) son una barrera que solo se ve cuando falla: si el trabajo del CI cambia de nombre, si alguien lo
// vuelve obligatorio para Firefox o WebKit sin querer, o si el documento deja de decir como correrlas, nadie avisa. Estas pruebas
// vigilan el documento, el trabajo del CI y lo que README.md y CONTRIBUTING.md le dicen a quien contribuye.
const raiz = resolve(import.meta.dirname, '../..');

function leer(ruta: string): string {
  expect(existsSync(resolve(raiz, ruta)), `falta ${ruta}`).toBe(true);
  return readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
}

/** Una frase de un documento como se lee: partida entre dos lineas (Prettier ajusta la prosa) sigue siendo la misma frase. */
function prosa(ruta: string): string {
  return leer(ruta).replaceAll(/\s+/g, ' ');
}

const documento = prosa('docs/pruebas-en-navegador.md');
const flujo = leer('.github/workflows/ci.yml');

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

describe('the document', () => {
  it('describes every test file of e2e/, so a new one cannot be left unexplained', () => {
    const archivos = readdirSync(resolve(raiz, 'e2e')).filter((nombre) =>
      nombre.endsWith('.spec.ts'),
    );

    expect(archivos.length).toBeGreaterThan(0);
    for (const archivo of archivos) expect(documento, archivo).toContain(`e2e/${archivo}`);
  });

  it('gives the commands to run them and the variables that move the stack', () => {
    for (const texto of [
      'npm run e2e:chromium',
      'npm run e2e',
      'npm run db:up',
      'npm run build:e2e',
      'VSD_BACKEND_DIR',
      'E2E_DB_PORT',
      'E2E_SEED',
    ]) {
      expect(documento).toContain(texto);
    }
  });

  it('says the ports the stack uses, the ones that are in the configuration and not others', () => {
    for (const puerto of Object.values(PORTS)) expect(documento).toContain(`\`${String(puerto)}\``);
  });

  it('explains that the e2e mode is the only one that lets http through, and only to this machine', () => {
    expect(documento).toContain('modo `e2e`');
    expect(documento).toMatch(/único.*http/);
    expect(documento).toMatch(/localhost.*127\.0\.0\.1.*\[::1\]/);
  });

  it('says that Chromium blocks and Firefox and WebKit are reported but do not block', () => {
    expect(documento).toContain('Chromium bloquea');
    expect(documento).toContain('«Navegador real (chromium)»');
    expect(documento).toMatch(/Firefox y WebKit se corren y se informan, pero no bloquean/);
  });

  it('explains why the CI is slow some days: the apt mirror, not the browser', () => {
    expect(documento).toContain('azure.archive.ubuntu.com');
    expect(documento).toContain('el navegador de Playwright se bajó en 3 s');
    expect(documento).toContain('Chromium se instala sin `--with-deps`');
    expect(documento).toContain('Firefox y WebKit siguen con `--with-deps`');
  });

  it('keeps the findings, the ones fixed and the ones left open, so nobody finds them again', () => {
    expect(documento).toContain('shiftId');
    expect(documento).toContain('Arreglado');
    expect(documento).toContain('No se arregló');
    expect(documento).toContain('versión nueva');
    expect(documento).toContain('serviceWorkers');
  });

  it('says what it does not cover', () => {
    expect(documento).toContain('Lo que no cubren');
    expect(documento).toContain('C3-16');
  });

  it('is linked from the README and from CONTRIBUTING.md', () => {
    expect(leer('README.md')).toContain('docs/pruebas-en-navegador.md');
    expect(leer('CONTRIBUTING.md')).toContain('docs/pruebas-en-navegador.md');
  });
});

describe('the configuration', () => {
  const configuracion = leer('playwright.config.ts');

  it('has the three browsers, as projects of their own', () => {
    for (const navegador of ['chromium', 'firefox', 'webkit']) {
      expect(configuracion).toContain(`name: '${navegador}'`);
    }
  });

  it('tests at the width of a phone, where it is sold', () => {
    expect(configuracion).toContain('width: 375');
  });

  it('keeps its reports out of version control, of the formatter and of the linter', () => {
    for (const carpeta of ['playwright-report/', 'blob-report/', 'test-results/']) {
      expect(leer('.gitignore'), carpeta).toContain(`\n${carpeta}\n`);
      expect(leer('.prettierignore'), carpeta).toContain(`\n${carpeta}\n`);
      expect(leer('eslint.config.mjs'), carpeta).toContain(`'${carpeta}**'`);
    }
  });

  it('is part of what the type checker and the linter read', () => {
    const paquete = JSON.parse(leer('package.json')) as { scripts: Record<string, string> };

    expect(paquete.scripts['typecheck']).toContain('tsc --noEmit --project tsconfig.e2e.json');
    expect(leer('tsconfig.e2e.json')).toContain('"include": ["e2e", "playwright.config.ts"]');
    expect(leer('tsconfig.eslint.json')).toContain('"e2e"');
    expect(leer('tsconfig.eslint.json')).toContain('"playwright.config.ts"');
  });
});

describe('the job of the CI', () => {
  const bloque = trabajo('navegador');

  it('is called «Navegador real (<browser>)», a name nobody renames by accident', () => {
    expect(bloque).toContain('name: Navegador real (${{ matrix.browser }})');
  });

  it('runs the three browsers, and one failing does not cancel the others', () => {
    expect(bloque).toContain('browser: [chromium, firefox, webkit]');
    expect(bloque).toContain('fail-fast: false');
  });

  it('only lets Firefox and WebKit fail without failing the run: Chromium has to be able to block', () => {
    expect(sinComentarios(bloque)).toContain(
      "continue-on-error: ${{ matrix.browser != 'chromium' }}",
    );
    expect(sinComentarios(bloque).match(/continue-on-error/g)).toHaveLength(1);
  });

  it('brings up a PostgreSQL of its own and tells the tests where it is', () => {
    expect(bloque).toContain('image: postgres:17');
    expect(bloque).toContain('POSTGRES_USER: stock');
    expect(bloque).toContain('POSTGRES_DB: stock_test');
    expect(bloque).toContain("E2E_DB_PORT: '5432'");
    expect(bloque).toMatch(/ports:\n\s+- 5432:5432/);
  });

  it('downloads the backend into the folder the tests look in, and installs it', () => {
    expect(bloque).toContain('repository: diegoandresvillarrealcastillo-maker/vsd-stock-backend');
    expect(bloque).toContain('path: vsd-stock-backend');
    expect(bloque).toContain('VSD_BACKEND_DIR: ${{ github.workspace }}/vsd-stock-backend');
    expect(bloque).toMatch(/working-directory: vsd-stock-backend\n\s+run: npm ci/);
  });

  // Un Pull Request apilado tiene por base la rama de otro PR, que solo existe en este repositorio: pedirsela al backend daba 404
  // (contrato) y un `git checkout` roto (navegadores). La rama se elige una vez por trabajo y los dos usan lo que se eligio.
  describe('the backend branch', () => {
    const URL_DEL_BACKEND =
      'https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend';

    /** El paso que elige la rama: desde su nombre hasta el siguiente paso del trabajo. */
    function paso(clave: string): string {
      const texto = sinComentarios(trabajo(clave));
      const inicio = texto.indexOf('- name: Elegir la rama del backend');
      expect(
        inicio,
        `falta el paso que elige la rama en el trabajo ${clave}`,
      ).toBeGreaterThanOrEqual(0);
      const resto = texto.slice(inicio + 1);
      const siguiente = resto.search(/^ {6}- name:/m);
      return siguiente === -1 ? resto : resto.slice(0, siguiente);
    }

    it.each(['contrato', 'navegador'])('is chosen in a step of the %s job', (clave) => {
      const elegir = paso(clave);

      expect(elegir).toContain('id: backend');
      expect(elegir).toContain('PROPIA: ${{ github.head_ref || github.ref_name }}');
      expect(elegir).toContain('BASE: ${{ github.base_ref }}');
      expect(elegir).toContain(
        `git ls-remote --exit-code --heads ${URL_DEL_BACKEND} "refs/heads/$RAMA"`,
      );
      expect(elegir).toContain('echo "ref=$RAMA" >> "$GITHUB_OUTPUT"');
      expect(elegir).toContain('echo "ref=desarrollo" >> "$GITHUB_OUTPUT"');
    });

    // Los tickets que tocan los dos repositorios usan el mismo nombre de rama en los dos: la del propio PR es la que trae el cambio del
    // backend que este necesita, aunque su base sea la rama de otro ticket que solo tocó el frontend.
    it.each(['contrato', 'navegador'])(
      'tries the branch of the pull request itself first, then its base, then desarrollo (%s job)',
      (clave) => {
        const elegir = paso(clave);

        expect(elegir).toContain('for RAMA in "$PROPIA" "$BASE"; do');
        expect(elegir).toMatch(/\[ -n "\$RAMA" \] \|\| continue/);
        expect(elegir.indexOf('for RAMA in')).toBeLessThan(elegir.indexOf('echo "ref=desarrollo"'));
      },
    );

    it.each(['contrato', 'navegador'])(
      'only moves on to the next one when the backend says it does not have the branch, not when the network fails (%s job)',
      (clave) => {
        const elegir = paso(clave);

        expect(elegir).toMatch(
          /CODIGO=\$\?\n\s+if \[ "\$CODIGO" -ne 2 \]; then\n\s+exit 1\n\s+fi\n\s+fi\n\s+done\n\s+echo "ref=desarrollo"/,
        );
        expect(elegir).toMatch(/echo "ref=\$RAMA" >> "\$GITHUB_OUTPUT"\n\s+exit 0/);
      },
    );

    it('is the one the contract is compared against', () => {
      const delContrato = sinComentarios(trabajo('contrato'));

      expect(delContrato).toContain('CONTRACT_REF: ${{ steps.backend.outputs.ref }}');
      expect(delContrato).not.toContain('CONTRACT_REF: ${{ github.base_ref');
    });

    it('is the one that is downloaded for the browsers', () => {
      expect(bloque).toContain('ref: ${{ steps.backend.outputs.ref }}');
      expect(sinComentarios(bloque)).not.toMatch(/ref: \$\{\{ github\.base_ref/);
    });

    it('is explained to whoever contributes, in the order it is tried', () => {
      const guia = prosa('CONTRIBUTING.md');

      expect(guia).toMatch(
        /la rama del backend es la primera que el backend tenga de estas: la de tu propio Pull Request[^.]*, la base del Pull Request y `desarrollo`\./,
      );
      expect(guia).toContain('se llama igual en los dos repositorios');
    });

    it('is chosen before it is used', () => {
      for (const clave of ['contrato', 'navegador']) {
        const texto = sinComentarios(trabajo(clave));

        expect(texto.indexOf('id: backend'), clave).toBeGreaterThanOrEqual(0);
        expect(texto.indexOf('id: backend'), clave).toBeLessThan(
          texto.indexOf('steps.backend.outputs.ref'),
        );
      }
    });
  });

  it('installs only the browser it is going to use, with the libraries it needs, and runs only that project', () => {
    expect(bloque).toContain('run: npx playwright install --with-deps ${{ matrix.browser }}');
    expect(bloque).toContain('run: npx playwright test --project=${{ matrix.browser }}');
  });

  it('installs Chromium, the one that blocks, without the system packages, so a slow apt mirror cannot hold it', () => {
    const pasos = sinComentarios(bloque);

    expect(pasos).toMatch(
      /if: matrix\.browser == 'chromium'\n\s+run: npx playwright install chromium\n/,
    );
    expect(pasos).not.toMatch(/install --with-deps chromium/);
  });

  it('keeps the system packages for Firefox and WebKit, which do need their libraries', () => {
    const pasos = sinComentarios(bloque);

    expect(pasos).toMatch(
      /if: matrix\.browser != 'chromium'\n\s+run: npx playwright install --with-deps \$\{\{ matrix\.browser \}\}\n/,
    );
  });

  it('saves the report as an artifact even when a test fails', () => {
    expect(bloque).toMatch(/if: always\(\)\n\s+uses: actions\/upload-artifact@/);
    expect(bloque).toContain('name: informes-navegador-${{ matrix.browser }}');
    expect(bloque).toContain('playwright-report/');
    expect(bloque).toContain('test-results/');
  });

  it('has a time limit, so a run that hangs does not hold the CI', () => {
    const minutos = Number(/timeout-minutes: (\d+)/.exec(bloque)?.[1]);

    expect(minutos).toBeGreaterThanOrEqual(15);
    expect(minutos).toBeLessThanOrEqual(45);
  });

  it('blocks nothing by itself: no other job waits for it', () => {
    expect(flujo.match(/needs:.*navegador/g)).toBeNull();
  });

  it.each(['secretos', 'commits', 'calidad', 'contrato', 'roturas', 'accesibilidad'])(
    'leaves the job %s as it was, with its name',
    (clave) => {
      expect(trabajo(clave)).toMatch(/^ {4}name: .+$/m);
    },
  );
});
