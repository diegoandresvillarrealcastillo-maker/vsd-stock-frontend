import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStoragePersonPointer, PERSON_POINTER_KEY } from './local-storage-person-pointer';

const ANA = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const browserStorage = () => window.localStorage;

describe('LocalStoragePersonPointer', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('is nobody until someone is remembered', () => {
    expect(new LocalStoragePersonPointer(browserStorage).get()).toBeNull();
  });

  it('remembers the person and gives them back', () => {
    const pointer = new LocalStoragePersonPointer(browserStorage);

    pointer.set(ANA);

    expect(pointer.get()).toBe(ANA);
    expect(window.localStorage.getItem(PERSON_POINTER_KEY)).toBe(ANA);
  });

  it('keeps the person under the key that the application has always used, or an update would forget everybody', () => {
    new LocalStoragePersonPointer(browserStorage).set(ANA);
    expect(window.localStorage.getItem('vsd-stock-person')).toBe(ANA);

    window.localStorage.setItem('vsd-stock-person', ANA.replace('9b2f', '1a2b'));
    expect(new LocalStoragePersonPointer(browserStorage).get()).toBe(ANA.replace('9b2f', '1a2b'));
  });

  it('forgets the person', () => {
    const pointer = new LocalStoragePersonPointer(browserStorage);
    pointer.set(ANA);

    pointer.clear();

    expect(pointer.get()).toBeNull();
    expect(window.localStorage.getItem(PERSON_POINTER_KEY)).toBeNull();
  });

  it.each([
    '',
    'a',
    '../otra',
    'ana@ejemplo.co',
    'ana@ejemplo',
    'x'.repeat(65),
    'con espacios y mas cosas',
  ])('does not believe a value that is not an identifier: %j', (value) => {
    window.localStorage.setItem(PERSON_POINTER_KEY, value);

    expect(new LocalStoragePersonPointer(browserStorage).get()).toBeNull();
  });

  describe('when the browser blocks storage (private window, blocked site data)', () => {
    const blocked = () => ({
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    it('is nobody, without failing', () => {
      expect(new LocalStoragePersonPointer(blocked).get()).toBeNull();
    });

    it('lets the person be remembered or forgotten without failing', () => {
      const pointer = new LocalStoragePersonPointer(blocked);

      expect(() => {
        pointer.set(ANA);
        pointer.clear();
      }).not.toThrow();
    });

    it('does not even fail if reaching the storage is what throws', () => {
      const pointer = new LocalStoragePersonPointer(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(pointer.get()).toBeNull();
      expect(() => {
        pointer.set(ANA);
        pointer.clear();
      }).not.toThrow();
    });
  });
});
