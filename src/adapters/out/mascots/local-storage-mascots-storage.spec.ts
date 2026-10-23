import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageMascotsStorage } from './local-storage-mascots-storage';
import { MASCOTS_STORAGE_KEY } from './mascots-storage-key';

// Como el del tema, el adaptador recibe una funcion que devuelve el almacenamiento: con los datos del sitio bloqueados,
// algunos navegadores lanzan un error al ACCEDER a window.localStorage.
const browserStorage = () => window.localStorage;

describe('LocalStorageMascotsStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads that the person turned the mascots off', () => {
    window.localStorage.setItem(MASCOTS_STORAGE_KEY, 'off');

    expect(new LocalStorageMascotsStorage(browserStorage).read()).toBe(false);
  });

  it('reads that the person chose to see them', () => {
    window.localStorage.setItem(MASCOTS_STORAGE_KEY, 'on');

    expect(new LocalStorageMascotsStorage(browserStorage).read()).toBe(true);
  });

  it('returns null when nothing was saved', () => {
    expect(new LocalStorageMascotsStorage(browserStorage).read()).toBeNull();
  });

  it('returns null when the saved value is not one of ours, instead of guessing', () => {
    window.localStorage.setItem(MASCOTS_STORAGE_KEY, 'false');

    expect(new LocalStorageMascotsStorage(browserStorage).read()).toBeNull();
  });

  it('writes off and on under its own key, apart from the theme', () => {
    const storage = new LocalStorageMascotsStorage(browserStorage);

    storage.write(false);
    expect(window.localStorage.getItem(MASCOTS_STORAGE_KEY)).toBe('off');

    storage.write(true);
    expect(window.localStorage.getItem(MASCOTS_STORAGE_KEY)).toBe('on');
    expect(MASCOTS_STORAGE_KEY).not.toBe('vsd-stock-theme');
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
      expect(new LocalStorageMascotsStorage(storage).read()).toBeNull();
    });

    it.each([
      ['its methods fail', blockedMethods],
      ['even reaching it fails', blockedAccess],
    ])(
      'does not fail when saving if %s: the choice still holds for this visit',
      (_case, storage) => {
        expect(() => new LocalStorageMascotsStorage(storage).write(false)).not.toThrow();
      },
    );
  });
});
