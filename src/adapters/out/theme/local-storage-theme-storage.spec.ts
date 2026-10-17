import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageThemeStorage } from './local-storage-theme-storage';
import { THEME_STORAGE_KEY } from './theme-storage-key';

// El adaptador recibe una funcion que devuelve el almacenamiento, no el
// almacenamiento: en algunos navegadores con los datos del sitio bloqueados,
// ACCEDER a window.localStorage ya lanza un error.
const browserStorage = () => window.localStorage;

describe('LocalStorageThemeStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads the theme that was saved', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(new LocalStorageThemeStorage(browserStorage).read()).toBe('dark');
  });

  it('returns null when nothing was saved', () => {
    expect(new LocalStorageThemeStorage(browserStorage).read()).toBeNull();
  });

  it('returns null when the saved value is not a theme, instead of passing it on', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');

    expect(new LocalStorageThemeStorage(browserStorage).read()).toBeNull();
  });

  it('writes the theme under the key that the page uses before React starts', () => {
    new LocalStorageThemeStorage(browserStorage).write('light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  describe('when the browser blocks storage (private window, blocked site data)', () => {
    const blockedMethods = () => ({
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    const blockedAccess = () => {
      throw new DOMException('blocked', 'SecurityError');
    };

    it.each([
      ['its methods fail', blockedMethods],
      ['even reaching it fails', blockedAccess],
    ])('reads as if nothing was saved when %s', (_case, storage) => {
      expect(new LocalStorageThemeStorage(storage).read()).toBeNull();
    });

    it.each([
      ['its methods fail', blockedMethods],
      ['even reaching it fails', blockedAccess],
    ])(
      'does not fail when saving if %s: the theme still changes for this visit',
      (_case, storage) => {
        expect(() => new LocalStorageThemeStorage(storage).write('dark')).not.toThrow();
      },
    );
  });
});
