// @vitest-environment node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { injectApp, inlineScriptHashes, siteHeaders } from '../../scripts/build-sitio';

// La landing (ADR 0033 del backend) se compila aparte de la aplicacion: otra entrada de Vite, otra salida y sus propios comandos.
// Aqui se vigila lo que hace que sea aparte de verdad y que la pagina que sale no le pida nada a nadie: la salida propia, el
// documento de partida, el HTML prerenderizado que se inyecta y la politica de contenido con la huella de cada script en linea.
const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** El contenido del primer script en linea de una pagina. */
function inlineScript(page: string): string {
  return /<script>([\s\S]*?)<\/script\s*>/i.exec(page)?.[1] ?? '';
}

describe('how the site is built apart from the app', () => {
  const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

  it('has its own commands: dev:sitio, build:sitio and preview:sitio', () => {
    for (const name of ['dev:sitio', 'build:sitio', 'preview:sitio']) {
      expect(scripts[name], name).toBeDefined();
    }
    expect(scripts['dev:sitio']).toContain('--config sitio/vite.config.ts');
    expect(scripts['build:sitio']).toContain('--config sitio/vite.config.ts');
    expect(scripts['preview:sitio']).toContain('--config sitio/vite.config.ts');
  });

  it('builds twice, the browser one and the one that prerenders, and then writes the page and its headers', () => {
    const build = scripts['build:sitio'] ?? '';

    expect(build).toContain('tsc --noEmit --project sitio/tsconfig.json');
    expect(build).toMatch(/vite build --config sitio\/vite\.config\.ts(?! --ssr)/);
    expect(build).toContain('--ssr pagina/entry-server.tsx');
    expect(build).toContain('scripts/build-sitio.ts');
  });

  it('leaves the build of the app alone: nothing of the site travels in its package, its budget or its service worker', () => {
    expect(scripts['build']).not.toContain('sitio');
    expect(scripts['budget']).not.toContain('sitio');
    expect(scripts['build:e2e']).not.toContain('sitio');
  });

  it('checks the site with the same types as the app', () => {
    expect(scripts['typecheck']).toContain('tsc --noEmit --project sitio/tsconfig.json');
  });

  it('writes to sitio/dist, outside dist/, and is ignored by git, Prettier and ESLint like dist/', () => {
    const ignored: readonly (readonly [string, readonly string[]])[] = [
      ['.gitignore', ['/sitio/dist/', '/sitio/dist-ssr/']],
      ['.prettierignore', ['sitio/dist/', 'sitio/dist-ssr/']],
    ];
    for (const [file, lines] of ignored) {
      const present = read(file).split(/\r?\n/);
      for (const line of lines) expect(present, `${file}: ${line}`).toContain(line);
    }
    expect(read('eslint.config.mjs')).toContain("'sitio/dist/**'");
    expect(read('eslint.config.mjs')).toContain("'sitio/dist-ssr/**'");
  });

  it('is part of what ESLint, Vitest and the type check read', () => {
    expect(read('tsconfig.eslint.json')).toContain('"sitio"');
    expect(read('vite.config.ts')).toContain('sitio/pagina/**/*.spec.{ts,tsx}');
    expect(read('tsconfig.node.json')).toContain('sitio/vite.config.ts');
  });

  interface SiteConfig {
    root?: string;
    build?: { outDir?: string; emptyOutDir?: boolean; assetsInlineLimit?: number };
  }
  const siteConfig = async (): Promise<SiteConfig> =>
    ((await import('../../sitio/vite.config')) as { default: SiteConfig }).default;

  it('has its own Vite config, rooted in sitio/ and writing to dist/ inside it', async () => {
    const config = await siteConfig();

    expect(config.root?.replaceAll('\\', '/').replace(/\/$/, '')).toBe(
      join(ROOT, 'sitio').replaceAll('\\', '/'),
    );
    expect(config.build?.outDir).toBe('dist');
    expect(config.build?.emptyOutDir).toBe(true);
  });

  it('never writes a font inside the CSS: a data: font is blocked by font-src self and the page would load without it', async () => {
    expect((await siteConfig()).build?.assetsInlineLimit).toBe(0);
  });
});

describe('the CI', () => {
  it('builds the site in the quality job, so a change that breaks it never reaches desarrollo', () => {
    const flow = read('.github/workflows/ci.yml');
    const quality = flow.slice(flow.indexOf('  calidad:'), flow.indexOf('  contrato:'));

    expect(quality).toContain('run: npm run build:sitio');
  });
});

describe('the starting document of the site (sitio/index.html)', () => {
  const html = read('sitio/index.html');

  it('has a place for the prerendered page inside #root, and a module that starts it', () => {
    expect(html).toMatch(/<div id="root"><!--app--><\/div>/);
    expect(html).toContain('<script type="module" src="/pagina/main.tsx"></script>');
  });

  it('is in Spanish, adapts to the phone and follows the theme of the system', () => {
    expect(html).toContain('<html lang="es"');
    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1.0"');
    expect(html).toContain('name="color-scheme" content="light dark"');
  });

  it('paints the theme before React with the very same script of the app, so it can never disagree with it', () => {
    const own = inlineScript(html);

    expect(own.trim().length).toBeGreaterThan(0);
    expect(own).toBe(inlineScript(read('index.html')));
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</head>'));
  });

  it('asks nothing of anybody else: not a font, not a script, not a style from another host (ADR 0033)', () => {
    expect(html).not.toMatch(/(?:src|href)="https?:\/\//);
    expect(html).not.toMatch(/googleapis|gstatic|cdn\./);
  });

  it('has an icon that exists', () => {
    expect(html).toContain('href="/favicon.png"');
    expect(existsSync(join(ROOT, 'sitio/public/favicon.png'))).toBe(true);
  });
});

describe('putting the prerendered page into the document', () => {
  const template = '<body><div id="root"><!--app--></div><script src="/a.js"></script></body>';

  it('writes it inside #root and touches nothing else', () => {
    expect(injectApp(template, '<h1>Hola</h1>')).toBe(
      '<body><div id="root"><h1>Hola</h1></div><script src="/a.js"></script></body>',
    );
  });

  it('copies the page as it is: a dollar sign in a price is not a pattern of String.replace', () => {
    expect(injectApp(template, '<p>$ 11.900 $& $1</p>')).toContain('<p>$ 11.900 $& $1</p>');
  });

  it('refuses a document without the place for it, instead of publishing an empty page', () => {
    expect(() => injectApp('<div id="root"></div>', '<h1>Hola</h1>')).toThrow('<!--app-->');
  });

  it('refuses a page with nothing in it', () => {
    expect(() => injectApp(template, '   ')).toThrow('vacia');
  });
});

describe('the hash of every inline script', () => {
  const sha = (text: string): string =>
    `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

  it('is the SHA-256 of the exact text of the script, in base64 and between quotes, as the browser computes it', () => {
    expect(inlineScriptHashes('<script>abc</script>')).toEqual([
      "'sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='",
    ]);
  });

  it('counts the spaces and the line breaks of the script: one more byte is another hash', () => {
    expect(inlineScriptHashes('<script>\n  go();\n</script>')).toEqual([sha('\n  go();\n')]);
    expect(inlineScriptHashes('<script>go();</script>')).not.toEqual(
      inlineScriptHashes('<script> go();</script>'),
    );
  });

  it('skips the scripts that load from a file: the policy lets them in by origin', () => {
    expect(inlineScriptHashes('<script type="module" src="/assets/a.js"></script>')).toEqual([]);
  });

  it('finds them all, in order, whatever the case of the tags', () => {
    expect(inlineScriptHashes('<SCRIPT>one</SCRIPT><p>x</p><script >two</script >')).toEqual([
      sha('one'),
      sha('two'),
    ]);
  });

  it('hashes the script that the built document really has', () => {
    const page = read('sitio/index.html');

    expect(inlineScriptHashes(page)).toEqual([sha(inlineScript(page))]);
  });
});

describe('the headers of the site', () => {
  const hash = "'sha256-abc='";
  const text = siteHeaders({ hashes: [hash] });
  const csp = /Content-Security-Policy: (.*)/.exec(text)?.[1] ?? '';
  const directive = (name: string): string[] =>
    csp
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `))
      ?.split(' ')
      .slice(1) ?? [];

  it('lets in only its own scripts and the hash of each inline one, never "unsafe-inline" or "unsafe-eval"', () => {
    expect(directive('script-src')).toEqual(["'self'", hash]);
  });

  it('shuts everything the page does not use: objects, base, forms and being framed', () => {
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('base-uri')).toEqual(["'none'"]);
    expect(directive('form-action')).toEqual(["'none'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
  });

  it('serves everything from itself: fonts, images and the rest', () => {
    expect(directive('default-src')).toEqual(["'self'"]);
    expect(directive('font-src')).toEqual(["'self'"]);
    expect(directive('img-src')).toEqual(["'self'", 'data:']);
  });

  it('lets the page ask nobody but itself: it is a page to read, so it makes no request to any server (LND-2 took out the API ping)', () => {
    expect(directive('connect-src')).toEqual(["'self'"]);
    expect([...csp.matchAll(/https?:\/\/[^\s;]+/g)].map((match) => match[0])).toEqual([]);
  });

  it('allows inline styles, which React and the animations write, and says why only there', () => {
    expect(directive('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(text).toContain('# style-src');
  });

  it('keeps the rules of the app: no sniffing, no frames, no sensors', () => {
    expect(text).toContain('X-Content-Type-Options: nosniff');
    expect(text).toContain('X-Frame-Options: DENY');
    expect(text).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(text).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  });

  it('asks again every time for the page and keeps a year the files with a hash in their name', () => {
    expect(text).toMatch(/^\/\n {2}Cache-Control: no-cache$/m);
    expect(text).toMatch(/^\/index\.html\n {2}Cache-Control: no-cache$/m);
    expect(text).toMatch(/^\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
  });

  it('never sets the cache in the rule of everything, or it would be joined to the specific ones', () => {
    const everything = /^\/\*\n((?: {2}.*\n?)+)/m.exec(text)?.[1] ?? '';

    expect(everything.length).toBeGreaterThan(0);
    expect(everything).not.toMatch(/cache-control/i);
  });

  it('stays within what Cloudflare Pages reads: 2000 characters per line', () => {
    const many = siteHeaders({
      hashes: Array.from({ length: 5 }, (_, i) => `'sha256-${String(i).repeat(43)}='`),
    });

    for (const line of many.split('\n')) expect(line.length).toBeLessThanOrEqual(2000);
  });
});
