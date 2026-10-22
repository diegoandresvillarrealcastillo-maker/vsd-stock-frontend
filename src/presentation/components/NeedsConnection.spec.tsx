import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestConnection } from '../../../test/support/connection';
import { renderWithProviders } from '../../../test/support/render';
import { NeedsConnection } from './NeedsConnection';

function setup() {
  const connection = createTestConnection();
  const view = renderWithProviders(
    <NeedsConnection>
      <p>El contenido de la pantalla</p>
    </NeedsConnection>,
    { connection: connection.monitor },
  );
  return { ...connection, ...view };
}

describe('NeedsConnection', () => {
  it('shows the screen while it is still checking: no flash of a warning on opening', () => {
    setup();

    expect(screen.getByText('El contenido de la pantalla')).toBeDefined();
    expect(screen.queryByText(/necesita conexión/i)).toBeNull();
  });

  it('shows the screen when the server answers', async () => {
    const { health } = setup();

    await act(async () => {
      await health.succeed();
    });

    expect(screen.getByText('El contenido de la pantalla')).toBeDefined();
    expect(screen.queryByText(/necesita conexión/i)).toBeNull();
  });

  it('says the screen needs a connection, instead of showing it empty or stale, when the server does not answer', async () => {
    const { health } = setup();

    await act(async () => {
      await health.fail();
    });

    expect(screen.queryByText('El contenido de la pantalla')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/esta pantalla necesita conexión/i);
  });

  it('explains what to do, as a status region a screen reader announces', async () => {
    const { health } = setup();

    await act(async () => {
      await health.fail();
    });

    const region = screen.getByRole('status');
    expect(region.textContent).toMatch(/hablar con el servidor/i);
    expect(region.textContent).toMatch(/vuelva la conexión/i);
  });

  it('offers to try again, and asks the server again when pressed', async () => {
    const { health } = setup();
    await act(async () => {
      await health.fail();
    });
    const before = health.requests;

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(health.requests).toBe(before + 1);
  });

  it('brings the screen back by itself once the connection returns', async () => {
    const { health } = setup();
    await act(async () => {
      await health.fail();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await act(async () => {
      await health.succeed();
    });

    expect(screen.getByText('El contenido de la pantalla')).toBeDefined();
  });
});
