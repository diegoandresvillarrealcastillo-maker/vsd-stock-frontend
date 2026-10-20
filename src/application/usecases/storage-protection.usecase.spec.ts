import { describe, expect, it, vi } from 'vitest';
import { FakePersistentStorage } from '../../../test/support/pwa';
import { StorageProtectionUseCase } from './storage-protection.usecase';

describe('StorageProtectionUseCase', () => {
  it('does not know until it asks', () => {
    expect(new StorageProtectionUseCase(new FakePersistentStorage()).current()).toBe('unknown');
  });

  it('says it is unsupported, and asks for nothing, when the browser has no persistent storage', async () => {
    const storage = new FakePersistentStorage();
    storage.supported = false;
    const protection = new StorageProtectionUseCase(storage);

    await protection.ensure();

    expect(protection.current()).toBe('unsupported');
    expect(storage.requests).toBe(0);
  });

  it('is protected, without asking again, when the browser already promised not to delete', async () => {
    const storage = new FakePersistentStorage();
    storage.persisted = true;
    const protection = new StorageProtectionUseCase(storage);

    await protection.ensure();

    expect(protection.current()).toBe('protected');
    expect(storage.requests).toBe(0);
  });

  it('asks the browser and is protected when it agrees', async () => {
    const storage = new FakePersistentStorage();
    const protection = new StorageProtectionUseCase(storage);

    await protection.ensure();

    expect(protection.current()).toBe('protected');
    expect(storage.requests).toBe(1);
  });

  it('is not protected when the browser refuses, and says so', async () => {
    const storage = new FakePersistentStorage();
    storage.grants = false;
    const protection = new StorageProtectionUseCase(storage);

    await protection.ensure();

    expect(protection.current()).toBe('not-protected');
  });

  it('is not protected when asking fails: a failure is not a promise', async () => {
    const storage = new FakePersistentStorage();
    storage.failure = new Error('denegado');
    const protection = new StorageProtectionUseCase(storage);

    await protection.ensure();

    expect(protection.current()).toBe('not-protected');
  });

  it('asks again later, because an installed application may be granted what a tab was denied', async () => {
    const storage = new FakePersistentStorage();
    storage.grants = false;
    const protection = new StorageProtectionUseCase(storage);
    await protection.ensure();

    storage.grants = true;
    await protection.ensure();

    expect(protection.current()).toBe('protected');
    expect(storage.requests).toBe(2);
  });

  it('tells the listeners only when the answer changes', async () => {
    const storage = new FakePersistentStorage();
    const protection = new StorageProtectionUseCase(storage);
    const listener = vi.fn();
    protection.subscribe(listener);

    await protection.ensure();
    await protection.ensure();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('protected');
  });

  it('stops telling a listener that unsubscribed', async () => {
    const protection = new StorageProtectionUseCase(new FakePersistentStorage());
    const listener = vi.fn();
    const unsubscribe = protection.subscribe(listener);

    unsubscribe();
    await protection.ensure();

    expect(listener).not.toHaveBeenCalled();
  });
});
