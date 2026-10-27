import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contenido } from '../contenido';
import { ComoEmpezar } from './ComoEmpezar';

// Los tres pasos para empezar son una secuencia de verdad (se pide el acceso, se habla con un asesor, se empieza a vender), asi que
// la lista es numerada y el numero se ve. El numero es una ficha de color solido con texto que cumple el contraste en los dos temas
// (`primary` y `on-primary`, que `test/design/tokens.spec.ts` ya vigila), y no el numero gigante y gris de antes, que axe y Lighthouse
// median aunque fuera decoracion.
describe('the three steps of «Cómo empezar»', () => {
  const fichas = (contenedor: HTMLElement): Element[] => [
    ...contenedor.querySelectorAll('ol > li > span[aria-hidden="true"]'),
  ];

  it('is an ordered list with one item per step, in the order of the content', () => {
    const { container } = render(<ComoEmpezar />);

    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect([...container.querySelectorAll('ol > li > h3')].map((h) => h.textContent)).toEqual(
      contenido.comoEmpezar.pasos.map((p) => p.titulo),
    );
  });

  it('numbers the steps 1, 2 and 3 with a chip that the eye sees and the reader of screens skips', () => {
    const { container } = render(<ComoEmpezar />);

    expect(fichas(container).map((ficha) => ficha.textContent)).toEqual(['1', '2', '3']);
  });

  it('paints the chips with the solid colours whose contrast the tokens test checks, not with the colour of the thin lines', () => {
    const { container } = render(<ComoEmpezar />);

    for (const ficha of fichas(container)) {
      expect(ficha.classList.contains('bg-primary')).toBe(true);
      expect(ficha.classList.contains('text-on-primary')).toBe(true);
      expect(ficha.classList.contains('text-rule')).toBe(false);
    }
  });

  it('puts the steps on the plain surface, the one the contrast of the text is checked against', () => {
    const { container } = render(<ComoEmpezar />);

    for (const ficha of fichas(container)) {
      expect(ficha.parentElement?.classList.contains('bg-surface')).toBe(true);
    }
  });
});
