import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { composeServiceWorker } from '../../scripts/build-service-worker';

// El service worker se ejecuta TAL COMO SE DESPLIEGA: el mismo archivo, con los tipos quitados y la lista y la version
// antepuestas por `scripts/build-service-worker.ts`. Lo unico de mentira es lo que el navegador le da (`self`, `caches`,
// `fetch`), para ver que guarda, que sirve y, sobre todo, que NO toca.

const ORIGIN = 'https://stock.example.com';
const PRECACHE = ['/', '/assets/app-1a2b3c.js', '/assets/app-4d5e6f.css', '/favicon.png'];
const VERSION = 'abc123def456';
const CACHE = `vsd-stock-shell-${VERSION}`;

class FakeCache {
  readonly files = new Map<string, string>();
  readonly puts: string[] = [];
  addAllCalls: string[][] = [];

  addAll(paths: string[]): Promise<void> {
    this.addAllCalls.push(paths);
    for (const path of paths) this.files.set(path, `contenido de ${path}`);
    return Promise.resolve();
  }

  put(path: string): Promise<void> {
    this.puts.push(path);
    return Promise.resolve();
  }

  match(path: string): Promise<string | undefined> {
    return Promise.resolve(this.files.get(path));
  }
}

class FakeCaches {
  readonly stores = new Map<string, FakeCache>();

  open(name: string): Promise<FakeCache> {
    let store = this.stores.get(name);
    if (store === undefined) {
      store = new FakeCache();
      this.stores.set(name, store);
    }
    return Promise.resolve(store);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.stores.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.stores.delete(name));
  }
}

interface FetchEventLike {
  request: { method: string; url: string; mode: string };
  respondWith: (answer: Promise<unknown>) => void;
}

function deploy({ precache = PRECACHE } = {}) {
  const source = readFileSync('service-worker/sw.ts', 'utf8');
  const code = composeServiceWorker(source, precache, VERSION);

  const handlers = new Map<string, (event: unknown) => void>();
  const scope = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers.set(type, handler);
    },
    skipWaiting: vi.fn(() => Promise.resolve()),
    clients: { claim: vi.fn(() => Promise.resolve()) },
  };
  const caches = new FakeCaches();
  const network = vi.fn((request: unknown) => Promise.resolve(`red: ${JSON.stringify(request)}`));
  runInNewContext(code, { self: scope, caches, fetch: network, URL, Set, Promise });

  /** El navegador pide algo: devuelve lo que el service worker contesto, o `undefined` si no quiso atenderlo. */
  const ask = async (url: string, { method = 'GET', mode = 'cors' } = {}) => {
    let answer: Promise<unknown> | undefined;
    const event: FetchEventLike = {
      request: { method, url, mode },
      respondWith: (value) => {
        answer = value;
      },
    };
    handlers.get('fetch')?.(event);
    return { handled: answer !== undefined, body: await answer };
  };

  /** El navegador pide que algo ocurra durante un evento que espera una promesa (`install`, `activate`). */
  const lifecycle = async (type: 'install' | 'activate') => {
    let pending: Promise<unknown> | undefined;
    handlers.get(type)?.({
      waitUntil: (value: Promise<unknown>) => {
        pending = value;
      },
    });
    await pending;
  };

  const message = (data: unknown) => handlers.get('message')?.({ data });

  return { scope, caches, network, ask, lifecycle, message, handlers };
}

describe('the service worker, as it is deployed', () => {
  describe('installing', () => {
    it('saves the whole interface in a cache named after its version, and nothing else', async () => {
      const { caches, lifecycle } = deploy();

      await lifecycle('install');

      expect([...caches.stores.keys()]).toEqual([CACHE]);
      expect(caches.stores.get(CACHE)?.addAllCalls).toEqual([PRECACHE]);
    });

    it('does not take over by itself: a new version waits until the person decides', async () => {
      const { scope, lifecycle } = deploy();

      await lifecycle('install');

      expect(scope.skipWaiting).not.toHaveBeenCalled();
    });

    it('takes over when it is asked to, and only when it is asked', () => {
      const { scope, message } = deploy();

      message({ type: 'OTRA_COSA' });
      message(null);
      message('SKIP_WAITING');
      message(undefined);
      expect(scope.skipWaiting).not.toHaveBeenCalled();

      message({ type: 'SKIP_WAITING' });

      expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
    });
  });

  describe('activating', () => {
    it('deletes the caches of older versions, keeps everything else, and takes control of the open pages', async () => {
      const { scope, caches, lifecycle } = deploy();
      await lifecycle('install');
      await caches.open('vsd-stock-shell-version-vieja');
      await caches.open('de-otra-aplicacion');

      await lifecycle('activate');

      expect([...caches.stores.keys()].sort()).toEqual([CACHE, 'de-otra-aplicacion'].sort());
      expect(scope.clients.claim).toHaveBeenCalledTimes(1);
    });
  });

  describe('answering the interface', () => {
    it('answers every page of the application with the saved one, whatever its address', async () => {
      const { ask, lifecycle } = deploy();
      await lifecycle('install');

      for (const path of ['/', '/ventas', '/inventario/productos/42?x=1']) {
        const answer = await ask(`${ORIGIN}${path}`, { mode: 'navigate' });
        expect(answer, path).toEqual({ handled: true, body: 'contenido de /' });
      }
    });

    it('answers the saved files of the interface from the cache, without asking the network', async () => {
      const { ask, network, lifecycle } = deploy();
      await lifecycle('install');

      const script = await ask(`${ORIGIN}/assets/app-1a2b3c.js`);
      const style = await ask(`${ORIGIN}/assets/app-4d5e6f.css?v=2`);

      expect(script).toEqual({ handled: true, body: 'contenido de /assets/app-1a2b3c.js' });
      expect(style).toEqual({ handled: true, body: 'contenido de /assets/app-4d5e6f.css' });
      expect(network).not.toHaveBeenCalled();
    });

    it('goes to the network, without saving what comes back, when a saved file is missing', async () => {
      const { ask, network, caches, lifecycle } = deploy();
      await lifecycle('install');
      caches.stores.get(CACHE)?.files.delete('/favicon.png');

      const answer = await ask(`${ORIGIN}/favicon.png`);

      expect(answer.handled).toBe(true);
      expect(String(answer.body)).toContain('red:');
      expect(network).toHaveBeenCalledTimes(1);
      expect(caches.stores.get(CACHE)?.puts).toEqual([]);
    });
  });

  describe('what it never touches: the data', () => {
    const untouched = [
      ['a call to the API in another origin', 'https://api.example.com/v1/products', 'cors', 'GET'],
      ['a call to the identity service', 'https://abc.supabase.co/auth/v1/token', 'cors', 'POST'],
      ['an API route even if it came from the same origin', `${ORIGIN}/v1/products`, 'cors', 'GET'],
      ['a visit to an API address', `${ORIGIN}/v1/me`, 'navigate', 'GET'],
      ['a file that is not part of the interface', `${ORIGIN}/assets/otro.js`, 'cors', 'GET'],
      ['a write', `${ORIGIN}/assets/app-1a2b3c.js`, 'cors', 'POST'],
      ['a write to the application page', `${ORIGIN}/`, 'navigate', 'POST'],
      [
        'another origin that has the same path',
        'https://otro.example.com/assets/app-1a2b3c.js',
        'cors',
        'GET',
      ],
    ] as const;

    it.each(untouched)('leaves %s to the browser', async (_name, url, mode, method) => {
      const { ask, network, lifecycle } = deploy();
      await lifecycle('install');

      const answer = await ask(url, { method, mode });

      expect(answer.handled).toBe(false);
      expect(network).not.toHaveBeenCalled();
    });

    it('never writes to a cache once it is installed: nothing the network answers is kept', async () => {
      const { ask, caches, lifecycle } = deploy();
      await lifecycle('install');
      await lifecycle('activate');

      for (const [, url, mode, method] of untouched) await ask(url, { method, mode });
      await ask(`${ORIGIN}/assets/app-1a2b3c.js`);
      await ask(`${ORIGIN}/ventas`, { mode: 'navigate' });

      const writes = [...caches.stores.values()].flatMap((store) => store.puts);
      expect(writes).toEqual([]);
      expect(caches.stores.get(CACHE)?.addAllCalls).toHaveLength(1);
    });
  });
});

describe('the service worker source', () => {
  const source = readFileSync('service-worker/sw.ts', 'utf8');

  it('does not know how to write to a cache after install', () => {
    // La unica escritura es `addAll`, en el evento `install`: `put` y `add` guardarian respuestas a medida que llegan.
    expect(source).not.toMatch(/\.put\(/);
    expect(source).not.toMatch(/\.add\(/);
  });

  it('does not take over by itself', () => {
    const calls = source.match(/skipWaiting\(\)/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(source.indexOf('skipWaiting()')).toBeGreaterThan(source.indexOf("'message'"));
  });
});
