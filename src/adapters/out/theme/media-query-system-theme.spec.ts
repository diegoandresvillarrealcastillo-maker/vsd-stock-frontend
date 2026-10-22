// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MediaQuerySystemTheme } from './media-query-system-theme';

describe('MediaQuerySystemTheme', () => {
  it('asks the browser for the dark color scheme preference', () => {
    const asked: string[] = [];
    const system = new MediaQuerySystemTheme((query) => {
      asked.push(query);
      return { matches: true };
    });

    system.prefersDark();

    expect(asked).toEqual(['(prefers-color-scheme: dark)']);
  });

  it('says the system prefers dark when the query matches', () => {
    expect(new MediaQuerySystemTheme(() => ({ matches: true })).prefersDark()).toBe(true);
  });

  it('says the system does not prefer dark when the query does not match', () => {
    expect(new MediaQuerySystemTheme(() => ({ matches: false })).prefersDark()).toBe(false);
  });

  it('says it does not prefer dark when the browser has no matchMedia', () => {
    expect(new MediaQuerySystemTheme(undefined).prefersDark()).toBe(false);
  });
});
