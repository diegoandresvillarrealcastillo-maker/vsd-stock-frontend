import { afterEach, describe, expect, it } from 'vitest';
import { CLAVE_DEL_TEMA } from './claveDelTema';
import { almacenDelNavegador, alternarTema, temaActual } from './tema';

// El boton de tema de la landing hace lo mismo que el de la aplicacion y guarda con la misma clave, para que quien eligio un tema
// en una lo vea en la otra. No usa los casos de uso de la aplicacion (la landing solo puede importar su dominio): usa las reglas
// de `domain/model/theme.ts`.
function raiz(tema?: string): HTMLElement {
  const el = document.createElement('html');
  if (tema !== undefined) el.dataset['theme'] = tema;
  return el;
}

describe('the current theme', () => {
  it('is the one painted on the page', () => {
    expect(temaActual(raiz('dark'))).toBe('dark');
    expect(temaActual(raiz('light'))).toBe('light');
  });

  it('is the light one when the page has none or something that is not a theme', () => {
    expect(temaActual(raiz())).toBe('light');
    expect(temaActual(raiz('purple'))).toBe('light');
  });
});

describe('switching the theme', () => {
  it('paints the other one and saves it', () => {
    const guardado: [string, string][] = [];
    const el = raiz('light');

    const nuevo = alternarTema(el, { setItem: (k, v) => guardado.push([k, v]) });

    expect(nuevo).toBe('dark');
    expect(el.dataset['theme']).toBe('dark');
    expect(guardado).toEqual([[CLAVE_DEL_TEMA, 'dark']]);
  });

  it('goes back to the light one from the dark one', () => {
    const el = raiz('dark');

    expect(alternarTema(el, { setItem: () => undefined })).toBe('light');
    expect(el.dataset['theme']).toBe('light');
  });

  it('switches anyway when the browser blocks the storage: the choice just is not remembered', () => {
    const el = raiz('light');

    const nuevo = alternarTema(el, {
      setItem: () => {
        throw new Error('blocked');
      },
    });

    expect(nuevo).toBe('dark');
    expect(el.dataset['theme']).toBe('dark');
  });

  it('switches anyway when there is no storage at all', () => {
    const el = raiz('light');

    expect(alternarTema(el, null)).toBe('dark');
  });
});

describe('the storage of the browser', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');

  afterEach(() => {
    if (original !== undefined) Object.defineProperty(window, 'localStorage', original);
  });

  it('is the real one when the browser lets it be used', () => {
    expect(almacenDelNavegador()).toBe(window.localStorage);
  });

  it('is nothing when the browser throws on touching it, as some do with the site data blocked', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    expect(almacenDelNavegador()).toBeNull();
  });
});
