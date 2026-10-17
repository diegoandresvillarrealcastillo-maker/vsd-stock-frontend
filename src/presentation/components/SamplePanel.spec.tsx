import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setPrefersReducedMotion } from '../../../test/support/match-media';
import { renderWithMotion } from '../../../test/support/render';
import { SamplePanel, type SampleItem } from './SamplePanel';

const items: SampleItem[] = [
  { id: 'a', name: 'Arroz 500 g', units: 24, price: 3200 },
  { id: 'b', name: 'Aceite 1 L', units: 6, price: 12500 },
  { id: 'c', name: 'Panela', units: 0, price: 2800 },
];

describe('SamplePanel', () => {
  describe('with the content loaded', () => {
    it('lists every item with its name and its units', () => {
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      const list = screen.getByRole('list');
      expect(list.querySelectorAll('li')).toHaveLength(3);
      expect(screen.getByText('Arroz 500 g')).toBeDefined();
      expect(screen.getByText(/24 unidades/)).toBeDefined();
    });

    it('writes prices as Colombian pesos, with the thousands separator of the country', () => {
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      expect(screen.getByText(/12\.500/)).toBeDefined();
    });

    it('says in words when an item is out of stock, not only with a color', () => {
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      expect(screen.getByText('Agotado')).toBeDefined();
    });

    it('is a named region, so a screen reader can jump to it', () => {
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      expect(screen.getByRole('region', { name: /resumen de ejemplo/i })).toBeDefined();
    });

    it('enters rising while it fades in when the person allows motion', () => {
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      const region = screen.getByRole('region', { name: /resumen de ejemplo/i });
      expect(region.style.opacity).toBe('0');
      expect(region.style.transform).toMatch(/translateY/);
    });

    it('enters with a plain fade, without moving, when the person asked for reduced motion', () => {
      setPrefersReducedMotion(true);
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      const region = screen.getByRole('region', { name: /resumen de ejemplo/i });
      expect(region.style.opacity).toBe('0');
      expect(region.style.transform).not.toMatch(/translate/);
    });
  });

  describe('rows entering', () => {
    const rowsOf = () => [...screen.getByRole('list').querySelectorAll('li')];

    it('start hidden and lowered, so each one can rise in after the previous one', () => {
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      for (const row of rowsOf()) {
        expect(row.style.opacity).toBe('0');
        expect(row.style.transform).toMatch(/translateY/);
      }
    });

    it('only fade, without moving, when the person asked for reduced motion', () => {
      setPrefersReducedMotion(true);
      renderWithMotion(<SamplePanel items={items} loading={false} />);

      for (const row of rowsOf()) {
        expect(row.style.opacity).toBe('0');
        expect(row.style.transform).not.toMatch(/translate/);
      }
    });
  });

  describe('while loading', () => {
    it('announces the loading state to screen readers with a status message', () => {
      renderWithMotion(<SamplePanel items={items} loading />);

      const status = screen.getByRole('status');
      expect(status.textContent).toMatch(/cargando/i);
      expect(status.getAttribute('aria-busy')).toBe('true');
    });

    it('draws one skeleton row per item, so the loading state has the shape of the real one', () => {
      const { container } = renderWithMotion(<SamplePanel items={items} loading />);

      expect(container.querySelectorAll('li')).toHaveLength(items.length);
    });

    it('does not show the content nor its names', () => {
      renderWithMotion(<SamplePanel items={items} loading />);

      expect(screen.queryByText('Arroz 500 g')).toBeNull();
      expect(screen.queryByRole('region', { name: /resumen de ejemplo/i })).toBeNull();
    });
  });

  // jsdom no calcula el diseno, asi que no puede medir el salto de la pagina al
  // pasar de skeleton a contenido. Lo que si se puede fijar es la causa: que cada
  // linea de la fila ocupe la misma altura en un estado y en el otro. La medida
  // real (en pixeles) se comprueba en un navegador.
  it('gives each line of a skeleton row the same height as the line of the real row', () => {
    const lineHeights = (container: HTMLElement): (string | undefined)[] =>
      [...container.querySelectorAll('li:first-child > div:first-child > *')].map(
        (line) => /\bh-\d+\b/.exec(line.className)?.[0],
      );

    const loaded = renderWithMotion(<SamplePanel items={items} loading={false} />);
    const contentHeights = lineHeights(loaded.container);
    loaded.unmount();
    const loading = renderWithMotion(<SamplePanel items={items} loading />);

    expect(contentHeights).toHaveLength(2);
    expect(contentHeights.every((height) => height !== undefined)).toBe(true);
    expect(lineHeights(loading.container)).toEqual(contentHeights);
  });
});
