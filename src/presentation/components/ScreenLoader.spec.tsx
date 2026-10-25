import { act, fireEvent, render, screen } from '@testing-library/react';
import { lazy, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenLoader } from './ScreenLoader';

/** Una pantalla perezosa que llega, o no llega, cuando la prueba lo decide. */
function screenOnDemand() {
  let arrive!: (module: { default: ComponentType }) => void;
  let fail!: (reason: Error) => void;
  const promise = new Promise<{ default: ComponentType }>((resolve, reject) => {
    arrive = resolve;
    fail = reject;
  });
  const Screen = lazy(() => promise);
  return {
    Screen,
    arrive: () =>
      act(async () => {
        arrive({ default: () => <h1>Catálogo</h1> });
        await promise;
      }),
    fail: () =>
      act(async () => {
        fail(new Error('Failed to fetch dynamically imported module'));
        await promise.catch(() => undefined);
      }),
  };
}

describe('ScreenLoader', () => {
  beforeEach(() => {
    // React cuenta en la consola lo que atrapa el limite; las pruebas que lo provocan lo callan.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows the screen as soon as it is there', () => {
    render(
      <ScreenLoader resetKey="/">
        <h1>Inicio</h1>
      </ScreenLoader>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Inicio' })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says the screen is on its way while it downloads, and shows it when it arrives', async () => {
    const { Screen, arrive } = screenOnDemand();
    render(
      <ScreenLoader resetKey="/catalogo">
        <Screen />
      </ScreenLoader>,
    );

    expect(screen.getByRole('status').textContent).toContain('Cargando la pantalla…');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();

    await arrive();

    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  describe('when the screen can not be opened', () => {
    it('says so instead of leaving the page blank, and offers to reload', async () => {
      const { Screen, fail } = screenOnDemand();
      render(
        <ScreenLoader resetKey="/catalogo" onReload={() => undefined}>
          <Screen />
        </ScreenLoader>,
      );

      await fail();

      expect(screen.getByRole('alert').textContent).toContain('No se pudo abrir esta pantalla');
      expect(screen.getByRole('button', { name: 'Recargar la aplicación' })).toBeDefined();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('reloads the application when the person asks, once per tap', async () => {
      const onReload = vi.fn();
      const { Screen, fail } = screenOnDemand();
      render(
        <ScreenLoader resetKey="/catalogo" onReload={onReload}>
          <Screen />
        </ScreenLoader>,
      );
      await fail();

      fireEvent.click(screen.getByRole('button', { name: 'Recargar la aplicación' }));

      expect(onReload).toHaveBeenCalledTimes(1);
    });

    it('reloads the page itself when nobody gives it another way to reload', async () => {
      const reload = vi.fn();
      vi.stubGlobal('location', { reload });
      const { Screen, fail } = screenOnDemand();
      render(
        <ScreenLoader resetKey="/catalogo">
          <Screen />
        </ScreenLoader>,
      );
      await fail();

      fireEvent.click(screen.getByRole('button', { name: 'Recargar la aplicación' }));

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('keeps saying so while the person stays on the same screen', async () => {
      const { Screen, fail } = screenOnDemand();
      const { rerender } = render(
        <ScreenLoader resetKey="/catalogo" onReload={() => undefined}>
          <Screen />
        </ScreenLoader>,
      );
      await fail();

      rerender(
        <ScreenLoader resetKey="/catalogo" onReload={() => undefined}>
          <Screen />
        </ScreenLoader>,
      );

      expect(screen.getByRole('alert')).toBeDefined();
    });

    it('lets go of the failure when the person moves to another screen', async () => {
      const { Screen, fail } = screenOnDemand();
      const { rerender } = render(
        <ScreenLoader resetKey="/catalogo" onReload={() => undefined}>
          <Screen />
        </ScreenLoader>,
      );
      await fail();

      rerender(
        <ScreenLoader resetKey="/inventario" onReload={() => undefined}>
          <h1>Existencias</h1>
        </ScreenLoader>,
      );

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('heading', { level: 1, name: 'Existencias' })).toBeDefined();
    });

    it('catches the next screen too if that one does not open either, after the person left one that did not', async () => {
      const Broken = () => {
        throw new Error('boom');
      };
      const { Screen, fail } = screenOnDemand();
      const { rerender } = render(
        <ScreenLoader resetKey="/catalogo" onReload={() => undefined}>
          <Screen />
        </ScreenLoader>,
      );
      await fail();

      rerender(
        <ScreenLoader resetKey="/inventario" onReload={() => undefined}>
          <Broken />
        </ScreenLoader>,
      );

      expect(screen.getByRole('alert').textContent).toContain('No se pudo abrir esta pantalla');
    });

    it('also catches a screen that breaks while it draws, because for the person it is the same: this screen does not open', () => {
      const Broken = () => {
        throw new Error('boom');
      };
      render(
        <ScreenLoader resetKey="/catalogo" onReload={() => undefined}>
          <Broken />
        </ScreenLoader>,
      );

      expect(screen.getByRole('alert').textContent).toContain('No se pudo abrir esta pantalla');
    });
  });
});
