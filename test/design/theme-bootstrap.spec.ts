// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MediaQuerySystemTheme } from '../../src/adapters/out/theme/media-query-system-theme';
import { THEME_STORAGE_KEY } from '../../src/adapters/out/theme/theme-storage-key';

// index.html pinta el tema ANTES de que arranque React, con un script en linea:
// si esperara a React, la persona veria un destello del tema equivocado. Ese
// script no pasa por el caso de uso, asi que estas pruebas lo ejecutan de
// verdad y comprueban que decide igual que el resto de la aplicacion.
const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

interface Scenario {
  saved?: string | null;
  systemDark?: boolean;
  storageBlocked?: boolean;
  hasMatchMedia?: boolean;
}

function run({
  saved = null,
  systemDark = false,
  storageBlocked = false,
  hasMatchMedia = true,
}: Scenario = {}) {
  const root = { dataset: {} as Record<string, string | undefined> };
  const asked: string[] = [];
  const window = {
    localStorage: {
      getItem: (key: string) => {
        if (storageBlocked) throw new Error('blocked');
        return key === THEME_STORAGE_KEY ? saved : null;
      },
    },
    matchMedia: hasMatchMedia
      ? (query: string) => {
          asked.push(query);
          return { matches: systemDark };
        }
      : undefined,
  };
  runInNewContext(script, { window, document: { documentElement: root } });
  return { theme: root.dataset['theme'], asked };
}

describe('theme bootstrap script in index.html', () => {
  it('exists, as a classic inline script in the head, so it runs before the first paint', () => {
    expect(script.trim().length).toBeGreaterThan(0);
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('</head>'));
  });

  it('uses the theme the person chose, even if the system prefers the other one', () => {
    expect(run({ saved: 'light', systemDark: true }).theme).toBe('light');
    expect(run({ saved: 'dark', systemDark: false }).theme).toBe('dark');
  });

  it('follows the system when the person never chose', () => {
    expect(run({ systemDark: true }).theme).toBe('dark');
    expect(run({ systemDark: false }).theme).toBe('light');
  });

  it('ignores a saved value that is not a theme', () => {
    expect(run({ saved: 'purple', systemDark: true }).theme).toBe('dark');
  });

  it('follows the system when the browser blocks storage', () => {
    expect(run({ storageBlocked: true, systemDark: true }).theme).toBe('dark');
  });

  it('falls back to the light theme when there is no matchMedia', () => {
    expect(run({ hasMatchMedia: false }).theme).toBe('light');
  });

  it('reads the same storage key that the adapter writes', () => {
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('asks for the same media query as the adapter that the rest of the app uses', () => {
    const adapterAsked: string[] = [];
    new MediaQuerySystemTheme((query) => {
      adapterAsked.push(query);
      return { matches: false };
    }).prefersDark();

    expect(run().asked).toEqual(adapterAsked);
  });
});
