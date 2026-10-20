import { describe, expect, it, vi } from 'vitest';
import {
  BrowserAppShellHost,
  type ServiceWorkerContainerLike,
  type ServiceWorkerRegistrationLike,
  type WorkerLike,
} from './browser-app-shell-host';

class FakeWorker extends EventTarget implements WorkerLike {
  state = 'installing';
  readonly messages: unknown[] = [];

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  becomes(state: string): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget implements ServiceWorkerRegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updates = 0;
  updateFails = false;

  update(): Promise<unknown> {
    this.updates += 1;
    return this.updateFails ? Promise.reject(new Error('sin red')) : Promise.resolve(undefined);
  }

  /** El navegador encuentra una version nueva y empieza a instalarla. */
  foundNewVersion(): FakeWorker {
    const worker = new FakeWorker();
    this.installing = worker;
    this.dispatchEvent(new Event('updatefound'));
    return worker;
  }
}

class FakeContainer extends EventTarget implements ServiceWorkerContainerLike {
  controller: unknown = null;
  registration = new FakeRegistration();
  registered: { url: string; scope: string | undefined }[] = [];
  registerFails = false;

  register(url: string, options?: { scope?: string }): Promise<ServiceWorkerRegistrationLike> {
    this.registered.push({ url, scope: options?.scope });
    return this.registerFails
      ? Promise.reject(new Error('no se pudo'))
      : Promise.resolve(this.registration);
  }

  /** La version nueva toma el control de la pagina. */
  takesControl(): void {
    this.dispatchEvent(new Event('controllerchange'));
  }
}

class FakeDocument extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'hidden';

  become(state: 'visible' | 'hidden'): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

const setup = (overrides: { container?: FakeContainer | undefined } = {}) => {
  const container = 'container' in overrides ? overrides.container : new FakeContainer();
  const reload = vi.fn();
  const visibility = new FakeDocument();
  const host = new BrowserAppShellHost({ container, scriptUrl: '/sw.js', reload, visibility });
  return { container, reload, visibility, host };
};

describe('BrowserAppShellHost', () => {
  describe('registering', () => {
    it('installs /sw.js for the whole site', async () => {
      const { container, host } = setup();

      await expect(host.register()).resolves.toBe('registered');

      expect(container?.registered).toEqual([{ url: '/sw.js', scope: '/' }]);
    });

    it('says it is unsupported when the browser has no service workers', async () => {
      const { host } = setup({ container: undefined });

      await expect(host.register()).resolves.toBe('unsupported');
    });

    it('says it is unsupported when the browser refuses to install it, and does not break the application', async () => {
      const container = new FakeContainer();
      container.registerFails = true;
      const { host } = setup({ container });

      await expect(host.register()).resolves.toBe('unsupported');
    });
  });

  describe('a newer version', () => {
    it('is announced when it finishes installing and the page is already controlled by an older one', async () => {
      const { container, host } = setup();
      container!.controller = {};
      const listener = vi.fn();
      host.onUpdateReady(listener);
      await host.register();

      const worker = container!.registration.foundNewVersion();
      expect(listener).not.toHaveBeenCalled();
      worker.becomes('installing');
      expect(listener).not.toHaveBeenCalled();
      worker.becomes('installed');

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('is not an update the first time the application is installed: there is no older version', async () => {
      const { container, host } = setup();
      const listener = vi.fn();
      host.onUpdateReady(listener);
      await host.register();

      container!.registration.foundNewVersion().becomes('installed');

      expect(listener).not.toHaveBeenCalled();
    });

    it('is announced right away to whoever listens when one was already waiting at start', async () => {
      const { container, host } = setup();
      container!.controller = {};
      container!.registration.waiting = new FakeWorker();
      await host.register();
      const listener = vi.fn();

      host.onUpdateReady(listener);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('is not announced when one waits but this page has no older version controlling it', async () => {
      const { container, host } = setup();
      container!.registration.waiting = new FakeWorker();
      await host.register();
      const listener = vi.fn();

      host.onUpdateReady(listener);

      expect(listener).not.toHaveBeenCalled();
    });

    it('stops announcing to a listener that unsubscribed', async () => {
      const { container, host } = setup();
      container!.controller = {};
      const listener = vi.fn();
      const unsubscribe = host.onUpdateReady(listener);
      await host.register();

      unsubscribe();
      container!.registration.foundNewVersion().becomes('installed');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('activating it', () => {
    it('asks the waiting version to take over, and reloads the page only once it has', async () => {
      const { container, reload, host } = setup();
      container!.controller = {};
      await host.register();
      const worker = container!.registration.foundNewVersion();
      worker.becomes('installed');
      container!.registration.waiting = worker;

      host.activateUpdate();

      expect(worker.messages).toEqual([{ type: 'SKIP_WAITING' }]);
      expect(reload).not.toHaveBeenCalled();
      container!.takesControl();
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does not reload the page when a version takes control without the person asking for it', async () => {
      const { container, reload, host } = setup();
      await host.register();

      // La primera instalacion toma el control de la pagina abierta: no es una actualizacion.
      container!.takesControl();

      expect(reload).not.toHaveBeenCalled();
    });

    it('does not reload twice if the browser announces the change twice', async () => {
      const { container, reload, host } = setup();
      container!.controller = {};
      await host.register();
      container!.registration.waiting = new FakeWorker();

      host.activateUpdate();
      container!.takesControl();
      container!.takesControl();

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('does nothing when nothing is waiting', async () => {
      const { container, reload, host } = setup();
      await host.register();

      host.activateUpdate();
      container!.takesControl();

      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('looking for a newer version', () => {
    it('asks the server', async () => {
      const { container, host } = setup();
      await host.register();

      await host.checkForUpdate();

      expect(container!.registration.updates).toBe(1);
    });

    it('does not fail without a connection: the answer is simply that there is nothing new', async () => {
      const { container, host } = setup();
      await host.register();
      container!.registration.updateFails = true;

      await expect(host.checkForUpdate()).resolves.toBeUndefined();
    });

    it('does nothing before the service is installed', async () => {
      const { host } = setup();

      await expect(host.checkForUpdate()).resolves.toBeUndefined();
    });

    it('looks again whenever the person comes back to the application, and only then', async () => {
      const { container, visibility, host } = setup();
      await host.register();

      visibility.become('hidden');
      expect(container!.registration.updates).toBe(0);
      visibility.become('visible');

      expect(container!.registration.updates).toBe(1);
    });
  });
});
