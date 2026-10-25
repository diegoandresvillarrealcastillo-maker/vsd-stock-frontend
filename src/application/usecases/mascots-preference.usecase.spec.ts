// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { MascotsStorage } from '../../domain/ports/out/mascots-storage';
import { MascotsPreferenceUseCase } from './mascots-preference.usecase';

// Doble en memoria del unico puerto de salida: el caso de uso se prueba sin navegador (ADR 0002).
function setup({ saved = null }: { saved?: boolean | null } = {}) {
  let stored: boolean | null = saved;
  const written: boolean[] = [];
  const storage: MascotsStorage = {
    read: () => stored,
    write: (enabled) => {
      stored = enabled;
      written.push(enabled);
    },
  };
  const preference = new MascotsPreferenceUseCase({ storage });
  return { preference, written, savedValue: () => stored };
}

describe('MascotsPreferenceUseCase', () => {
  describe('starting value', () => {
    it('shows the mascots when the person never chose: they are part of the product', () => {
      const { preference } = setup();

      expect(preference.enabled()).toBe(true);
    });

    it('keeps them off when the person turned them off last time', () => {
      const { preference } = setup({ saved: false });

      expect(preference.enabled()).toBe(false);
    });

    it('keeps them on when the person chose to see them', () => {
      const { preference } = setup({ saved: true });

      expect(preference.enabled()).toBe(true);
    });

    it('does not save the starting value: only a choice made on purpose is remembered', () => {
      const { written } = setup();

      expect(written).toEqual([]);
    });
  });

  describe('toggle', () => {
    it('turns them off and returns the new value', () => {
      const { preference } = setup();

      expect(preference.toggle()).toBe(false);
      expect(preference.enabled()).toBe(false);
    });

    it('turns them back on the next time', () => {
      const { preference } = setup();

      preference.toggle();

      expect(preference.toggle()).toBe(true);
      expect(preference.enabled()).toBe(true);
    });

    it('remembers each choice', () => {
      const { preference, written, savedValue } = setup();

      preference.toggle();
      preference.toggle();

      expect(written).toEqual([false, true]);
      expect(savedValue()).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('tells the listener the new value every time it changes', () => {
      const { preference } = setup();
      const listener = vi.fn();
      preference.subscribe(listener);

      preference.toggle();
      preference.toggle();

      expect(listener.mock.calls).toEqual([[false], [true]]);
    });

    it('stops telling the listener after it unsubscribes', () => {
      const { preference } = setup();
      const listener = vi.fn();
      const unsubscribe = preference.subscribe(listener);

      unsubscribe();
      preference.toggle();

      expect(listener).not.toHaveBeenCalled();
    });

    it('tells every listener, not only the first', () => {
      const { preference } = setup();
      const first = vi.fn();
      const second = vi.fn();
      preference.subscribe(first);
      preference.subscribe(second);

      preference.toggle();

      expect(first).toHaveBeenCalledWith(false);
      expect(second).toHaveBeenCalledWith(false);
    });
  });
});
