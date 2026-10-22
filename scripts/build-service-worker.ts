// Escribe `dist/sw.js` despues de `vite build` (C3-07, ADR 0030). Corre directamente en Node 24, que ejecuta TypeScript
// quitando los tipos: por eso este archivo no usa sintaxis que necesite compilarse ni importa otros archivos del
// proyecto.
//
//   node scripts/build-service-worker.ts           lee dist/ y escribe dist/sw.js
//
// El service worker (`service-worker/sw.ts`) es el mismo archivo que prueba `test/pwa/service-worker.spec.ts`: aqui solo se le
// quitan los tipos y se le antepone lo que depende de la compilacion, la lista de archivos de la interfaz y la version.
// La version cambia cuando cambia cualquiera de esos archivos, y con ella el nombre de la cache: asi el navegador instala
// la version nueva cuando hay algo nuevo y no antes.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Lo que el sistema operativo pide al instalar la aplicacion y la pagina nunca necesita sin red: no se guarda. Tampoco las reglas
 * del host (`_headers`, `_redirects`): Cloudflare Pages las lee y no las sirve, y una sola peticion que falle detiene la instalacion.
 */
const NOT_NEEDED_OFFLINE = new Set([
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'sw.js',
  '_headers',
  '_redirects',
]);

/** Todos los archivos de una carpeta, con rutas relativas y barras normales, en orden. */
function filesIn(root: string, folder = root): string[] {
  const found: string[] = [];
  for (const name of readdirSync(folder).sort()) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) {
      found.push(...filesIn(root, path));
    } else {
      found.push(relative(root, path).split(sep).join('/'));
    }
  }
  return found;
}

/**
 * Las direcciones que el service worker guarda: la pagina (`/`, que es `index.html`) y todo lo que `vite build` dejo para
 * ella, sin mapas de fuentes ni lo que solo necesita el sistema operativo.
 */
export function shellPaths(files: readonly string[]): string[] {
  return files
    .filter((file) => !file.endsWith('.map') && !NOT_NEEDED_OFFLINE.has(file))
    .map((file) => (file === 'index.html' ? '/' : `/${file}`))
    .sort();
}

/** Una huella de lo que hay que guardar: cambia si cambia cualquiera de los archivos o su contenido. */
export function versionOf(paths: readonly string[], read: (path: string) => Uint8Array): string {
  const hash = createHash('sha256');
  for (const path of paths) {
    const file = path === '/' ? 'index.html' : path.slice(1);
    hash.update(`${path}\0${createHash('sha256').update(read(file)).digest('hex')}\n`);
  }
  return hash.digest('hex').slice(0, 12);
}

/** El service worker listo para desplegar: el codigo sin tipos, precedido de la lista y la version. */
export function composeServiceWorker(
  source: string,
  paths: readonly string[],
  version: string,
): string {
  const banner = `const __PRECACHE__ = ${JSON.stringify(paths)};\nconst __VERSION__ = ${JSON.stringify(version)};\n`;
  return banner + stripTypeScriptTypes(source);
}

function main(): void {
  const dist = 'dist';
  const paths = shellPaths(filesIn(dist));
  if (!paths.includes('/')) {
    throw new Error('dist/ no tiene index.html: ejecuta primero `vite build`.');
  }
  const version = versionOf(paths, (file) => readFileSync(join(dist, file)));
  const source = readFileSync('service-worker/sw.ts', 'utf8');
  writeFileSync(join(dist, 'sw.js'), composeServiceWorker(source, paths, version));
  console.log(
    `Service worker escrito: version ${version}, ${paths.length} archivos de la interfaz.`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
