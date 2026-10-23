import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Las reglas de CSS de las mascotas que jsdom no ve (no hay estilos en las pruebas de componentes): se leen como texto, igual
// que `test/sitio/estilos.spec.ts`. No prueban como se ve; prueban que la regla sigue ahi.
const css = readFileSync(
  join(import.meta.dirname, '..', '..', 'src', 'presentation', 'styles', 'index.css'),
  'utf8',
);

/** El texto del bloque `{ ... }` que empieza en `desde` (cuenta las llaves, asi que sirve con bloques dentro de bloques). */
function bloque(texto: string, desde: number): string {
  const abre = texto.indexOf('{', desde);
  let hondo = 0;
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === '{') hondo += 1;
    if (texto[i] === '}') hondo -= 1;
    if (hondo === 0) return texto.slice(abre + 1, i);
  }
  throw new Error('llave sin cerrar');
}

const DONDE_SE_ANIMA = '@media (prefers-reduced-motion: no-preference)';
const inicioDelMovimiento = css.indexOf(DONDE_SE_ANIMA);
const conMovimiento = inicioDelMovimiento === -1 ? '' : bloque(css, inicioDelMovimiento);
// El CSS sin ese bloque: la llave que abre, lo de adentro y la llave que cierra.
const finDelMovimiento = css.indexOf('{', inicioDelMovimiento) + conMovimiento.length + 2;
const sinElMovimiento =
  inicioDelMovimiento === -1
    ? css
    : css.slice(0, inicioDelMovimiento) + css.slice(finDelMovimiento);

describe('the rules of the mascots that only the browser can show', () => {
  it('keeps the pixels sharp: the art is pixel art and the browser must not smooth it', () => {
    expect(css).toMatch(/\.mascota\s*\{[^}]*image-rendering:\s*pixelated/);
  });

  it('moves them only for who did not ask for less motion: no animation outside that media query', () => {
    expect(inicioDelMovimiento).toBeGreaterThan(-1);
    expect(conMovimiento).toMatch(/animation:\s*mascota-/);
    expect(sinElMovimiento).not.toMatch(/animation:\s*mascota-/);
  });

  it.each(['mascota-flotar', 'mascota-saltar'])(
    'animates only transform in %s (ADR 0008: nothing that forces a layout)',
    (nombre) => {
      const clave = css.indexOf(`@keyframes ${nombre}`);
      expect(clave).toBeGreaterThan(-1);

      const propiedades = [...bloque(css, clave).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);

      expect(propiedades.length).toBeGreaterThan(0);
      expect(new Set(propiedades)).toEqual(new Set(['transform']));
    },
  );

  it('stops by itself after 5 seconds or less, so nobody needs a button to pause it (WCAG 2.2.2)', () => {
    const animaciones = [
      ...conMovimiento.matchAll(/animation:\s*mascota-[\w-]+\s+([\d.]+)s\s+[\w-]+\s+(\d+)\s*;/g),
    ];

    expect(animaciones.length).toBeGreaterThan(0);
    for (const [linea, duracion, veces] of animaciones) {
      expect(Number(duracion) * Number(veces), linea).toBeLessThanOrEqual(5);
    }
    expect(conMovimiento).not.toMatch(/\binfinite\b/);
  });

  it('does not move the sleeping one: nothing in the motion rules names that state', () => {
    expect(conMovimiento).not.toMatch(/dormida/);
  });
});
