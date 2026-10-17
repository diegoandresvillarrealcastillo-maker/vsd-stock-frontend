import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createTestConnection } from '../../../test/support/connection';
import { ConnectionProvider, useConnection } from './ConnectionProvider';

function Probe() {
  const { state, retry } = useConnection();
  return (
    <div>
      <p>estado: {state.status}</p>
      <button type="button" onClick={retry}>
        reintentar
      </button>
    </div>
  );
}

describe('ConnectionProvider', () => {
  it('fails with a clear message when useConnection is used outside the provider', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow(
      'useConnection debe usarse dentro de <ConnectionProvider>',
    );

    logged.mockRestore();
  });

  it('starts watching the connection as soon as it is mounted', () => {
    const { monitor, health } = createTestConnection();

    render(
      <ConnectionProvider monitor={monitor}>
        <Probe />
      </ConnectionProvider>,
    );

    expect(health.requests).toBe(1);
  });

  it('stops watching when it is unmounted, so nothing keeps listening to the browser', () => {
    const { monitor, hints } = createTestConnection();
    const { unmount } = render(
      <ConnectionProvider monitor={monitor}>
        <Probe />
      </ConnectionProvider>,
    );
    expect(hints.subscribers).toBe(1);

    unmount();

    expect(hints.subscribers).toBe(0);
  });

  it('leaves exactly one listener even when React mounts it twice in development', () => {
    const { monitor, hints } = createTestConnection();

    render(
      <StrictMode>
        <ConnectionProvider monitor={monitor}>
          <Probe />
        </ConnectionProvider>
      </StrictMode>,
    );

    expect(hints.subscribers).toBe(1);
  });

  it('redraws its children when the state of the connection changes', async () => {
    const { monitor, health } = createTestConnection();
    render(
      <ConnectionProvider monitor={monitor}>
        <Probe />
      </ConnectionProvider>,
    );
    expect(screen.getByText('estado: checking')).toBeDefined();

    await act(async () => {
      await health.succeed();
    });

    expect(screen.getByText('estado: online')).toBeDefined();
  });

  it('lets a child ask for a new check', async () => {
    const { monitor, health } = createTestConnection();
    render(
      <ConnectionProvider monitor={monitor}>
        <Probe />
      </ConnectionProvider>,
    );
    await act(async () => {
      await health.fail();
    });
    expect(screen.getByText('estado: offline')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'reintentar' }));

    expect(screen.getByText('estado: checking')).toBeDefined();
    await act(async () => {
      await health.succeed();
    });
    expect(screen.getByText('estado: online')).toBeDefined();
  });
});
