import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestConnection } from '../../test/support/connection';
import { createTestThemePreference } from '../../test/support/theme';
import { App } from './App';

function renderApp({
  theme = createTestThemePreference().preference,
  connection = createTestConnection(),
} = {}) {
  render(<App theme={theme} connection={connection.monitor} />);
  return connection;
}

describe('App', () => {
  it('shows the home page', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
  });

  it('gives the whole interface the motion provider, so no screen has to set it up', async () => {
    renderApp();

    // Sin el proveedor de movimiento, el contenido nunca termina de salir y el
    // estado de carga no llega a mostrarse: es lo que esta prueba vigila.
    fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));

    expect(await screen.findByText(/cargando el resumen/i)).toBeDefined();
  });

  it('gives the whole interface the theme: pressing the button applies the new theme', () => {
    const { preference, applied } = createTestThemePreference({ saved: 'light' });
    renderApp({ theme: preference });
    expect(applied).toEqual(['light']);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));

    expect(applied).toEqual(['light', 'dark']);
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
  });

  it('starts watching the connection when it opens, and shows what the server answers', async () => {
    const connection = renderApp();
    expect(connection.health.requests).toBe(1);

    await act(async () => {
      await connection.health.succeed();
    });

    expect(screen.getByText('En línea')).toBeDefined();
  });

  it('shows that there is no connection when the server does not answer', async () => {
    const connection = renderApp();

    await act(async () => {
      await connection.health.fail();
    });

    expect(screen.getByText('Sin conexión')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
  });
});
