import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('keeps the highlighter of the title without the yellow of the browser', () => {
    expect(css).toMatch(/\.marca\s*\{[^}]*color:\s*inherit/);
  });
});
