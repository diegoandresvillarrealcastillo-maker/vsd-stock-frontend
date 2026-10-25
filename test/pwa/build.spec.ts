import { Script } from 'node:vm';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { composeServiceWorker, shellPaths, versionOf } from '../../scripts/build-service-worker';
import { gzipSize, measure, startupFiles, violations } from '../../scripts/check-bundle-size';

describe('the list of files the service worker saves', () => {
  const dist = [
    'assets/index-1a2b3c.js',
    'assets/index-4d5e6f.css',
    'assets/index-1a2b3c.js.map',
    'assets/logo-stock-9f8e7d.webp',
    'favicon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'apple-touch-icon.png',
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    '_headers',
  ];

  it('saves the page as /, and everything the page needs to open', () => {
    expect(shellPaths(dist)).toEqual([
      '/',
      '/assets/index-1a2b3c.js',
      '/assets/index-4d5e6f.css',
      '/assets/logo-stock-9f8e7d.webp',
      '/favicon.png',
      '/icon-192.png',
      '/manifest.webmanifest',
    ]);
  });

  it('leaves out source maps, the service worker itself and what only the operating system asks for', () => {
    const paths = shellPaths(dist);

    for (const left of ['.map', 'sw.js', 'icon-512', 'maskable', 'apple-touch']) {
      expect(
        paths.some((path) => path.includes(left)),
        left,
      ).toBe(false);
    }
  });

  it('leaves out the rules of the host: it reads them and does not serve them, and one request that fails stops the whole install', () => {
    expect(shellPaths(dist).some((path) => path.includes('_headers'))).toBe(false);
    expect(shellPaths(['index.html', '_redirects'])).toEqual(['/']);
  });
});

describe('the version of the interface', () => {
  const files = new Map<string, string>([
    ['index.html', '<html>1</html>'],
    ['assets/app.js', 'console.log(1)'],
  ]);
  const read = (path: string) => Buffer.from(files.get(path) ?? '');
  const paths = ['/', '/assets/app.js'];

  it('is the same for the same files', () => {
    expect(versionOf(paths, read)).toBe(versionOf(paths, read));
    expect(versionOf(paths, read)).toMatch(/^[0-9a-f]{12}$/);
  });

  it('changes when the content of a file changes, so the browser installs the new version', () => {
    const before = versionOf(paths, read);
    files.set('assets/app.js', 'console.log(2)');

    expect(versionOf(paths, read)).not.toBe(before);
    files.set('assets/app.js', 'console.log(1)');
  });

  it('changes when a file is renamed, even with the same content', () => {
    files.set('assets/renamed.js', 'console.log(1)');

    expect(versionOf(['/', '/assets/renamed.js'], read)).not.toBe(versionOf(paths, read));
    files.delete('assets/renamed.js');
  });

  it('changes when a file is added', () => {
    files.set('assets/extra.js', 'x');

    expect(versionOf([...paths, '/assets/extra.js'], read)).not.toBe(versionOf(paths, read));
    files.delete('assets/extra.js');
  });
});

describe('the service worker that is written', () => {
  const source = readFileSync('service-worker/sw.ts', 'utf8');
  const composed = composeServiceWorker(source, ['/', '/assets/a.js'], 'v1');

  it('starts with the list and the version, before any code uses them', () => {
    expect(
      composed.startsWith(
        'const __PRECACHE__ = ["/","/assets/a.js"];\nconst __VERSION__ = "v1";\n',
      ),
    ).toBe(true);
  });

  it('is plain JavaScript: no types are left, and the browser can read it', () => {
    expect(composed).not.toMatch(/declare const|as unknown as|: Request|: Promise</);
    expect(() => new Script(composed)).not.toThrow();
  });
});

describe('the JavaScript the page asks for when it opens (C4-R0)', () => {
  const page = (head: string) =>
    `<!doctype html><html><head>${head}</head><body><div id="root"></div></body></html>`;

  it('is the module script and what it preloads, by file name', () => {
    const html = page(`
      <script type="module" crossorigin src="/assets/index-AAA.js"></script>
      <link rel="modulepreload" crossorigin href="/assets/vendor-BBB.js">
      <link rel="modulepreload" href="/assets/forms-CCC.js" />`);

    expect(startupFiles(html)).toEqual(['index-AAA.js', 'vendor-BBB.js', 'forms-CCC.js']);
  });

  it('does not count what is not JavaScript that loads right away: an inline script, a stylesheet, an icon', () => {
    const html = page(`
      <script>(function () { document.documentElement.dataset.theme = 'light'; })();</script>
      <link rel="icon" type="image/png" href="/favicon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <script type="module" src="/assets/index-AAA.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-DDD.css">`);

    expect(startupFiles(html)).toEqual(['index-AAA.js']);
  });

  it('reads the attributes in any order and with either kind of quote', () => {
    const html = page(`
      <script src='/assets/index-AAA.js' crossorigin type='module'></script>
      <link href="/assets/vendor-BBB.js" rel="modulepreload">`);

    expect(startupFiles(html)).toEqual(['index-AAA.js', 'vendor-BBB.js']);
  });

  it('reads tags written in capitals, as HTML allows', () => {
    const html = page(`
      <SCRIPT TYPE="module" SRC="/assets/index-AAA.js"></SCRIPT>
      <LINK REL="modulepreload" HREF="/assets/vendor-BBB.js">`);

    expect(startupFiles(html)).toEqual(['index-AAA.js', 'vendor-BBB.js']);
  });

  it('does not count a classic script with a source: only modules are what the application starts from', () => {
    expect(startupFiles(page('<script src="/assets/old.js"></script>'))).toEqual([]);
  });

  it('is nothing for a page that loads no module', () => {
    expect(startupFiles(page(''))).toEqual([]);
  });
});

describe('the weight budget', () => {
  const budget = {
    javascriptGzipKB: 10,
    startupJavascriptGzipKB: 5,
    cssGzipKB: 2,
    serviceWorkerGzipKB: 1,
  };
  /** Texto que casi no se comprime: pesa lo que mide. */
  const noise = (bytes: number) =>
    Buffer.from(Array.from({ length: bytes }, (_, i) => (i * 7919 + (i >> 3) * 31) % 251));

  it('measures JavaScript, CSS and the service worker apart, ignoring source maps and everything else', () => {
    const sizes = measure(
      [
        { name: 'index-a.js', content: noise(4000) },
        { name: 'chunk-b.js', content: noise(3000) },
        { name: 'index-a.css', content: noise(1500) },
        { name: 'sw.js', content: noise(500) },
        { name: 'index-a.js.map', content: noise(50000) },
        { name: 'logo.webp', content: noise(30000) },
      ],
      [],
    );

    expect(sizes.javascript).toBeGreaterThan(gzipSize(noise(4000)));
    expect(sizes.javascript).toBeLessThan(gzipSize(noise(4000)) + gzipSize(noise(3000)) + 50);
    expect(sizes.css).toBe(gzipSize(noise(1500)));
    expect(sizes.serviceWorker).toBe(gzipSize(noise(500)));
  });

  it('measures the start apart: only the files the page asks for when it opens, not the ones that wait for a screen', () => {
    const files = [
      { name: 'index-a.js', content: noise(4000) },
      { name: 'vendor-b.js', content: noise(3000) },
      { name: 'catalog-c.js', content: noise(6000) },
      { name: 'index-a.css', content: noise(1500) },
      { name: 'sw.js', content: noise(500) },
    ];

    const sizes = measure(files, ['index-a.js', 'vendor-b.js']);

    expect(sizes.startup).toBe(gzipSize(noise(4000)) + gzipSize(noise(3000)));
    expect(sizes.javascript).toBe(
      gzipSize(noise(4000)) + gzipSize(noise(3000)) + gzipSize(noise(6000)),
    );
    expect(sizes.startup).toBeLessThan(sizes.javascript);
  });

  it('counts a file of the start that was named but is not in dist as nothing, instead of failing the measurement', () => {
    const sizes = measure(
      [{ name: 'index-a.js', content: noise(1000) }],
      ['index-a.js', 'missing-z.js'],
    );

    expect(sizes.startup).toBe(gzipSize(noise(1000)));
  });

  it('measures what travels over the network, compressed: text that repeats weighs almost nothing', () => {
    expect(gzipSize(Buffer.from('a'.repeat(10_000)))).toBeLessThan(100);
  });

  it('says nothing when everything fits', () => {
    expect(
      violations(
        { javascript: 10 * 1024, startup: 5 * 1024, css: 1024, serviceWorker: 512 },
        budget,
      ),
    ).toEqual([]);
  });

  it('says which part is over, with its weight and its limit', () => {
    const problems = violations(
      { javascript: 10 * 1024 + 1, startup: 1024, css: 3 * 1024, serviceWorker: 100 },
      budget,
    );

    expect(problems).toEqual([
      'JavaScript pesa 10.0 KB comprimido y el presupuesto es 10 KB.',
      'CSS pesa 3.0 KB comprimido y el presupuesto es 2 KB.',
    ]);
  });

  it('says the start is over even when the whole fits: a screen that went back into the start must not hide behind the total', () => {
    const problems = violations(
      { javascript: 6 * 1024, startup: 5 * 1024 + 1, css: 1024, serviceWorker: 100 },
      budget,
    );

    expect(problems).toEqual([
      'El arranque (JavaScript) pesa 5.0 KB comprimido y el presupuesto es 5 KB.',
    ]);
  });

  it('says the start could not be measured when none of its files is in dist: a start that weighs nothing would pass any budget', () => {
    const problems = violations(
      { javascript: 6 * 1024, startup: 0, css: 1024, serviceWorker: 100 },
      budget,
    );

    expect(problems).toEqual([
      'El arranque no se pudo medir: ninguno de los archivos que pide dist/index.html está en dist.',
    ]);
  });

  it('keeps a budget that is real: neither zero nor so loose that nothing would ever break it', () => {
    const real = JSON.parse(readFileSync('scripts/bundle-budget.json', 'utf8')) as typeof budget;

    expect(real.javascriptGzipKB).toBeGreaterThan(100);
    expect(real.javascriptGzipKB).toBeLessThanOrEqual(200);
    expect(real.cssGzipKB).toBeGreaterThan(0);
    expect(real.serviceWorkerGzipKB).toBeGreaterThan(0);
  });

  it('keeps a start budget that is real: well under the whole, because the administration screens wait outside it', () => {
    const real = JSON.parse(readFileSync('scripts/bundle-budget.json', 'utf8')) as typeof budget;

    expect(real.startupJavascriptGzipKB).toBeGreaterThan(50);
    expect(real.startupJavascriptGzipKB).toBeLessThan(real.javascriptGzipKB * 0.9);
  });
});
