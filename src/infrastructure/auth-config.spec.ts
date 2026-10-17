import { describe, expect, it } from 'vitest';
import { resolveAuthConfig } from './auth-config';

const URL_OK = 'https://abc.supabase.co/auth/v1';
const KEY_OK = 'sb_publishable_FALSA1234567890';

/** Un token firmado a medias, con la reclamacion `role` que se indique, como el que Supabase llama clave anonima o de servicio. */
function jwtWithRole(role: string): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.firma`;
}

describe('resolveAuthConfig', () => {
  it('is not configured when neither variable is set, so the app can start and say so', () => {
    expect(resolveAuthConfig({ DEV: false })).toBeNull();
    expect(
      resolveAuthConfig({ DEV: true, VITE_AUTH_URL: '  ', VITE_AUTH_PUBLISHABLE_KEY: '' }),
    ).toBeNull();
  });

  it('reads both variables, without a trailing slash', () => {
    expect(
      resolveAuthConfig({
        DEV: false,
        VITE_AUTH_URL: `${URL_OK}/`,
        VITE_AUTH_PUBLISHABLE_KEY: ` ${KEY_OK} `,
      }),
    ).toEqual({ authUrl: URL_OK, publishableKey: KEY_OK });
  });

  it('refuses to start with only one of the two, naming the one that is missing', () => {
    expect(() => resolveAuthConfig({ DEV: false, VITE_AUTH_URL: URL_OK })).toThrow(
      /VITE_AUTH_PUBLISHABLE_KEY/,
    );
    expect(() => resolveAuthConfig({ DEV: false, VITE_AUTH_PUBLISHABLE_KEY: KEY_OK })).toThrow(
      /VITE_AUTH_URL/,
    );
  });

  it.each([
    ['not an address', 'no-es-una-url'],
    ['another protocol', 'ftp://abc.supabase.co/auth/v1'],
    ['with credentials', 'https://usuario:clave@abc.supabase.co/auth/v1'],
    ['with a query string', `${URL_OK}?apikey=x`],
    ['with a fragment', `${URL_OK}#x`],
  ])('refuses an address that is %s, and does not repeat it', (_name, value) => {
    const attempt = () =>
      resolveAuthConfig({ DEV: false, VITE_AUTH_URL: value, VITE_AUTH_PUBLISHABLE_KEY: KEY_OK });

    expect(attempt).toThrow(/VITE_AUTH_URL/);
    try {
      attempt();
    } catch (error) {
      expect((error as Error).message).not.toContain(value);
    }
  });

  it('refuses plain http in a compiled version, but allows it on this machine for development', () => {
    expect(() =>
      resolveAuthConfig({
        DEV: false,
        VITE_AUTH_URL: 'http://abc.supabase.co/auth/v1',
        VITE_AUTH_PUBLISHABLE_KEY: KEY_OK,
      }),
    ).toThrow(/https/);
    expect(
      resolveAuthConfig({
        DEV: true,
        VITE_AUTH_URL: 'http://127.0.0.1:54321/auth/v1',
        VITE_AUTH_PUBLISHABLE_KEY: KEY_OK,
      }),
    ).toEqual({ authUrl: 'http://127.0.0.1:54321/auth/v1', publishableKey: KEY_OK });
    expect(
      resolveAuthConfig({
        DEV: true,
        VITE_AUTH_URL: 'http://localhost:9999',
        VITE_AUTH_PUBLISHABLE_KEY: KEY_OK,
      })?.authUrl,
    ).toBe('http://localhost:9999');
  });

  it('refuses plain http to another machine even in development', () => {
    expect(() =>
      resolveAuthConfig({
        DEV: true,
        VITE_AUTH_URL: 'http://abc.supabase.co/auth/v1',
        VITE_AUTH_PUBLISHABLE_KEY: KEY_OK,
      }),
    ).toThrow(/https/);
  });

  it('refuses a SECRET key: nothing secret ships in a browser bundle', () => {
    const attempt = () =>
      resolveAuthConfig({
        DEV: false,
        VITE_AUTH_URL: URL_OK,
        VITE_AUTH_PUBLISHABLE_KEY: 'sb_secret_ALGOMUYSECRETO',
      });

    expect(attempt).toThrow(/secret|secreta/i);
    try {
      attempt();
    } catch (error) {
      expect((error as Error).message).not.toContain('ALGOMUYSECRETO');
    }
  });

  it('refuses the service_role key in its old form, a signed token with that role', () => {
    expect(() =>
      resolveAuthConfig({
        DEV: false,
        VITE_AUTH_URL: URL_OK,
        VITE_AUTH_PUBLISHABLE_KEY: jwtWithRole('service_role'),
      }),
    ).toThrow(/service_role|secreta/i);
  });

  it('accepts the old anonymous key, which is public by design', () => {
    const anon = jwtWithRole('anon');

    expect(
      resolveAuthConfig({ DEV: false, VITE_AUTH_URL: URL_OK, VITE_AUTH_PUBLISHABLE_KEY: anon })
        ?.publishableKey,
    ).toBe(anon);
  });

  it('refuses a key with spaces or line breaks inside, which is a bad paste', () => {
    expect(() =>
      resolveAuthConfig({
        DEV: false,
        VITE_AUTH_URL: URL_OK,
        VITE_AUTH_PUBLISHABLE_KEY: 'sb_publishable_AB CD',
      }),
    ).toThrow(/VITE_AUTH_PUBLISHABLE_KEY/);
    expect(() =>
      resolveAuthConfig({
        DEV: false,
        VITE_AUTH_URL: URL_OK,
        VITE_AUTH_PUBLISHABLE_KEY: 'sb_publishable_AB\nCD',
      }),
    ).toThrow(/VITE_AUTH_PUBLISHABLE_KEY/);
  });
});
