import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { FakeSyncEngine } from '../../../test/support/sync-engine';
import { saleOperation } from '../../../test/support/fake-sync';
import { SyncProvider, useSync } from './SyncProvider';

function Probe() {
  const { state, syncNow, enqueue } = useSync();
  return (
    <>
      <p data-testid="pendientes">{String(state.pending)}</p>
      <p data-testid="fase">{state.phase}</p>
      <button type="button" onClick={syncNow}>
        enviar
      </button>
      <button
        type="button"
        onClick={() => {
          void enqueue(saleOperation(1));
        }}
      >
        encolar
      </button>
    </>
  );
}

const mount = (engine: FakeSyncEngine, strict = false) => {
  const tree = (
    <SyncProvider engine={engine}>
      <Probe />
    </SyncProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe('SyncProvider', () => {
  it('starts the engine when the interface appears and stops it when it goes away', () => {
    const engine = new FakeSyncEngine();

    const { unmount } = mount(engine);
    expect(engine.starts).toBe(1);
    expect(engine.stops).toBe(0);

    unmount();
    expect(engine.stops).toBe(1);
  });

  it('can be started twice in a row (the development double mount) and ends up with one watch', () => {
    const engine = new FakeSyncEngine();

    mount(engine, true);

    expect(engine.starts - engine.stops).toBe(1);
    expect(engine.subscribers).toBe(1);
  });

  it('shows what the engine says and shows every change at once', () => {
    const engine = new FakeSyncEngine({ pending: 2 });
    mount(engine);
    expect(screen.getByTestId('pendientes').textContent).toBe('2');

    act(() => {
      engine.set({ pending: 1, phase: 'sending' });
    });

    expect(screen.getByTestId('pendientes').textContent).toBe('1');
    expect(screen.getByTestId('fase').textContent).toBe('sending');
  });

  it('stops listening to the engine when it goes away', () => {
    const engine = new FakeSyncEngine();
    const { unmount } = mount(engine);
    expect(engine.subscribers).toBe(1);

    unmount();

    expect(engine.subscribers).toBe(0);
  });

  it('asks the engine to send now, and to queue what the person did', () => {
    const engine = new FakeSyncEngine();
    mount(engine);

    act(() => {
      screen.getByRole('button', { name: 'enviar' }).click();
      screen.getByRole('button', { name: 'encolar' }).click();
    });

    expect(engine.syncNows).toBe(1);
    expect(engine.enqueued).toEqual([saleOperation(1)]);
  });

  it('refuses to be used outside the provider, saying where it goes', () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow('useSync debe usarse dentro de <SyncProvider>');
    } finally {
      console.error = quiet;
    }
  });
});
