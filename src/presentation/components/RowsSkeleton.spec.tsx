import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RowsSkeleton } from './RowsSkeleton';

// Cada fila son tres bloques: dos de texto y uno de etiqueta.
const BLOCKS_PER_ROW = 3;
const blocks = (container: HTMLElement) =>
  container.querySelectorAll('[aria-hidden="true"]').length;

describe('RowsSkeleton', () => {
  it('says what is loading, as a status that a screen reader announces, and not through the blocks', () => {
    const { container } = render(<RowsSkeleton label="Cargando personas…" />);

    expect(screen.getByRole('status').textContent).toContain('Cargando personas…');
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('draws four rows by default', () => {
    const { container } = render(<RowsSkeleton label="Cargando…" />);

    expect(blocks(container)).toBe(4 * BLOCKS_PER_ROW);
  });

  it('draws as many rows as it is told', () => {
    const { container } = render(<RowsSkeleton label="Cargando…" rows={2} />);

    expect(blocks(container)).toBe(2 * BLOCKS_PER_ROW);
  });
});
