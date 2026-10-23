// Falla si lo que baja el navegador pesa mas que el presupuesto (C3-07, ADR 0030). Corre directamente en Node 24, que
// ejecuta TypeScript quitando los tipos: por eso este archivo no usa sintaxis que necesite compilarse ni importa otros
// archivos del proyecto.
//
//   node scripts/check-bundle-size.ts     mide dist/ y lo compara con scripts/bundle-budget.json
//
// El peso es el del archivo comprimido con gzip al nivel 9 (lo que cuesta por la red), igual que en
// `docs/rendimiento.md`. Se mide JavaScript, CSS y service worker por separado: un cambio que engorda uno no puede
// esconderse detras del margen de otro. Si el presupuesto no alcanza, se discute en el PR y se sube el numero con su
// razon; no se quita la comprobacion.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export interface Budget {
  readonly javascriptGzipKB: number;
  /** El JavaScript que la pagina pide al abrirse (C4-R0): lo que el mostrador paga siempre. Las pantallas de administracion no entran. */
  readonly startupJavascriptGzipKB: number;
  readonly cssGzipKB: number;
  readonly serviceWorkerGzipKB: number;
}

export interface Sizes {
  readonly javascript: number;
  readonly startup: number;
  readonly css: number;
  readonly serviceWorker: number;
}

const KB = 1024;

export function gzipSize(content: Uint8Array): number {
  return gzipSync(content, { level: 9 }).length;
}

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match?.[1] ?? match?.[2];
}

/**
 * Los archivos de JavaScript que la pagina pide al abrirse, por nombre de archivo: su script de modulo y lo que precarga. Las
 * pantallas que bajan cuando alguien entra a ellas (`import()`) no estan en `index.html`, y por eso no cuentan aqui.
 */
export function startupFiles(html: string): string[] {
  const files: string[] = [];
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const isScript = /^<script/i.test(tag);
    const url = isScript
      ? attribute(tag, 'type') === 'module'
        ? attribute(tag, 'src')
        : undefined
      : attribute(tag, 'rel') === 'modulepreload'
        ? attribute(tag, 'href')
        : undefined;
    if (url !== undefined) files.push(posix.basename(new URL(url, 'http://dist').pathname));
  }
  return files;
}

/**
 * Lo que pesa cada clase de archivo de `dist`, en bytes comprimidos, y aparte el JavaScript del arranque (los archivos que se le
 * dan en `startup`). Los mapas de fuentes no se descargan: no cuentan.
 */
export function measure(
  files: readonly { readonly name: string; readonly content: Uint8Array }[],
  startup: readonly string[],
): Sizes {
  const atStart = new Set(startup);
  let javascript = 0;
  let startupJavascript = 0;
  let css = 0;
  let serviceWorker = 0;
  for (const { name, content } of files) {
    if (name === 'sw.js') serviceWorker += gzipSize(content);
    else if (name.endsWith('.js')) {
      const size = gzipSize(content);
      javascript += size;
      if (atStart.has(name)) startupJavascript += size;
    } else if (name.endsWith('.css')) css += gzipSize(content);
  }
  return { javascript, startup: startupJavascript, css, serviceWorker };
}

/** Una frase por cada presupuesto que se pasa; vacio si todo cabe. */
export function violations(sizes: Sizes, budget: Budget): string[] {
  const rows: [string, number, number][] = [
    ['JavaScript', sizes.javascript, budget.javascriptGzipKB],
    ['El arranque (JavaScript)', sizes.startup, budget.startupJavascriptGzipKB],
    ['CSS', sizes.css, budget.cssGzipKB],
    ['Service worker', sizes.serviceWorker, budget.serviceWorkerGzipKB],
  ];
  const over = rows
    .filter(([, bytes, limit]) => bytes > limit * KB)
    .map(
      ([name, bytes, limit]) =>
        `${name} pesa ${(bytes / KB).toFixed(1)} KB comprimido y el presupuesto es ${limit} KB.`,
    );
  // Un arranque que no pesa nada pasaria cualquier presupuesto: si `index.html` y `assets/` no coinciden, se dice, no se calla.
  if (sizes.startup === 0) {
    over.push(
      'El arranque no se pudo medir: ninguno de los archivos que pide dist/index.html está en dist.',
    );
  }
  return over;
}

function filesIn(folder: string): { name: string; content: Uint8Array }[] {
  return readdirSync(folder)
    .filter((name) => statSync(join(folder, name)).isFile())
    .map((name) => ({ name, content: readFileSync(join(folder, name)) }));
}

function main(): void {
  const budget = JSON.parse(readFileSync('scripts/bundle-budget.json', 'utf8')) as Budget;
  const sizes = measure(
    [...filesIn('dist/assets'), ...filesIn('dist')],
    startupFiles(readFileSync('dist/index.html', 'utf8')),
  );
  console.log(
    `JavaScript ${(sizes.javascript / KB).toFixed(1)} KB (presupuesto ${budget.javascriptGzipKB}), ` +
      `arranque ${(sizes.startup / KB).toFixed(1)} KB (${budget.startupJavascriptGzipKB}), ` +
      `CSS ${(sizes.css / KB).toFixed(1)} KB (${budget.cssGzipKB}), ` +
      `service worker ${(sizes.serviceWorker / KB).toFixed(1)} KB (${budget.serviceWorkerGzipKB}); gzip nivel 9.`,
  );
  const problems = violations(sizes, budget);
  for (const problem of problems) console.error(`ERROR: ${problem}`);
  if (problems.length > 0) process.exit(1);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
