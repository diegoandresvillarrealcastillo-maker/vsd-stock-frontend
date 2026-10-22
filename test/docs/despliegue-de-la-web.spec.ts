// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// La web de PRE la crea una persona en un panel que el asistente no opera (ADR 0031 del backend): lo unico que se le puede dejar es una
// lista que se pueda seguir. Estas pruebas vigilan que la lista no se quede atras del codigo: que diga cada variable que la aplicacion lee al
// compilarse y los ajustes del host de los que depende que la comprobacion de `npm run verify:deploy` pase.
const ROOT = resolve(import.meta.dirname, '../..');
const GUIDE = join(ROOT, 'docs', 'despliegue-de-la-web.md');
const guide = existsSync(GUIDE) ? readFileSync(GUIDE, 'utf8').replaceAll('\r\n', '\n') : '';

/** Todos los archivos de codigo de la aplicacion (sin sus pruebas). */
function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.spec\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Las variables VITE_ que el codigo lee de verdad: son lo que hay que fijar en el host. */
const variables = [
  ...new Set(
    sources(join(ROOT, 'src')).flatMap(
      (file) => readFileSync(file, 'utf8').match(/\bVITE_[A-Z0-9_]+\b/g) ?? [],
    ),
  ),
].sort();

describe('docs/despliegue-de-la-web.md', () => {
  it('exists', () => {
    expect(existsSync(GUIDE)).toBe(true);
  });

  it('finds the variables that the code reads when it is built', () => {
    expect(variables).toEqual(['VITE_API_URL', 'VITE_AUTH_PUBLISHABLE_KEY', 'VITE_AUTH_URL']);
  });

  it.each(variables)('says what to put in %s', (name) => {
    expect(guide).toContain(`\`${name}\``);
  });

  it('copies each variable to .env.example too, so that nobody has to look for it in two places', () => {
    const example = readFileSync(join(ROOT, '.env.example'), 'utf8');

    for (const name of variables) expect(example, name).toContain(name);
  });

  it('says that what is compiled is public, and never to put a secret key', () => {
    expect(guide).toMatch(/p[úu]blic/i);
    expect(guide).toContain('sb_secret_');
    expect(guide).toContain('service_role');
  });

  it('gives the settings of the host: branch, build command, output folder and Node version', () => {
    expect(guide).toContain('`preproduccion`');
    expect(guide).toContain('`npm run build`');
    expect(guide).toContain('`dist`');
    expect(guide).toContain('`NODE_VERSION`');
    expect(readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim()).toBe('24');
    expect(guide).toContain('`24`');
  });

  it('says that a variable is fixed when the app is built, so changing it needs a new deployment', () => {
    expect(guide).toMatch(/al compilar|se compila|nuevo despliegue/i);
  });

  it('says to give the API the exact address of the web as CORS_ORIGINS, without a slash at the end', () => {
    expect(guide).toContain('`CORS_ORIGINS`');
    expect(guide).toMatch(/sin (la )?barra/i);
  });

  it('says not to add a 404.html, because the app is served from any route without one', () => {
    expect(guide).toContain('`404.html`');
  });

  it('explains the rules of public/_headers and that the host does not serve that file', () => {
    expect(guide).toContain('`public/_headers`');
    expect(guide).toContain('`sw.js`');
    expect(guide).toContain('`/assets/*`');
  });

  it('gives the command that checks it from outside, and the check from a phone', () => {
    expect(guide).toContain('npm run verify:deploy');
    expect(guide).toMatch(/tel[ée]fono/i);
    expect(guide).toMatch(/sin (conexi[óo]n|red|internet)/i);
  });

  it('gives the direct upload, for when the panel only offers to create a Worker, with the commands that worked', () => {
    expect(guide).toMatch(/solo ofrec[ií]a crear un \*\*Worker\*\*/);
    expect(guide).toContain(
      'npx wrangler pages project create vsd-stock-pre --production-branch preproduccion',
    );
    expect(guide).toContain(
      'npx wrangler pages deploy dist --project-name vsd-stock-pre --branch preproduccion',
    );
    // El error que se comete en ese panel: `wrangler deploy` crea un Worker, no un proyecto de Pages.
    expect(guide).toContain('`wrangler deploy`');
  });

  it('says there is no automatic deployment with the direct upload, so an old web does not go unnoticed', () => {
    expect(guide).toMatch(/no hay despliegue autom[áa]tico/i);
    expect(guide).toMatch(/se queda con la versi[óo]n vieja/i);
  });

  it('keeps the variables out of the shell after building, and never asks for a secret one', () => {
    expect(guide).toContain('Remove-Item Env:VITE_API_URL');
    expect(guide).not.toMatch(/\$env:VITE_AUTH_PUBLISHABLE_KEY = 'sb_secret_/);
  });

  it('leaves the automatic deployment for PROD as something that was not decided here', () => {
    const notDecided =
      guide.split(/^## /m).find((part) => part.startsWith('Lo que no se decidió aquí')) ?? '';

    expect(notDecided).toMatch(/despliegue autom[áa]tico/i);
    expect(notDecided).toMatch(/ADR/);
  });

  it('says how to go back', () => {
    expect(guide).toMatch(/rollback/i);
  });

  it('is linked from the README', () => {
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain('docs/despliegue-de-la-web.md');
  });
});
