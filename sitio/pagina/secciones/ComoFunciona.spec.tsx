import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComoFunciona } from './ComoFunciona';

// axe y Lighthouse marcaron los numeros grandes de cada paso desde C4-L3: el gris casi blanco de las lineas finas (`rule`) sobre la
// tarjeta daba 1,2:1 en el tema claro y 1,4:1 en el oscuro, y el texto grande pide 3:1. Aunque sean decoracion (`aria-hidden`), los
// dos los miden. Que el color elegido llegue a 3:1 sobre la tarjeta en los dos temas lo vigila `test/design/tokens.spec.ts`
// (`border` sobre `surface`); aqui se vigila que los numeros usen ese color y que la tarjeta siga siendo la de esa prueba.
describe('the three steps of «Cómo funciona»', () => {
  const numeros = (contenedor: HTMLElement): Element[] => [
    ...contenedor.querySelectorAll('li > span[aria-hidden="true"]'),
  ];

  it('has the numbers 01, 02 and 03 as decoration, one on each card', () => {
    const { container } = render(<ComoFunciona />);

    expect(numeros(container).map((numero) => numero.textContent)).toEqual(['01', '02', '03']);
  });

  it('paints the big numbers with the colour of the borders: the colour of the thin lines cannot be read', () => {
    const { container } = render(<ComoFunciona />);

    for (const numero of numeros(container)) {
      expect(numero.classList.contains('text-border')).toBe(true);
      expect(numero.classList.contains('text-rule')).toBe(false);
    }
  });

  it('puts them on the plain surface, the one the contrast between border and surface is checked against', () => {
    const { container } = render(<ComoFunciona />);

    for (const numero of numeros(container)) {
      expect(numero.parentElement?.classList.contains('bg-surface')).toBe(true);
    }
  });
});
