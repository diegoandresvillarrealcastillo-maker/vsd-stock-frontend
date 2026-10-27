import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tarjeta, tarjetaClara } from '../../sitio/pagina/clases';

// Las pocas reglas de `sitio/pagina/estilos.css` que no se ven en jsdom (no hay CSS en las pruebas de componentes) y cuyo
// olvido se nota solo en el navegador de alguien. Se leen como texto, igual que `construccion.spec.ts` lee los archivos de
// configuracion: no prueban como se ve, prueban que la regla sigue ahi.
const css = readFileSync(
  join(import.meta.dirname, '..', '..', 'sitio', 'pagina', 'estilos.css'),
  'utf8',
);

describe('the rules of the landing that only the browser can show', () => {
  it('shows the moon in the light theme and the sun in the dark one with CSS, so the server and the browser print the same', () => {
    expect(css).toMatch(/\.icono-sol\s*\{\s*display:\s*none;?\s*\}/);
    expect(css).toMatch(/:root\[data-theme='dark'\]\s+\.icono-sol\s*\{\s*display:\s*block;?\s*\}/);
    expect(css).toMatch(/:root\[data-theme='dark'\]\s+\.icono-luna\s*\{\s*display:\s*none;?\s*\}/);
  });

  it('slides to the anchors only for who did not ask for less motion', () => {
    expect(css).toMatch(/html\s*\{[^}]*scroll-behavior:\s*smooth/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*html\s*\{\s*scroll-behavior:\s*auto/,
    );
  });

  it('draws the focus ring everywhere, and in a colour that is seen on the dark bands and on the orange one', () => {
    expect(css).toMatch(/^:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus\)/m);
    expect(css).toMatch(/\.banda :focus-visible\s*\{\s*outline-color:\s*var\(--color-accent\)/);
    expect(css).toMatch(
      /\.banda-naranja :focus-visible\s*\{\s*outline-color:\s*var\(--color-on-accent\)/,
    );
  });

  it('moves the sale that travels through the diagram with transform and opacity only, the way ADR 0008 asks', () => {
    const keyframes = [
      ...css.matchAll(/@keyframes viaje-(?:horizontal|vertical)\s*\{([\s\S]*?)\n\}/g),
    ];

    expect(keyframes).toHaveLength(2);
    for (const [, cuerpo] of keyframes) {
      const propiedades = [...(cuerpo ?? '').matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(new Set(propiedades)).toEqual(new Set(['opacity', 'transform']));
    }
  });

  it('turns off every transition and every animation for who asked for less motion, not only the ones somebody remembered', () => {
    const bloque =
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}/.exec(
        css,
      )?.[1] ?? '';

    expect(bloque).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(bloque).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(bloque).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    expect(bloque).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it('does not draw the sale that travels for who asked for less motion, even if something put it on the page', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.viaje\s*\{\s*display:\s*none/,
    );
  });

  it('takes how far and how long the sale travels from the component, so the clock of the drawing is the only one', () => {
    expect(css).toMatch(/\.viaje\s*\{[^}]*animation-duration:\s*var\(--duracion\)/);
    expect(css).toMatch(/translateX\(var\(--recorrido\)\)/);
    expect(css).toMatch(/translateY\(var\(--recorrido\)\)/);
  });

  it('gives the phone of the diagram and the frames of the screenshots a colour that is seen in both themes: the navy of the band is lost against the dark page', () => {
    expect(css).toMatch(/--color-bisel:\s*var\(--color-band\)/);
    expect(css).toMatch(
      /:root\[data-theme='dark'\]\s*\{[^}]*--color-bisel:\s*var\(--color-border\)/,
    );
  });

  it('draws the frame of a screenshot with CSS, in the colour that is seen in both themes, and leaves its width to whoever uses it', () => {
    expect(css).toMatch(/\[data-marco\]\s*\{[^}]*background:\s*var\(--color-bisel\)/);
    expect(css).toMatch(/\[data-marco='telefono'\]\s*\{/);
    expect(css).toMatch(/\[data-marco='computador'\]\s*\{/);
    // La imagen llena el marco y su alto sale de sus medidas: asi no se estira ni se corta, y la pagina no salta al cargar.
    expect(css).toMatch(/\[data-marco\] img\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto/);
    expect(css).not.toMatch(/\[data-marco[^{]*\{[^}]*\bwidth:\s*[\d.]+(?:rem|em|px)/);
  });

  it('keeps nothing of the old hero: no grid of lines, no glow and no highlighter on a word of the title', () => {
    for (const clase of ['cuadricula', 'resplandor', 'marca']) {
      expect(css, clase).not.toMatch(new RegExp(`\\.${clase}\\s*\\{`));
    }
  });
});

describe('the cards that C4-L6 puts inside the dark band of the demo', () => {
  it('paint their own text along with their own background: otherwise they inherit the white of the band and cannot be read in the light theme', () => {
    for (const clases of [tarjeta, tarjetaClara]) {
      expect(clases).toMatch(/\bbg-surface/);
      expect(clases).toMatch(/\btext-fg\b/);
    }
  });
});
