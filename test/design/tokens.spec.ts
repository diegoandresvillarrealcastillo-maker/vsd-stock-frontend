// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { durations, eases } from '../../src/presentation/motion/tokens';
import { contrastRatio } from '../support/contrast';

// Los tokens de diseno viven una sola vez, en el CSS (ADR 0008). Estas pruebas
// leen ese archivo y comprueban lo que no se ve a simple vista: que existan
// todas las familias, que el modo oscuro este completo y que los colores
// cumplan el contraste AA (WCAG 2.2) en los dos modos.
const css = readFileSync(
  resolve(import.meta.dirname, '../../src/presentation/styles/index.css'),
  'utf8',
);

/** Devuelve el contenido entre llaves del primer bloque que empieza con `header`. */
function block(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start === -1) throw new Error(`No se encontro el bloque "${header}" en index.css`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`El bloque "${header}" no se cierra`);
}

/** Lee las declaraciones `--nombre: valor;` de un bloque, sin comentarios. */
function declarations(source: string): Map<string, string> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const found = new Map<string, string>();
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1]!, match[2]!.trim());
  }
  return found;
}

const theme = declarations(block(css, '@theme static'));
// El tema oscuro se activa con data-theme="dark" en la raiz: lo pone el script de
// index.html antes de pintar y el boton de tema despues (ADR 0008).
const darkOverrides = declarations(block(css, ":root[data-theme='dark']"));

function palette(mode: 'light' | 'dark'): Map<string, string> {
  return mode === 'light' ? theme : new Map([...theme, ...darkOverrides]);
}

const colorNames = [...theme.keys()].filter((name) => name.startsWith('--color-'));

describe('design tokens', () => {
  it.each([
    ['color', '--color-'],
    ['typography family', '--font-'],
    ['typography size', '--text-'],
    ['spacing', '--spacing'],
    ['radius', '--radius-'],
    ['shadow', '--shadow-'],
    ['duration', '--duration-'],
    ['easing curve', '--ease-'],
  ])('defines %s tokens in @theme', (_family, prefix) => {
    const names = [...theme.keys()].filter((name) => name.startsWith(prefix));

    expect(names.length).toBeGreaterThan(0);
  });

  it('defines at least one color to flip, so the dark theme is not an empty block', () => {
    expect(colorNames.length).toBeGreaterThan(0);
  });

  it('gives every color a dark value, so no color is left light in the dark theme', () => {
    const missing = colorNames.filter((name) => !darkOverrides.has(name));

    expect(missing).toEqual([]);
  });

  it('only overrides in the dark theme colors that exist in @theme', () => {
    const unknown = [...darkOverrides.keys()].filter((name) => !theme.has(name));

    expect(unknown).toEqual([]);
  });

  it('tells the browser the color scheme of each theme, so scrollbars and form controls follow it', () => {
    expect(css).toMatch(/html\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toMatch(/html\[data-theme='dark'\]\s*\{[^}]*color-scheme:\s*dark/);
  });

  it('uses a system font stack, so the first paint does not wait for a font download', () => {
    expect(theme.get('--font-sans')).toMatch(/system-ui/);
    expect(theme.get('--font-sans')).not.toMatch(/url\(/);
  });

  it('makes the touch target token at least 44 px (WCAG 2.2, 2.5.8 and the ADR 0008 budget)', () => {
    const value = theme.get('--spacing-touch');

    expect(value).toMatch(/^\d+(\.\d+)?rem$/);
    expect(parseFloat(value ?? '0') * 16).toBeGreaterThanOrEqual(44);
  });
});

// Identidad de marca (pedido del Product Owner, 2026-10-16): azul oscuro y blanco como
// base, y el naranja del logo de VSD Stock como acento.
describe('brand palette', () => {
  const channels = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const light = palette('light');
  const dark = palette('dark');
  const get = (colors: Map<string, string>, name: string): string =>
    colors.get(`--color-${name}`) ?? '';

  it('is white in the light theme', () => {
    expect(get(light, 'surface').toLowerCase()).toBe('#ffffff');
  });

  it('is dark blue in the dark theme: blue leads and it is dark, not black or gray', () => {
    const { r, g, b } = channels(get(dark, 'surface'));

    expect(b).toBeGreaterThan(r + 15);
    expect(b).toBeGreaterThan(g);
    expect(contrastRatio(get(dark, 'surface'), '#000000')).toBeLessThan(1.5);
  });

  it('makes the text dark blue in the light theme', () => {
    const { r, b } = channels(get(light, 'fg'));

    expect(b).toBeGreaterThan(r);
    expect(contrastRatio(get(light, 'fg'), '#000000')).toBeLessThan(2);
  });

  it('makes the text white in the dark theme', () => {
    expect(contrastRatio(get(dark, 'fg'), '#ffffff')).toBeLessThan(1.2);
  });

  it('makes the main button dark blue in the light theme and white in the dark theme', () => {
    const { r, b } = channels(get(light, 'primary'));

    expect(b).toBeGreaterThan(r + 40);
    expect(contrastRatio(get(light, 'primary'), '#000000')).toBeLessThan(3);
    expect(get(dark, 'primary').toLowerCase()).toBe('#ffffff');
  });

  it.each(['light', 'dark'] as const)(
    'uses the orange of the VSD Stock logo as the accent (%s)',
    (mode) => {
      expect(get(mode === 'light' ? light : dark, 'accent').toLowerCase()).toBe('#f97801');
    },
  );
});

describe.each(['light', 'dark'] as const)('contrast in the %s theme', (mode) => {
  const colors = palette(mode);
  const color = (name: string): string => {
    const value = colors.get(`--color-${name}`);
    if (value === undefined) throw new Error(`Falta --color-${name} en el tema ${mode}`);
    return value;
  };

  it.each([
    ['fg', 'surface'],
    ['fg', 'surface-raised'],
    ['fg-muted', 'surface'],
    ['fg-muted', 'surface-raised'],
    ['on-primary', 'primary'],
    ['on-primary', 'primary-hover'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-hover'],
    ['accent-text', 'surface'],
    ['accent-text', 'surface-raised'],
    ['on-band', 'band'],
  ])('text %s on %s reaches 4.5:1 (AA for normal text)', (foreground, background) => {
    expect(contrastRatio(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['border', 'surface'],
    ['border', 'surface-raised'],
    ['focus', 'surface'],
    ['focus', 'surface-raised'],
    ['focus', 'band'],
  ])('interface part %s on %s reaches 3:1 (AA for components)', (foreground, background) => {
    expect(contrastRatio(color(foreground), color(background))).toBeGreaterThanOrEqual(3);
  });
});

describe('motion tokens', () => {
  const toSeconds = (value: string): number =>
    parseFloat(value) / (value.endsWith('ms') ? 1000 : 1);
  const toCurve = (value: string): number[] =>
    (/cubic-bezier\(([^)]+)\)/.exec(value)?.[1] ?? '').split(',').map((part) => parseFloat(part));

  it.each(Object.entries(durations))(
    'keeps the %s duration in motion/tokens.ts equal to --duration-%s in the CSS',
    (name, seconds) => {
      const value = theme.get(`--duration-${name}`);

      expect(value).toBeDefined();
      expect(toSeconds(value ?? '')).toBeCloseTo(seconds, 5);
    },
  );

  it.each(Object.entries(eases))(
    'keeps the %s curve in motion/tokens.ts equal to --ease-%s in the CSS',
    (name, curve) => {
      const value = theme.get(`--ease-${name}`);

      expect(value).toBeDefined();
      expect(toCurve(value ?? '')).toEqual([...curve]);
    },
  );
});
