import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestConnection } from '../../../test/support/connection';
import { setPrefersReducedMotion } from '../../../test/support/match-media';
import { createTestPwa } from '../../../test/support/pwa';
import { renderWithProviders } from '../../../test/support/render';
import { PwaProvider } from '../pwa/PwaProvider';
import { ConnectionPanel } from './ConnectionPanel';

const SERVER_TIME = new Date('2026-10-16T15:30:00.000Z');

function setup(options: { online?: boolean } = {}) {
  const connection = createTestConnection(options);
  const view = renderWithProviders(<ConnectionPanel />, { connection: connection.monitor });
  const panel = () => screen.getByRole('status');
  return { ...connection, ...view, panel };
}

describe('ConnectionPanel', () => {
  describe('checking', () => {
    it('says it is checking until the server answers, even if the browser says there is a network', () => {
      const { panel } = setup({ online: true });

      expect(within(panel()).getByText('Comprobando conexión…')).toBeDefined();
      expect(screen.queryByText('En línea')).toBeNull();
    });

    it('explains what it is doing', () => {
      setup();

      expect(screen.getByText(/preguntamos al servidor si está disponible/i)).toBeDefined();
    });

    it('has no retry button: there is nothing to retry yet', () => {
      setup();

      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });
  });

  describe('online', () => {
    it('says "En línea" once the server answers /health', async () => {
      const { panel, health } = setup();

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      expect(within(panel()).getByText('En línea')).toBeDefined();
      expect(screen.queryByText('Comprobando conexión…')).toBeNull();
    });

    it('shows when the server confirmed it, as a machine readable time', async () => {
      const { panel, health } = setup();

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      const time = panel().querySelector('time');
      expect(time?.getAttribute('datetime')).toBe('2026-10-16T15:30:00.000Z');
      expect(panel().textContent).toMatch(/confirmado a las/i);
    });

    it('has no retry button while everything works', async () => {
      const { health } = setup();

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });
  });

  describe('offline', () => {
    it('says "Sin conexión" when the server does not answer, even if the browser says there is a network', async () => {
      const { panel, health } = setup({ online: true });

      await act(async () => {
        await health.fail();
      });

      expect(within(panel()).getByText('Sin conexión')).toBeDefined();
      expect(screen.queryByText('En línea')).toBeNull();
    });

    it('says "Sin conexión" at once, without asking, when the browser reports no network', () => {
      const { panel, health } = setup({ online: false });

      expect(within(panel()).getByText('Sin conexión')).toBeDefined();
      expect(health.requests).toBe(0);
    });

    it('goes offline when the browser reports the loss of the network while online', async () => {
      const { panel, health, hints } = setup();
      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      act(() => {
        hints.emit(false);
      });

      expect(within(panel()).getByText('Sin conexión')).toBeDefined();
    });

    it('remembers when it was last connected', async () => {
      const { panel, health, scheduler } = setup();
      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      await act(async () => {
        await scheduler.fire();
        await health.fail();
      });

      expect(panel().textContent).toMatch(/última conexión/i);
      expect(panel().querySelector('time')?.getAttribute('datetime')).toBe(
        '2026-10-16T15:30:00.000Z',
      );
    });

    it('does not talk about a last connection when it never had one', async () => {
      const { panel, health } = setup();

      await act(async () => {
        await health.fail();
      });

      expect(panel().textContent).not.toMatch(/última conexión/i);
      expect(panel().querySelector('time')).toBeNull();
    });

    it('offers to retry, and retrying shows the check and then the result', async () => {
      const { panel, health } = setup();
      await act(async () => {
        await health.fail();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
      expect(await screen.findByText('Comprobando conexión…')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });
      expect(await within(panel()).findByText('En línea')).toBeDefined();
    });

    it('makes the retry button at least 44 px, like every touch target', async () => {
      const { health } = setup();
      await act(async () => {
        await health.fail();
      });

      const classes = screen.getByRole('button', { name: 'Reintentar' }).className.split(/\s+/);
      expect(classes).toContain('min-h-touch');
    });
  });

  describe('motion', () => {
    const dot = () => screen.getByRole('status').querySelector<HTMLElement>('span[aria-hidden]');

    it('pulses the dot while it is checking, also when the page has just opened', async () => {
      setup();

      // El punto debe empezar a cambiar su opacidad: un pulso que nunca arranca
      // se queda en 1 para siempre (pasaba si el primer estado no animaba).
      await waitFor(
        () => {
          expect(Number(dot()?.style.opacity)).toBeLessThan(1);
        },
        { timeout: 2000 },
      );
    });

    it('keeps the dot still when the person asked for less motion', async () => {
      setPrefersReducedMotion(true);
      setup();

      // Sin movimiento el punto no recibe ningun estilo: su opacidad es la de siempre.
      const seen = new Set<number>();
      for (let i = 0; i < 8; i += 1) {
        seen.add(Number(dot()?.style.opacity || '1'));
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect([...seen]).toEqual([1]);
    });
  });

  describe('copy', () => {
    // La hora en español ya termina en punto ("3:30 p. m."): un punto mas queda "p. m..".
    it('does not end the time with two periods when the server confirmed it', async () => {
      const { panel, health } = setup();

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      expect(panel().textContent).toMatch(/confirmado a las/i);
      expect(panel().textContent).not.toContain('..');
    });

    it('never breaks a time across two lines ("8:42" on one line and "p. m." on the next)', async () => {
      const { panel, health } = setup();

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      expect(panel().querySelector('time')?.className).toContain('whitespace-nowrap');
    });

    it('does not end the time with two periods in the last connection either', async () => {
      const { panel, health, scheduler } = setup();
      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      await act(async () => {
        await scheduler.fire();
        await health.fail();
      });

      expect(panel().textContent).toMatch(/última conexión/i);
      expect(panel().textContent).not.toContain('..');
    });
  });

  describe('accessibility', () => {
    it('is a live region, so a screen reader announces each change by itself', async () => {
      const { panel, health } = setup();
      expect(panel().getAttribute('role')).toBe('status');

      await act(async () => {
        await health.fail();
      });

      expect(within(panel()).getByText('Sin conexión')).toBeDefined();
    });

    it('never tells the state by color alone: every state has a text, and its icon is decoration', async () => {
      const { panel, health } = setup();
      const icons = () => [...panel().querySelectorAll('svg')];

      await act(async () => {
        await health.succeed(SERVER_TIME);
      });

      expect(panel().textContent).toContain('En línea');
      // El icono entra cuando termina de salir el anterior (la animacion espera).
      await waitFor(() => {
        expect(icons().length).toBeGreaterThan(0);
      });
      expect(icons().every((icon) => icon.getAttribute('aria-hidden') === 'true')).toBe(true);
    });
  });

  describe('what is stored on this device', () => {
    const withStorage = async (change: (test: ReturnType<typeof createTestPwa>) => void) => {
      const test = createTestPwa();
      change(test);
      renderWithProviders(
        <PwaProvider updates={test.updates} storage={test.protection}>
          <ConnectionPanel />
        </PwaProvider>,
      );
      await act(() => Promise.resolve());
    };

    it('says nothing until the browser has answered', () => {
      setup();

      expect(screen.queryByText(/protegido/i)).toBeNull();
      expect(screen.queryByText(/podría borrar/i)).toBeNull();
    });

    it('says what is stored is protected when the browser promised to keep it', async () => {
      await withStorage(() => undefined);

      expect(screen.getByText('Lo guardado en este dispositivo está protegido.')).toBeDefined();
    });

    it('warns that the browser could delete it, and asks to send the sales soon, when it did not promise', async () => {
      await withStorage((test) => {
        test.storage.grants = false;
      });

      expect(
        screen.getByText(
          'El navegador podría borrar lo guardado si se queda sin espacio. Envía tus ventas pronto.',
        ),
      ).toBeDefined();
    });

    it('says the browser can not protect it when it has no such feature', async () => {
      await withStorage((test) => {
        test.storage.supported = false;
      });

      expect(
        screen.getByText('Este navegador no puede proteger lo guardado en el dispositivo.'),
      ).toBeDefined();
    });
  });
});
