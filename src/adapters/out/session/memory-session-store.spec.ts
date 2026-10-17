// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session } from '../../../domain/model/session';
import { MemorySessionStore } from './memory-session-store';

const session = (token: string): Session => ({
  accessToken: token,
  refreshToken: `r-${token}`,
  expiresAt: new Date('2026-10-17T13:00:00.000Z'),
  user: { id: '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a', email: 'ana@example.com' },
});

describe('MemorySessionStore', () => {
  it('starts without a session', () => {
    expect(new MemorySessionStore().get()).toBeNull();
  });

  it('holds the session it was given, the very same object', () => {
    const store = new MemorySessionStore();
    const given = session('uno');

    store.set(given);

    expect(store.get()).toBe(given);
  });

  it('replaces it, and forgets it on clear', () => {
    const store = new MemorySessionStore();
    store.set(session('uno'));
    store.set(session('dos'));
    expect(store.get()?.accessToken).toBe('dos');

    store.clear();
    expect(store.get()).toBeNull();
  });

  it('tells every listener about each change, and stops telling the one that left', () => {
    const store = new MemorySessionStore();
    const heard: string[] = [];
    const stopA = store.subscribe(() => heard.push('A'));
    store.subscribe(() => heard.push('B'));

    store.set(session('uno'));
    stopA();
    store.clear();

    expect(heard).toEqual(['A', 'B', 'B']);
  });

  it('does not tell anyone when there was nothing to clear', () => {
    const store = new MemorySessionStore();
    let heard = 0;
    store.subscribe(() => (heard += 1));

    store.clear();

    expect(heard).toBe(0);
  });

  it('writes nothing to the device: no storage, no cookies (ADR 0018)', () => {
    const touched: string[] = [];
    const trap = new Proxy(
      {},
      {
        get: (_target, name) => {
          touched.push(String(name));
          return undefined;
        },
      },
    );
    const store = new MemorySessionStore();
    const original = {
      localStorage: globalThis.localStorage,
      sessionStorage: globalThis.sessionStorage,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: trap, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: trap, configurable: true });
    try {
      store.set(session('secreto'));
      store.clear();
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: original.localStorage,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'sessionStorage', {
        value: original.sessionStorage,
        configurable: true,
      });
    }

    expect(touched).toEqual([]);
  });

  it('keeps one store apart from another', () => {
    const one = new MemorySessionStore();
    const two = new MemorySessionStore();

    one.set(session('uno'));

    expect(two.get()).toBeNull();
  });
});
