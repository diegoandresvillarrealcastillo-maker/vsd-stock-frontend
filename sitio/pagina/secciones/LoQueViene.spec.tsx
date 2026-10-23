import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contenido } from '../contenido';
import { LoQueViene } from './LoQueViene';

// Lighthouse marco la etiqueta «DECIDIDO»: el verde del exito sobre su propio tinte (`bg-success/10`, encima del gris azulado de la
// lista) daba 4,33:1 en el tema claro y el texto pequeno pide 4,5:1. Que el verde llegue a 4,5:1 sobre `surface` en los dos temas lo
// vigila `test/design/tokens.spec.ts`; aqui se vigila que la etiqueta lo ponga sobre `surface`, sin tinte.
const { loQueViene } = contenido;

describe('the labels of «Lo que viene»', () => {
  it('shows the state of every item, as text', () => {
    render(<LoQueViene />);

    for (const item of loQueViene.items) {
      expect(screen.getAllByText(item.estado).length).toBeGreaterThan(0);
    }
  });

  it('puts the green of the decided ones on the plain surface, not on a tint of itself', () => {
    render(<LoQueViene />);
    const decididos = loQueViene.items.filter((item) => item.estado === 'DECIDIDO');
    expect(decididos.length).toBeGreaterThan(0);

    for (const etiqueta of screen.getAllByText('DECIDIDO')) {
      expect(etiqueta.classList.contains('text-success')).toBe(true);
      expect(etiqueta.classList.contains('bg-surface')).toBe(true);
      expect(etiqueta.className).not.toMatch(/bg-success/);
    }
  });

  it('keeps the pending ones in the muted text on the same surface', () => {
    render(<LoQueViene />);

    for (const etiqueta of screen.getAllByText('PENDIENTE')) {
      expect(etiqueta.classList.contains('text-fg-muted')).toBe(true);
      expect(etiqueta.classList.contains('bg-surface')).toBe(true);
    }
  });
});
