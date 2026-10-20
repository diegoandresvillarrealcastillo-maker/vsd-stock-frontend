import { describe, expect, it, vi } from 'vitest';
import { BrowserPersistentStorage } from './browser-persistent-storage';

describe('BrowserPersistentStorage', () => {
  it('is unsupported when the browser has no storage manager', () => {
    expect(new BrowserPersistentStorage(undefined).isSupported()).toBe(false);
  });

  it('is unsupported when the storage manager can not make storage persistent', () => {
    expect(new BrowserPersistentStorage({}).isSupported()).toBe(false);
    expect(
      new BrowserPersistentStorage({ persisted: () => Promise.resolve(true) }).isSupported(),
    ).toBe(false);
    expect(
      new BrowserPersistentStorage({ persist: () => Promise.resolve(true) }).isSupported(),
    ).toBe(false);
  });

  it('is supported when it can ask and can answer', () => {
    const storage = new BrowserPersistentStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    });

    expect(storage.isSupported()).toBe(true);
  });

  it('answers what the browser answers', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const storage = new BrowserPersistentStorage({
      persisted: () => Promise.resolve(false),
      persist,
    });

    await expect(storage.isPersisted()).resolves.toBe(false);
    await expect(storage.request()).resolves.toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('says it is not protected, and asks for nothing, when it is unsupported', async () => {
    const storage = new BrowserPersistentStorage(undefined);

    await expect(storage.isPersisted()).resolves.toBe(false);
    await expect(storage.request()).resolves.toBe(false);
  });
});
