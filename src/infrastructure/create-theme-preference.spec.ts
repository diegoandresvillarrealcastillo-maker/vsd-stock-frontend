import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../adapters/out/theme/theme-storage-key';
import { createThemePreference } from './create-theme-preference';

// El cableado de verdad: caso de uso + adaptadores reales sobre el DOM de jsdom.
// Es lo que main.tsx arma al arrancar, y por eso se prueba aqui y no en la interfaz.
describe('createThemePreference', () => {
  let root: HTMLElement;

  beforeEach(() => {
    window.localStorage.clear();
    root = document.createElement('html');
  });

  function create({ systemDark = false, blocked = false } = {}) {
    return createThemePreference({
      getStorage: blocked
        ? () => {
            throw new DOMException('blocked', 'SecurityError');
          }
        : () => window.localStorage,
      matchMedia: () => ({ matches: systemDark }),
      root,
    });
  }

  it('marks the page with the system theme when the person never chose', () => {
    create({ systemDark: true });

    expect(root.dataset['theme']).toBe('dark');
  });

  it('marks the page with the theme the person chose last time, over the system one', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    create({ systemDark: true });

    expect(root.dataset['theme']).toBe('light');
  });

  it('remembers the choice in the browser and marks the page again when it toggles', () => {
    const preference = create({ systemDark: false });

    preference.toggle();

    expect(root.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('still works when the browser blocks storage: the theme changes for this visit', () => {
    const preference = create({ systemDark: true, blocked: true });

    expect(root.dataset['theme']).toBe('dark');
    expect(() => preference.toggle()).not.toThrow();
    expect(root.dataset['theme']).toBe('light');
  });
});
