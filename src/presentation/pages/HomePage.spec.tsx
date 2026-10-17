import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestConnection } from '../../../test/support/connection';
import { renderWithProviders } from '../../../test/support/render';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  describe('brand', () => {
    it('shows the VSD Stock logo as the main heading of the page, named for screen readers', () => {
      renderWithProviders(<HomePage />);

      const heading = screen.getByRole('heading', { level: 1, name: 'VSD Stock' });
      expect(within(heading).getByRole('img', { name: 'VSD Stock' })).toBeDefined();
    });

    it('gives the logo its size, so the page does not jump when the image arrives', () => {
      renderWithProviders(<HomePage />);

      const logo = screen.getByRole('img', { name: 'VSD Stock' });
      expect(Number(logo.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(logo.getAttribute('height'))).toBeGreaterThan(0);
    });

    it('puts the heading inside the main landmark, so a screen reader can jump to it', () => {
      renderWithProviders(<HomePage />);

      const main = screen.getByRole('main');
      expect(main.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
    });

    it('tells the person, in Spanish, that the first version is being built', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByText(/estamos construyendo la primera versión/i)).toBeDefined();
    });
  });

  describe('theme button', () => {
    it('lives in the banner at the top, where a person looks for it', () => {
      renderWithProviders(<HomePage />);

      const banner = screen.getByRole('banner');
      expect(
        within(banner).getByRole('button', { name: /cambiar a tema (oscuro|claro)/i }),
      ).toBeDefined();
    });
  });

  describe('connection status', () => {
    it('has a heading for the status of the service, below the main one', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('heading', { level: 2, name: 'Estado del servicio' })).toBeDefined();
    });

    it('shows the connection panel inside that section', () => {
      renderWithProviders(<HomePage />);

      const section = screen.getByRole('region', { name: 'Estado del servicio' });
      expect(within(section).getByRole('status')).toBeDefined();
    });

    it('says that the server decides, not the network of the device', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByText(/que tu equipo diga que hay red no basta/i)).toBeDefined();
    });

    it('comes before the design sample', () => {
      renderWithProviders(<HomePage />);

      const connection = screen.getByRole('heading', { level: 2, name: 'Estado del servicio' });
      const sample = screen.getByRole('heading', { level: 2, name: /muestra de diseño/i });
      expect(
        connection.compareDocumentPosition(sample) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('reflects what the server answers', async () => {
      const connection = createTestConnection();
      renderWithProviders(<HomePage />, { connection: connection.monitor });

      await act(async () => {
        await connection.health.succeed();
      });

      expect(screen.getByText('En línea')).toBeDefined();
    });
  });

  describe('design sample', () => {
    // El panel de conexion tambien es una region "status": el esqueleto se busca por su texto.
    const loadingMessage = /cargando el resumen/i;

    it('starts with the sample content loaded, not with the skeleton', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('region', { name: /resumen de ejemplo/i })).toBeDefined();
      expect(screen.queryByText(loadingMessage)).toBeNull();
    });

    it('shows the skeleton with a loading message when the person asks to see that state', async () => {
      renderWithProviders(<HomePage />);

      fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));

      expect(await screen.findByText(loadingMessage)).toBeDefined();
    });

    it('goes back to the content, with the button naming the action it will do next', async () => {
      renderWithProviders(<HomePage />);
      fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));
      await screen.findByText(loadingMessage);

      fireEvent.click(screen.getByRole('button', { name: 'Ver contenido' }));

      expect(await screen.findByRole('region', { name: /resumen de ejemplo/i })).toBeDefined();
    });

    it('has a sample heading below the main one, so the page outline stays in order', () => {
      renderWithProviders(<HomePage />);

      expect(screen.getByRole('heading', { level: 2, name: /muestra de diseño/i })).toBeDefined();
    });
  });
});
