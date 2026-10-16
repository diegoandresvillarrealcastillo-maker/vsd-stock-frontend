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
const darkOverrides = declarations(
  block(block(css, '@media (prefers-color-scheme: dark)'), ':root'),
);

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

  it('defines at least one color to flip, so the dark mode is not an empty block', () => {
    expect(colorNames.length).toBeGreaterThan(0);
  });

  it('gives every color a dark value, so no color is left light in the dark mode', () => {
    const missing = colorNames.filter((name) => !darkOverrides.has(name));

    expect(missing).toEqual([]);
  });

  it('only overrides in the dark mode colors that exist in @theme', () => {
    const unknown = [...darkOverrides.keys()].filter((name) => !theme.has(name));

    expect(unknown).toEqual([]);
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

describe.each(['light', 'dark'] as const)('contrast in %s mode', (mode) => {
  const colors = palette(mode);
  const color = (name: string): string => {
    const value = colors.get(`--color-${name}`);
    if (value === undefined) throw new Error(`Falta --color-${name} en el modo ${mode}`);
    return value;
  };

  it.each([
    ['fg', 'surface'],
    ['fg', 'surface-raised'],
    ['fg-muted', 'surface'],
    ['fg-muted', 'surface-raised'],
    ['accent', 'surface'],
    ['accent', 'surface-raised'],
    ['on-accent', 'accent'],
    ['on-accent', 'accent-hover'],
  ])('text %s on %s reaches 4.5:1 (AA for normal text)', (foreground, background) => {
    expect(contrastRatio(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['border', 'surface'],
    ['border', 'surface-raised'],
    ['focus', 'surface'],
    ['focus', 'surface-raised'],
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
