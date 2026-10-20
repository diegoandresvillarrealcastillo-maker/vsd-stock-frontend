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
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

export interface Budget {
  readonly javascriptGzipKB: number;
  readonly cssGzipKB: number;
  readonly serviceWorkerGzipKB: number;
}

export interface Sizes {
  readonly javascript: number;
  readonly css: number;
  readonly serviceWorker: number;
}

const KB = 1024;

export function gzipSize(content: Uint8Array): number {
  return gzipSync(content, { level: 9 }).length;
}

/** Lo que pesa cada clase de archivo de `dist`, en bytes comprimidos. Los mapas de fuentes no se descargan: no cuentan. */
export function measure(
  files: readonly { readonly name: string; readonly content: Uint8Array }[],
): Sizes {
  let javascript = 0;
  let css = 0;
  let serviceWorker = 0;
  for (const { name, content } of files) {
    if (name === 'sw.js') serviceWorker += gzipSize(content);
    else if (name.endsWith('.js')) javascript += gzipSize(content);
    else if (name.endsWith('.css')) css += gzipSize(content);
  }
  return { javascript, css, serviceWorker };
}

/** Una frase por cada presupuesto que se pasa; vacio si todo cabe. */
export function violations(sizes: Sizes, budget: Budget): string[] {
  const rows: [string, number, number][] = [
    ['JavaScript', sizes.javascript, budget.javascriptGzipKB],
    ['CSS', sizes.css, budget.cssGzipKB],
    ['Service worker', sizes.serviceWorker, budget.serviceWorkerGzipKB],
  ];
  return rows
    .filter(([, bytes, limit]) => bytes > limit * KB)
    .map(
      ([name, bytes, limit]) =>
        `${name} pesa ${(bytes / KB).toFixed(1)} KB comprimido y el presupuesto es ${limit} KB.`,
    );
}

function filesIn(folder: string): { name: string; content: Uint8Array }[] {
  return readdirSync(folder)
    .filter((name) => statSync(join(folder, name)).isFile())
    .map((name) => ({ name, content: readFileSync(join(folder, name)) }));
}

function main(): void {
  const budget = JSON.parse(readFileSync('scripts/bundle-budget.json', 'utf8')) as Budget;
  const sizes = measure([...filesIn('dist/assets'), ...filesIn('dist')]);
  console.log(
    `JavaScript ${(sizes.javascript / KB).toFixed(1)} KB (presupuesto ${budget.javascriptGzipKB}), ` +
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
