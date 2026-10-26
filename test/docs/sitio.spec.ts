// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CARPETA_DEL_SITIO,
  PROYECTO_DEL_SITIO,
  RAMA_DE_PRODUCCION,
} from '../../scripts/publicar-sitio';
import { NOMBRES_DE_COMPROBACIONES } from '../../scripts/verificar-sitio';
import { APP_INGRESAR, APP_REGISTRARSE } from '../../sitio/pagina/destinos';

// La landing la publica una persona con un comando (C4-L8). Esta guia es lo que esa persona lee: aqui se vigila que no se quede atras del
// codigo, que diga los comandos que existen, el nombre del proyecto y de la rama como los tiene el script, y cada cosa que se comprueba al verificar.
const ROOT = resolve(import.meta.dirname, '../..');
const GUIA = join(ROOT, 'docs', 'sitio.md');
const guia = existsSync(GUIA) ? readFileSync(GUIA, 'utf8').replaceAll('\r\n', '\n') : '';
const scripts = (
  JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

describe('docs/sitio.md', () => {
  it('exists', () => {
    expect(existsSync(GUIA)).toBe(true);
  });

  it('only names commands that exist in package.json', () => {
    const nombrados = [...new Set([...guia.matchAll(/npm run ([a-z0-9:-]+)/g)].map((m) => m[1]))];

    expect(nombrados.length).toBeGreaterThan(0);
    for (const comando of nombrados)
      expect(scripts[comando ?? ''], `npm run ${comando ?? ''}`).toBeDefined();
  });

  it('names the three commands of the way: build, publish and verify', () => {
    for (const comando of ['build:sitio', 'publish:sitio', 'verify:sitio']) {
      expect(guia, comando).toContain(`npm run ${comando}`);
    }
  });

  it('names the project, the production branch and the folder just as the script has them', () => {
    expect(guia).toContain(`\`${PROYECTO_DEL_SITIO}\``);
    expect(guia).toContain(`\`${RAMA_DE_PRODUCCION}\``);
    expect(guia).toContain(`\`${CARPETA_DEL_SITIO}\``);
  });

  it('gives what is done once: the login in the browser and the creation of the project with its production branch', () => {
    expect(guia).toContain('wrangler login');
    expect(guia).toContain(
      `wrangler pages project create ${PROYECTO_DEL_SITIO} --production-branch ${RAMA_DE_PRODUCCION}`,
    );
  });

  it('gives --force to create the project and says why: Wrangler 4.151 or later sends the creation to Workers and fails', () => {
    expect(guia).toContain(
      `wrangler pages project create ${PROYECTO_DEL_SITIO} --production-branch ${RAMA_DE_PRODUCCION} --force`,
    );
    expect(guia).toContain('Missing entry-point to Worker script');
    expect(guia).toMatch(/4\.151/);
    // Solo la creacion lleva --force: la subida va directo a Pages y la guia no lo pide.
    expect(guia).not.toMatch(/pages deploy[^\n]*--force/);
  });

  it('warns not to use wrangler deploy, which creates a Worker and not a Pages project', () => {
    expect(guia).toMatch(/No uses `wrangler deploy`/);
  });

  it('says that a preview goes out from any branch and that the public address goes out only from desarrollo already merged', () => {
    expect(guia).toContain('--vista-previa');
    expect(guia).toContain('--produccion');
    expect(guia).toMatch(/fusionad/i);
    expect(guia).toMatch(/cambios sin confirmar/i);
    expect(guia).toContain('origin/desarrollo');
  });

  it('says that the public address stops while something is pending, and where that list lives', () => {
    expect(guia).toContain('PENDIENTES_DE_PUBLICAR');
    expect(guia).toContain('sitio/pagina/pendientes.ts');
    expect(guia).toMatch(/pendient/i);
  });

  it('says where each button goes: sign-in and sign-up to the web of PRE, the contact to WhatsApp, and that the account is a test one until PROD exists', () => {
    expect(guia).toContain('## A dónde lleva cada botón');
    expect(guia).toContain(APP_INGRESAR);
    expect(guia).toContain(APP_REGISTRARSE);
    expect(guia).toContain('25 de octubre de 2026');
    expect(guia).toMatch(/Iniciar sesi[óo]n/);
    expect(guia).toMatch(/Crear cuenta/);
    expect(guia).toMatch(/WhatsApp/);
    expect(guia).toMatch(/cuando exista PROD/i);
    expect(guia).toMatch(/ambiente de pruebas/i);
    expect(guia).toContain('sitio/pagina/destinos.ts');
  });

  it.each([...NOMBRES_DE_COMPROBACIONES])(
    'says that the check "%s" is made when verifying',
    (nombre) => {
      expect(guia).toContain(nombre);
    },
  );

  it('says how to change the subdomain: the name of the project is the subdomain, a project cannot be renamed, and a domain of its own is added in the panel', () => {
    expect(guia).toContain('pages.dev');
    expect(guia).toMatch(/no se puede renombrar|no se renombra/i);
    expect(guia).toMatch(/dominio propio|dominio personalizado/i);
  });

  it('says to keep Web Analytics off, because the page has no analytics and its policy of content would block it', () => {
    expect(guia).toContain('Web Analytics');
    expect(guia).toMatch(/anal[ií]tica/i);
  });

  it('says that no key is pasted anywhere: the login is made in the browser', () => {
    expect(guia).toMatch(/no pegues|nunca se pega|no se pega/i);
    expect(guia).not.toMatch(/CLOUDFLARE_API_TOKEN\s*=\s*\S/);
  });

  it('says what it does not prove', () => {
    expect(guia).toMatch(/Lo que no comprueba/i);
  });

  it('says how the text is written, in the words of a shopkeeper, and which test keeps the jargon out', () => {
    expect(guia).toContain('## Cómo se escribe el texto');
    expect(guia).toContain('sitio/pagina/contenido.ts');
    expect(guia).toContain('test/sitio/afirmaciones.spec.ts');
    expect(guia).toMatch(/lenguaje de tendero/i);
  });

  it('links to the other documents of the landing, and they exist', () => {
    for (const nombre of [
      'diagrama-de-la-venta',
      'banda-de-la-demo',
      'rendimiento-de-la-landing',
      'mascotas',
      'despliegue-de-la-web',
    ]) {
      expect(guia, nombre).toContain(`${nombre}.md`);
      expect(existsSync(join(ROOT, 'docs', `${nombre}.md`)), nombre).toBe(true);
    }
  });

  it('only names documents that exist: every docs/*.md and every link to a .md file points to a file of the repository', () => {
    const rutas = [
      ...[...guia.matchAll(/\bdocs\/([\w.-]+\.md)\b/g)].map((m) => join(ROOT, 'docs', m[1] ?? '')),
      ...[...guia.matchAll(/\]\((?!https?:)([^)#\s]+\.md)/g)].map((m) =>
        resolve(ROOT, 'docs', m[1] ?? ''),
      ),
    ];

    expect(rutas.length).toBeGreaterThan(5);
    for (const ruta of rutas) expect(existsSync(ruta), ruta).toBe(true);
  });

  it('is linked from the README', () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain('docs/sitio.md');
  });
});
