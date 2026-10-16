import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageThemeStorage } from './local-storage-theme-storage';
import { THEME_STORAGE_KEY } from './theme-storage-key';

describe('LocalStorageThemeStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads the theme that was saved', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    expect(new LocalStorageThemeStorage(window.localStorage).read()).toBe('dark');
  });

  it('returns null when nothing was saved', () => {
    expect(new LocalStorageThemeStorage(window.localStorage).read()).toBeNull();
  });

  it('returns null when the saved value is not a theme, instead of passing it on', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'purple');

    expect(new LocalStorageThemeStorage(window.localStorage).read()).toBeNull();
  });

  it('writes the theme under the key that the page uses before React starts', () => {
    new LocalStorageThemeStorage(window.localStorage).write('light');

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  describe('when the browser blocks storage (private window, blocked site data)', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };

    it('reads as if nothing was saved', () => {
      expect(new LocalStorageThemeStorage(blocked).read()).toBeNull();
    });

    it('does not fail when saving: the theme still changes for this visit', () => {
      expect(() => new LocalStorageThemeStorage(blocked).write('dark')).not.toThrow();
    });
  });
});
