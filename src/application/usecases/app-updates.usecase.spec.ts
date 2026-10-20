import { describe, expect, it, vi } from 'vitest';
import { FakeAppShellHost } from '../../../test/support/fake-app-shell-host';
import { AppUpdatesUseCase } from './app-updates.usecase';

const started = async (host = new FakeAppShellHost()) => {
  const updates = new AppUpdatesUseCase(host);
  updates.start();
  // `start` registra el servicio y la respuesta llega en el siguiente turno.
  await Promise.resolve();
  await Promise.resolve();
  return { host, updates };
};

describe('AppUpdatesUseCase', () => {
  it('starts with nothing to update and nothing holding it back', () => {
    const updates = new AppUpdatesUseCase(new FakeAppShellHost());

    expect(updates.current()).toEqual({ status: 'idle', held: false });
  });

  describe('starting', () => {
    it('installs the service once and looks for a newer version', async () => {
      const { host, updates } = await started();
      updates.start();
      await Promise.resolve();

      expect(host.registered).toBe(1);
      expect(host.checks).toBe(1);
      expect(updates.current().status).toBe('idle');
    });

    it('says there is nothing to update when the browser has no service workers, and does not look', async () => {
      const host = new FakeAppShellHost();
      host.registerResult = 'unsupported';

      const { updates } = await started(host);

      expect(updates.current()).toEqual({ status: 'unsupported', held: false });
      expect(host.checks).toBe(0);
    });
  });

  describe('a newer version', () => {
    it('is announced as ready and waits: it is never applied by itself', async () => {
      const { host, updates } = await started();
      const listener = vi.fn();
      updates.subscribe(listener);

      host.emitUpdateReady();

      expect(updates.current().status).toBe('ready');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(host.activations).toBe(0);
    });

    it('does not announce the same version twice', async () => {
      const { host, updates } = await started();
      const listener = vi.fn();
      updates.subscribe(listener);

      host.emitUpdateReady();
      host.emitUpdateReady();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('is applied only when the person asks for it', async () => {
      const { host, updates } = await started();
      host.emitUpdateReady();

      const applied = updates.apply();

      expect(applied).toBe(true);
      expect(host.activations).toBe(1);
      expect(updates.current().status).toBe('applying');
    });

    it('does not apply twice', async () => {
      const { host, updates } = await started();
      host.emitUpdateReady();
      updates.apply();

      expect(updates.apply()).toBe(false);
      expect(host.activations).toBe(1);
    });

    it('does not go back to ready when the browser announces the same version while it is being applied', async () => {
      const { host, updates } = await started();
      host.emitUpdateReady();
      updates.apply();

      host.emitUpdateReady();

      expect(updates.current().status).toBe('applying');
    });

    it('is not applied when there is none ready', async () => {
      const { host, updates } = await started();

      expect(updates.apply()).toBe(false);
      expect(host.activations).toBe(0);
    });
  });

  describe('holding it back, for a sale in progress', () => {
    it('refuses to apply while a screen asks to wait, and applies once it lets go', async () => {
      const { host, updates } = await started();
      host.emitUpdateReady();
      const release = updates.hold();

      expect(updates.current()).toEqual({ status: 'ready', held: true });
      expect(updates.apply()).toBe(false);
      expect(host.activations).toBe(0);

      release();

      expect(updates.current().held).toBe(false);
      expect(host.activations).toBe(0);
      expect(updates.apply()).toBe(true);
    });

    it('waits for every screen that asked, and letting go twice does not let go of another one', async () => {
      const { host, updates } = await started();
      host.emitUpdateReady();
      const first = updates.hold();
      const second = updates.hold();

      first();
      first();

      expect(updates.current().held).toBe(true);
      expect(updates.apply()).toBe(false);
      second();
      expect(updates.current().held).toBe(false);
    });

    it('tells the listeners once when a second screen also asks to wait, not again', async () => {
      const { updates } = await started();
      const listener = vi.fn();
      const first = updates.hold();
      updates.subscribe(listener);

      const second = updates.hold();
      second();
      first();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ status: 'idle', held: false });
    });

    it('tells the listeners when the hold starts and ends', async () => {
      const { updates } = await started();
      const seen: boolean[] = [];
      updates.subscribe((state) => seen.push(state.held));

      const release = updates.hold();
      release();

      expect(seen).toEqual([true, false]);
    });
  });

  describe('stopping', () => {
    it('stops listening to the service and ignores what comes after', async () => {
      const { host, updates } = await started();
      const listener = vi.fn();
      updates.subscribe(listener);

      updates.stop();
      host.emitUpdateReady();

      expect(host.listening).toBe(0);
      expect(listener).not.toHaveBeenCalled();
      expect(updates.current().status).toBe('idle');
    });

    it('does not listen to a service that answers after it was stopped', async () => {
      const host = new FakeAppShellHost();
      const updates = new AppUpdatesUseCase(host);

      updates.start();
      updates.stop();
      await Promise.resolve();
      await Promise.resolve();
      host.emitUpdateReady();

      expect(host.listening).toBe(0);
      expect(updates.current().status).toBe('idle');
    });

    it('can start again after stopping', async () => {
      const { host, updates } = await started();
      updates.stop();

      updates.start();
      await Promise.resolve();
      await Promise.resolve();
      host.emitUpdateReady();

      expect(updates.current().status).toBe('ready');
    });
  });
});
