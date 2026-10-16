import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('shows the home page', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
  });

  it('gives the whole interface the motion provider, so no screen has to set it up', async () => {
    render(<App />);

    // Sin el proveedor de movimiento, el contenido nunca termina de salir y el
    // estado de carga no llega a mostrarse: es lo que esta prueba vigila.
    fireEvent.click(screen.getByRole('button', { name: 'Ver estado de carga' }));

    expect((await screen.findByRole('status')).textContent).toMatch(/cargando/i);
  });
});
