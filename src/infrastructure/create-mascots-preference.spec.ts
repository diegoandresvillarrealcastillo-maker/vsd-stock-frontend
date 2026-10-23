import { beforeEach, describe, expect, it } from 'vitest';
import { MASCOTS_STORAGE_KEY } from '../adapters/out/mascots/mascots-storage-key';
import { createMascotsPreference } from './create-mascots-preference';

// El cableado de verdad: caso de uso + adaptador real sobre el almacenamiento de jsdom. Es lo que main.tsx arma al arrancar.
describe('createMascotsPreference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function create({ blocked = false } = {}) {
    return createMascotsPreference({
      getStorage: blocked
        ? () => {
            throw new DOMException('blocked', 'SecurityError');
          }
        : () => window.localStorage,
    });
  }

  it('shows the mascots the first time', () => {
    expect(create().enabled()).toBe(true);
  });

  it('remembers in the browser that the person turned them off', () => {
    create().toggle();

    expect(window.localStorage.getItem(MASCOTS_STORAGE_KEY)).toBe('off');
  });

  it('starts with them off the next time the app opens', () => {
    create().toggle();

    expect(create().enabled()).toBe(false);
  });

  it('still works when the browser blocks storage: the choice holds for this visit', () => {
    const preference = create({ blocked: true });

    expect(preference.enabled()).toBe(true);
    expect(() => preference.toggle()).not.toThrow();
    expect(preference.enabled()).toBe(false);
  });
});
