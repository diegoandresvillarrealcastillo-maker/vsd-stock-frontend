// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isThemeMode, toggleTheme } from './theme';

describe('isThemeMode', () => {
  it.each(['light', 'dark'])('accepts %s', (value) => {
    expect(isThemeMode(value)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['a mode that does not exist', 'system'],
    ['a different case', 'Dark'],
    ['a number', 1],
    ['an object', { mode: 'dark' }],
  ])('rejects %s, so a stale or tampered saved value cannot become a theme', (_label, value) => {
    expect(isThemeMode(value)).toBe(false);
  });
});

describe('toggleTheme', () => {
  it('goes from light to dark', () => {
    expect(toggleTheme('light')).toBe('dark');
  });

  it('goes from dark to light', () => {
    expect(toggleTheme('dark')).toBe('light');
  });
});
