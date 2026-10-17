import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createTestThemePreference } from '../../../test/support/theme';
import { ThemeProvider, useTheme } from './ThemeProvider';

function setup(options?: Parameters<typeof createTestThemePreference>[0]) {
  const { preference } = createTestThemePreference(options);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider preference={preference}>{children}</ThemeProvider>
  );
  return { preference, ...renderHook(() => useTheme(), { wrapper }) };
}

describe('useTheme', () => {
  it('gives the current theme', () => {
    const { result } = setup({ saved: 'dark' });

    expect(result.current.mode).toBe('dark');
  });

  it('switches the theme with toggle and renders again with the new one', () => {
    const { result } = setup({ saved: 'light' });

    act(() => {
      result.current.toggle();
    });

    expect(result.current.mode).toBe('dark');
  });

  it('renders again when the theme changes from outside the interface', () => {
    const { result, preference } = setup({ saved: 'light' });

    act(() => {
      preference.toggle();
    });

    expect(result.current.mode).toBe('dark');
  });

  it('fails with a clear message when it is used outside the provider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(/ThemeProvider/);
  });
});
