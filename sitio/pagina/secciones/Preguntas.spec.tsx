import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contenido } from '../contenido';
import { Preguntas } from './Preguntas';

// Las preguntas frecuentes son `<details>`: abren y cierran sin JavaScript (se leen aunque el codigo no haya cargado), los
// lectores de pantalla ya saben usarlas, y el atributo `name` hace que solo una este abierta a la vez.
describe('the questions', () => {
  it('are one details element each, in the order of the content, with the question as its summary', () => {
    const { container } = render(<Preguntas />);
    const detalles = [...container.querySelectorAll('details')];

    expect(detalles).toHaveLength(contenido.preguntas.items.length);
    detalles.forEach((d, i) => {
      expect(d.querySelector('summary')?.textContent).toBe(contenido.preguntas.items[i]?.pregunta);
      expect(d.textContent).toContain(contenido.preguntas.items[i]?.respuesta);
    });
  });

  it('all share one name, so that opening one closes the one that was open', () => {
    const { container } = render(<Preguntas />);
    const nombres = new Set(
      [...container.querySelectorAll('details')].map((d) => d.getAttribute('name')),
    );

    expect(nombres.size).toBe(1);
    expect([...nombres][0]).toBeTruthy();
  });

  it('start closed, so the page is not a wall of text', () => {
    const { container } = render(<Preguntas />);

    expect(container.querySelectorAll('details[open]')).toHaveLength(0);
  });

  it('open with a click on the question', () => {
    const { container } = render(<Preguntas />);
    const primera = container.querySelector('details');

    fireEvent.click(screen.getByText(contenido.preguntas.items[0]?.pregunta ?? ''));

    expect(primera?.hasAttribute('open')).toBe(true);
  });

  it('have their own heading, and the questions are not headings (a list of 7 headings is noise to a reader of screens)', () => {
    const { container } = render(<Preguntas />);

    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });
});
