import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithMotion } from '../../../test/support/render';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('shows the product name as the main heading of the page', () => {
    renderWithMotion(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
  });

  it('puts its content inside the main landmark, so a screen reader can jump to it', () => {
    renderWithMotion(<HomePage />);

    const main = screen.getByRole('main');
    expect(main.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });

  it('tells the person, in Spanish, that the first version is being built', () => {
    renderWithMotion(<HomePage />);

    expect(screen.getByText(/estamos construyendo la primera versión/i)).toBeDefined();
  });

  describe('design sample', () => {
    it('starts with the sample content loaded, not with the skeleton', () => {
      renderWithMotion(<HomePage />);

      expect(screen.getByRole('region', { name: /resumen de ejemplo/i })).toBeDefined();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows the skeleton with a loading message when the person asks to see that state', async () => {
      renderWithMotion(<HomePage />);

      fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));

      expect((await screen.findByRole('status')).textContent).toMatch(/cargando/i);
    });

    it('goes back to the content, with the button naming the action it will do next', async () => {
      renderWithMotion(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));
      await screen.findByRole('status');

      fireEvent.click(screen.getByRole('button', { name: 'Ver contenido' }));

      expect(await screen.findByRole('region', { name: /resumen de ejemplo/i })).toBeDefined();
    });

    it('has a sample heading below the main one, so the page outline stays in order', () => {
      renderWithMotion(<HomePage />);

      expect(screen.getByRole('heading', { level: 2, name: /muestra de diseño/i })).toBeDefined();
    });
  });
});
