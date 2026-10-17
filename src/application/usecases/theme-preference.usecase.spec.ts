// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ThemeMode } from '../../domain/model/theme';
import type { SystemTheme } from '../../domain/ports/out/system-theme';
import type { ThemeApplier } from '../../domain/ports/out/theme-applier';
import type { ThemeStorage } from '../../domain/ports/out/theme-storage';
import { ThemePreferenceUseCase } from './theme-preference.usecase';

// Dobles en memoria de los tres puertos de salida: el caso de uso se prueba
// sin navegador, que es justo lo que pide la arquitectura (ADR 0002).
function setup({
  saved = null,
  systemDark = false,
}: { saved?: ThemeMode | null; systemDark?: boolean } = {}) {
  let stored: ThemeMode | null = saved;
  const written: ThemeMode[] = [];
  const applied: ThemeMode[] = [];
  const storage: ThemeStorage = {
    read: () => stored,
    write: (mode) => {
      stored = mode;
      written.push(mode);
    },
  };
  const system: SystemTheme = { prefersDark: () => systemDark };
  const applier: ThemeApplier = { apply: (mode) => applied.push(mode) };
  const preference = new ThemePreferenceUseCase({ storage, system, applier });
  return { preference, written, applied, savedMode: () => stored };
}

describe('ThemePreferenceUseCase', () => {
  describe('starting theme', () => {
    it('uses the theme the person chose last time, even if the system prefers the other one', () => {
      const { preference } = setup({ saved: 'light', systemDark: true });

      expect(preference.current()).toBe('light');
    });

    it('follows the system when the person never chose: dark', () => {
      const { preference } = setup({ systemDark: true });

      expect(preference.current()).toBe('dark');
    });

    it('follows the system when the person never chose: light', () => {
      const { preference } = setup({ systemDark: false });

      expect(preference.current()).toBe('light');
    });

    it('applies the starting theme to the page', () => {
      const { applied } = setup({ saved: 'dark' });

      expect(applied).toEqual(['dark']);
    });

    it('does not save the starting theme: someone who never chose keeps following the system', () => {
      const { written } = setup({ systemDark: true });

      expect(written).toEqual([]);
    });
  });

  describe('toggle', () => {
    it('switches the theme and returns the new one', () => {
      const { preference } = setup({ saved: 'light' });

      expect(preference.toggle()).toBe('dark');
      expect(preference.current()).toBe('dark');
    });

    it('applies the new theme to the page', () => {
      const { preference, applied } = setup({ saved: 'light' });

      preference.toggle();

      expect(applied).toEqual(['light', 'dark']);
    });

    it('saves the choice, so it is remembered the next time', () => {
      const { preference, savedMode } = setup({ saved: 'light' });

      preference.toggle();

      expect(savedMode()).toBe('dark');
    });

    it('goes back to the starting theme after two toggles', () => {
      const { preference } = setup({ saved: 'dark' });

      preference.toggle();
      preference.toggle();

      expect(preference.current()).toBe('dark');
    });
  });

  describe('subscribe', () => {
    it('tells the subscriber the new theme every time it changes', () => {
      const { preference } = setup({ saved: 'light' });
      const listener = vi.fn();
      preference.subscribe(listener);

      preference.toggle();
      preference.toggle();

      expect(listener.mock.calls).toEqual([['dark'], ['light']]);
    });

    it('does not tell a subscriber that already unsubscribed', () => {
      const { preference } = setup({ saved: 'light' });
      const listener = vi.fn();
      const unsubscribe = preference.subscribe(listener);

      unsubscribe();
      preference.toggle();

      expect(listener).not.toHaveBeenCalled();
    });

    it('does not tell anyone when nothing changed yet', () => {
      const { preference } = setup({ saved: 'light' });
      const listener = vi.fn();

      preference.subscribe(listener);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
