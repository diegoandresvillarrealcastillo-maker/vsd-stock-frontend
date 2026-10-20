import { describe, expect, it, vi } from 'vitest';
import { createPwa } from './create-pwa';

class FakeContainer extends EventTarget {
  controller: unknown = null;
  registered: string[] = [];

  register(url: string) {
    this.registered.push(url);
    return Promise.resolve(
      Object.assign(new EventTarget(), {
        waiting: null,
        installing: null,
        update: () => Promise.resolve(),
      }),
    );
  }
}

const environment = (overrides: { production?: boolean; storage?: object } = {}) => {
  const container = new FakeContainer();
  const persist = vi.fn(() => Promise.resolve(true));
  return {
    container,
    persist,
    env: {
      production: overrides.production ?? true,
      navigator: {
        serviceWorker: container,
        storage: overrides.storage ?? { persisted: () => Promise.resolve(false), persist },
      },
      document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
      reload: vi.fn(),
    },
  };
};

describe('createPwa', () => {
  it('installs /sw.js in the deployed application', async () => {
    const { container, env } = environment();
    const pwa = createPwa(env);

    pwa.updates.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(container.registered).toEqual(['/sw.js']);
  });

  it('installs nothing in the development server: a cached interface would hide the changes being made', async () => {
    const { container, env } = environment({ production: false });
    const pwa = createPwa(env);

    pwa.updates.start();
    await Promise.resolve();
    await Promise.resolve();

    expect(container.registered).toEqual([]);
    expect(pwa.updates.current().status).toBe('unsupported');
  });

  it('asks the browser to protect what is stored, with the real storage manager', async () => {
    const { persist, env } = environment();
    const pwa = createPwa(env);

    await pwa.storage.ensure();

    expect(persist).toHaveBeenCalledTimes(1);
    expect(pwa.storage.current()).toBe('protected');
  });

  it('works in a browser with neither service workers nor a storage manager', async () => {
    const pwa = createPwa({
      production: true,
      navigator: {},
      document: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
      reload: () => undefined,
    });

    pwa.updates.start();
    await pwa.storage.ensure();
    await Promise.resolve();

    expect(pwa.updates.current().status).toBe('unsupported');
    expect(pwa.storage.current()).toBe('unsupported');
  });
});
