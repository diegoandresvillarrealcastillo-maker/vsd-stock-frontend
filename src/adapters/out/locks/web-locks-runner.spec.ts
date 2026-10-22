import { describe, expect, it } from 'vitest';
import { WebLocksRunner, type LockManagerLike } from './web-locks-runner';

/** Un administrador de candados como el del navegador: concede el candado a uno a la vez y, con `ifAvailable`, no espera. */
function fakeLocks(): LockManagerLike & { requested: { name: string; ifAvailable: boolean }[] } {
  const held = new Set<string>();
  const requested: { name: string; ifAvailable: boolean }[] = [];
  return {
    requested,
    async request(name, options, callback) {
      requested.push({ name, ifAvailable: options.ifAvailable });
      if (held.has(name)) return await callback(null);
      held.add(name);
      try {
        return await callback({ name });
      } finally {
        held.delete(name);
      }
    },
  };
}

describe('WebLocksRunner', () => {
  it('does the work when nobody else is doing it, and gives what it returned', async () => {
    const runner = new WebLocksRunner(fakeLocks());

    const result = await runner.runIfFree('sync', () => Promise.resolve(42));

    expect(result).toEqual({ ran: true, value: 42 });
  });

  it('asks for the lock by its name and never waits for it', async () => {
    const locks = fakeLocks();

    await new WebLocksRunner(locks).runIfFree('vsd-stock-sync', () => Promise.resolve(1));

    expect(locks.requested).toEqual([{ name: 'vsd-stock-sync', ifAvailable: true }]);
  });

  it('does not do the work, and says so, when another tab already holds the lock', async () => {
    const runner = new WebLocksRunner(fakeLocks());
    let release = () => {};
    const slow = runner.runIfFree(
      'sync',
      () => new Promise<void>((resolve) => (release = resolve)),
    );

    const second = await runner.runIfFree('sync', () => Promise.resolve('no debe correr'));

    expect(second).toEqual({ ran: false });
    release();
    expect(await slow).toEqual({ ran: true, value: undefined });
  });

  it('lets go of the lock when the work ends, also when it fails', async () => {
    const runner = new WebLocksRunner(fakeLocks());

    await expect(
      runner.runIfFree('sync', () => Promise.reject(new Error('se cayó'))),
    ).rejects.toThrow('se cayó');

    expect(await runner.runIfFree('sync', () => Promise.resolve('otra vez'))).toEqual({
      ran: true,
      value: 'otra vez',
    });
  });

  it('keeps the locks of different names apart', async () => {
    const runner = new WebLocksRunner(fakeLocks());
    let release = () => {};
    const slow = runner.runIfFree('uno', () => new Promise<void>((resolve) => (release = resolve)));

    const other = await runner.runIfFree('otro', () => Promise.resolve('si'));

    expect(other).toEqual({ ran: true, value: 'si' });
    release();
    await slow;
  });

  describe('in a browser without Web Locks', () => {
    it('still keeps one at a time within the page', async () => {
      const runner = new WebLocksRunner(undefined);
      let release = () => {};
      const slow = runner.runIfFree(
        'sync',
        () => new Promise<void>((resolve) => (release = resolve)),
      );

      const second = await runner.runIfFree('sync', () => Promise.resolve('no'));

      expect(second).toEqual({ ran: false });
      release();
      await slow;
      expect(await runner.runIfFree('sync', () => Promise.resolve('si'))).toEqual({
        ran: true,
        value: 'si',
      });
    });

    it('keeps the locks of different names apart too', async () => {
      const runner = new WebLocksRunner(undefined);
      let release = () => {};
      const slow = runner.runIfFree(
        'uno',
        () => new Promise<void>((resolve) => (release = resolve)),
      );

      const other = await runner.runIfFree('otro', () => Promise.resolve('si'));

      expect(other).toEqual({ ran: true, value: 'si' });
      release();
      await slow;
    });

    it('lets go when the work fails', async () => {
      const runner = new WebLocksRunner(undefined);

      await expect(runner.runIfFree('sync', () => Promise.reject(new Error('x')))).rejects.toThrow(
        'x',
      );

      expect(await runner.runIfFree('sync', () => Promise.resolve(1))).toEqual({
        ran: true,
        value: 1,
      });
    });
  });
});
