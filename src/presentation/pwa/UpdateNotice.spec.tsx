import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createTestPwa } from '../../../test/support/pwa';
import { MotionProvider } from '../motion/MotionProvider';
import { PwaProvider, useHoldUpdates } from './PwaProvider';
import { UpdateNotice } from './UpdateNotice';

function setup() {
  const test = createTestPwa();
  render(
    <MotionProvider>
      <PwaProvider updates={test.updates} storage={test.protection}>
        <UpdateNotice />
      </PwaProvider>
    </MotionProvider>,
  );
  return test;
}

/** Deja que se resuelva el registro del service worker. */
const registered = () => act(() => Promise.resolve());

describe('UpdateNotice', () => {
  it('shows nothing while there is no newer version', async () => {
    setup();
    await registered();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('announces a newer version and lets the person choose when to use it', async () => {
    const { host } = setup();
    await registered();

    act(() => {
      host.emitUpdateReady();
    });

    const notice = screen.getByRole('status');
    expect(notice.textContent).toContain('Hay una versión nueva de VSD Stock.');
    expect(screen.getByRole('button', { name: 'Actualizar ahora' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Más tarde' })).toBeDefined();
    // Nunca se activa sola.
    expect(host.activations).toBe(0);
  });

  it('applies it when the person asks, and says it is updating', async () => {
    const { host } = setup();
    await registered();
    act(() => {
      host.emitUpdateReady();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar ahora' }));

    expect(host.activations).toBe(1);
    expect(screen.getByRole('status').textContent).toContain('Actualizando…');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('goes away when the person says later, and does not apply anything', async () => {
    const { host } = setup();
    await registered();
    act(() => {
      host.emitUpdateReady();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(host.activations).toBe(0);
  });

  it('does not offer to update while a sale is in progress, and says why', async () => {
    const { host, updates } = setup();
    await registered();
    act(() => {
      host.emitUpdateReady();
    });

    let release = () => {};
    act(() => {
      release = updates.hold();
    });

    expect(screen.getByRole('status').textContent).toContain('Termina la venta en curso');
    expect(screen.queryByRole('button', { name: 'Actualizar ahora' })).toBeNull();

    act(() => {
      release();
    });

    expect(screen.getByRole('button', { name: 'Actualizar ahora' })).toBeDefined();
  });
});

describe('UpdateNotice without a provider', () => {
  it('shows nothing: there is nothing to update when no one is watching for versions', () => {
    render(<UpdateNotice />);

    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('PwaProvider', () => {
  it('installs the service and asks the browser to protect what is stored, as soon as the application opens', async () => {
    const { host, storage } = setup();
    await registered();

    expect(host.registered).toBe(1);
    expect(storage.requests).toBe(1);
  });

  it('stops listening when the application closes', async () => {
    const test = createTestPwa();
    const view = render(
      <PwaProvider updates={test.updates} storage={test.protection}>
        <UpdateNotice />
      </PwaProvider>,
    );
    await registered();

    view.unmount();

    expect(test.host.listening).toBe(0);
  });
});

describe('useHoldUpdates', () => {
  function Sale() {
    const [selling, setSelling] = useState(true);
    useHoldUpdates(selling);
    return (
      <button type="button" onClick={() => setSelling(false)}>
        Terminar venta
      </button>
    );
  }

  it('holds updates back while a screen asks, and lets go when it stops asking or goes away', async () => {
    const test = createTestPwa();
    const view = render(
      <PwaProvider updates={test.updates} storage={test.protection}>
        <Sale />
      </PwaProvider>,
    );
    await registered();
    expect(test.updates.current().held).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Terminar venta' }));
    expect(test.updates.current().held).toBe(false);

    view.unmount();
    expect(test.updates.current().held).toBe(false);
  });

  it('lets go when the screen goes away in the middle of a sale', async () => {
    const test = createTestPwa();
    const view = render(
      <PwaProvider updates={test.updates} storage={test.protection}>
        <Sale />
      </PwaProvider>,
    );
    await registered();

    view.unmount();

    expect(test.updates.current().held).toBe(false);
  });
});
