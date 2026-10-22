// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Cloudflare Pages lee las reglas de cache de `public/_headers` (ADR 0031 del backend). Lo que `npm run verify:deploy` comprueba desde fuera
// aqui se comprueba antes: el service worker y el manifiesto se vuelven a preguntar siempre (para que una version nueva se encuentre) y los
// archivos con huella de `/assets/` se guardan un ano.
const ROOT = resolve(import.meta.dirname, '../..');
const PUBLIC = join(ROOT, 'public');
const HEADERS = join(PUBLIC, '_headers');

interface Rule {
  readonly path: string;
  readonly headers: ReadonlyMap<string, string>;
}

/** Lee el formato de `_headers`: una linea sin sangria es la ruta y las que siguen, con sangria, son sus encabezados. */
function parse(text: string): Rule[] {
  const rules: { path: string; headers: Map<string, string> }[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      const current = rules.at(-1);
      if (current === undefined) throw new Error(`Un encabezado sin ruta: ${line}`);
      const colon = line.indexOf(':');
      if (colon === -1) throw new Error(`Un encabezado sin dos puntos: ${line}`);
      current.headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
    } else {
      rules.push({ path: line.trim(), headers: new Map() });
    }
  }
  return rules;
}

const text = existsSync(HEADERS) ? readFileSync(HEADERS, 'utf8') : '';
const rules = parse(text);

/** Lo que Cloudflare mezcla para una ruta: las reglas que le calzan, en orden. Un mismo encabezado en dos reglas se junta con coma. */
function headersFor(path: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const rule of rules) {
    const pattern = new RegExp(
      `^${rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`,
    );
    if (!pattern.test(path)) continue;
    for (const [name, value] of rule.headers) {
      const before = merged.get(name);
      merged.set(name, before === undefined ? value : `${before}, ${value}`);
    }
  }
  return merged;
}

describe('public/_headers', () => {
  it('exists, so that the host reads the cache rules from the site itself', () => {
    expect(existsSync(HEADERS)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('asks again every time for the service worker, or a new version would not be found', () => {
    expect(headersFor('/sw.js').get('cache-control')).toBe('no-cache');
  });

  it('asks again every time for the manifest', () => {
    expect(headersFor('/manifest.webmanifest').get('cache-control')).toBe('no-cache');
  });

  it('asks again every time for the page of the app', () => {
    expect(headersFor('/').get('cache-control')).toBe('no-cache');
    expect(headersFor('/index.html').get('cache-control')).toBe('no-cache');
  });

  it('keeps a year, without asking, the files with a hash in their name', () => {
    expect(headersFor('/assets/index-B1aEJvmV.js').get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(headersFor('/assets/index-B1aEJvmV.css').get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('never lets a rule for everything set the cache, because it would be joined to the specific ones', () => {
    const everything = rules.find((rule) => rule.path === '/*');
    expect(everything).toBeDefined();
    expect(everything?.headers.has('cache-control')).toBe(false);
  });

  it('tells the browser not to guess the type of a file and not to let the app be framed', () => {
    const any = headersFor('/mostrador');

    expect(any.get('x-content-type-options')).toBe('nosniff');
    expect(any.get('x-frame-options')).toBe('DENY');
    expect(any.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('turns off the sensors the app does not use', () => {
    expect(headersFor('/mostrador').get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('stays within what Cloudflare Pages reads: 100 rules and 2000 characters per line', () => {
    expect(rules.length).toBeLessThanOrEqual(100);
    for (const line of text.split(/\r?\n/)) expect(line.length).toBeLessThanOrEqual(2000);
  });

  it('has no 404.html, so that the host serves the app from any route', () => {
    const files = (directory: string): string[] =>
      readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);
        return statSync(path).isDirectory() ? files(path) : [name];
      });

    expect(files(PUBLIC)).not.toContain('404.html');
  });
});
