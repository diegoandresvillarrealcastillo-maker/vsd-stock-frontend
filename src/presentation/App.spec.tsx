import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestThemePreference } from '../../test/support/theme';
import { App } from './App';

describe('App', () => {
  it('shows the home page', () => {
    render(<App theme={createTestThemePreference().preference} />);

    expect(screen.getByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
  });

  it('gives the whole interface the motion provider, so no screen has to set it up', async () => {
    render(<App theme={createTestThemePreference().preference} />);

    // Sin el proveedor de movimiento, el contenido nunca termina de salir y el
    // estado de carga no llega a mostrarse: es lo que esta prueba vigila.
    fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));

    expect((await screen.findByRole('status')).textContent).toMatch(/cargando/i);
  });

  it('gives the whole interface the theme: pressing the button applies the new theme', () => {
    const { preference, applied } = createTestThemePreference({ saved: 'light' });
    render(<App theme={preference} />);
    expect(applied).toEqual(['light']);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));

    expect(applied).toEqual(['light', 'dark']);
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
  });
});
