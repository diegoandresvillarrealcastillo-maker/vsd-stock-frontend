// Termina de compilar la landing (C4-L1, ADR 0033 del backend) despues de `vite build` (la parte del navegador) y de
// `vite build --ssr` (la parte que se prerenderiza). Corre directamente en Node 24, que ejecuta TypeScript quitando los
// tipos: por eso este archivo no usa sintaxis que necesite compilarse ni importa otros archivos del proyecto (los dos que
// necesita los carga con `import()`).
//
//   node scripts/build-sitio.ts      lee sitio/dist/ y sitio/dist-ssr/ y deja sitio/dist/ listo para publicar
//
// Hace tres cosas: pinta en `sitio/dist/index.html` el HTML de la pagina (el texto queda en el documento sin ejecutar JavaScript,
// y el navegador monta React encima), escribe la politica de contenido con la huella de cada script en linea, y deja las
// reglas de cache de Cloudflare Pages en `sitio/dist/_headers`.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const PLACEHOLDER = '<!--app-->';

/** Pone la pagina prerenderizada en el lugar que le dejo `sitio/index.html`; sin lugar o sin pagina, falla en vez de publicar un documento vacio. */
export function injectApp(template: string, html: string): string {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(
      `El documento no tiene el lugar de la pagina (${PLACEHOLDER}) dentro de #root.`,
    );
  }
  if (html.trim() === '') {
    throw new Error('La pagina prerenderizada salio vacia: el documento quedaria sin texto.');
  }
  // La pagina entra como funcion: como texto, un `$&` o un `$1` de un precio se leerian como patrones de `replace`.
  return template.replace(PLACEHOLDER, () => html);
}

/**
 * La huella que el navegador calcula de cada script en linea, en la forma que la politica de contenido espera:
 * `'sha256-<base64>'`. Se calcula sobre el texto exacto entre las etiquetas, con sus espacios y sus saltos de linea.
 * Los scripts que cargan de un archivo (`src`) no entran: la politica los deja pasar por su origen.
 */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    hashes.push(
      `'sha256-${createHash('sha256')
        .update(match[1] ?? '')
        .digest('base64')}'`,
    );
  }
  return hashes;
}

/**
 * Las reglas de Cloudflare Pages de la landing (`_headers`). La politica de contenido deja pasar scripts propios y las huellas
 * de los que estan en linea, nunca `unsafe-inline` ni `unsafe-eval`, y solo deja que la pagina le hable a su propio sitio: es una pagina
 * para leer y no le pide nada a ningun servidor (el chip que despertaba la API de PRE se quito en LND-2).
 */
export function siteHeaders({ hashes }: { readonly hashes: readonly string[] }): string {
  const policy = [
    "default-src 'self'",
    ["script-src 'self'", ...hashes].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  return `# Reglas de Cloudflare Pages de la landing (ADR 0033 del backend). Las escribe scripts/build-sitio.ts al compilar.
# La regla de todo (/*) no lleva Cache-Control: se juntaria con la de las rutas que le calzan (mismo motivo que public/_headers).
# style-src permite estilos en linea porque React escribe atributos style y las animaciones los usan; los scripts no: solo
# los propios y los que tienen su huella.

/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${policy}

/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

async function main(): Promise<void> {
  const dist = 'sitio/dist';
  const load = async (path: string): Promise<unknown> => import(pathToFileURL(resolve(path)).href);
  const { render } = (await load('sitio/dist-ssr/entry-server.js')) as { render: () => string };

  const page = injectApp(readFileSync(join(dist, 'index.html'), 'utf8'), render());
  writeFileSync(join(dist, 'index.html'), page);
  const hashes = inlineScriptHashes(page);
  writeFileSync(join(dist, '_headers'), siteHeaders({ hashes }));
  console.log(
    `Landing lista en ${dist}/: pagina prerenderizada (${String(page.length)} caracteres) y ${String(hashes.length)} script(s) en linea con huella.`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
