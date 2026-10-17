import { describe, expect, it } from 'vitest';
import { AuthError } from '../domain/model/auth-failure';
import { createAuth } from './create-auth';

const NOW = new Date('2026-10-17T12:00:00.000Z');

interface Call {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Un `fetch` de mentira: cada llamada queda anotada y la respuesta la da una funcion segun la direccion. */
function fakeFetch(answer: (url: string) => Response) {
  const calls: Call[] = [];
  const fetch = (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: input,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    return Promise.resolve(answer(input));
  };
  return { fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const session = {
  access_token: 'acceso-de-ana',
  refresh_token: 'renovacion-de-ana',
  expires_in: 3600,
  user: { id: 'ana', email: 'ana@example.com' },
};

const config = { authUrl: 'https://ref.supabase.co/auth/v1', publishableKey: 'sb_publishable_x' };

describe('createAuth', () => {
  it('signs in against the identity service with the publishable key, and keeps the session in memory', async () => {
    const { fetch, calls } = fakeFetch(() => json(session));
    const auth = createAuth({ auth: config, apiBaseUrl: 'http://api.test', fetch, now: () => NOW });

    await auth.sessions.signIn('ana@example.com', 'clave-larga-1');

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://ref.supabase.co/auth/v1/token?grant_type=password');
    expect(calls[0]!.headers['apikey']).toBe('sb_publishable_x');
    expect(auth.sessions.current()?.accessToken).toBe('acceso-de-ana');
  });

  it('asks the API who the person is with the token of the session, and nowhere else', async () => {
    const { fetch, calls } = fakeFetch((url) =>
      new URL(url).origin === 'http://api.test'
        ? json({ identity: { id: 'ana', email: 'ana@example.com' }, membership: null })
        : json(session),
    );
    const auth = createAuth({ auth: config, apiBaseUrl: 'http://api.test', fetch, now: () => NOW });
    await auth.sessions.signIn('ana@example.com', 'clave-larga-1');

    const me = await auth.loadMe.execute();

    expect(me.membership).toBeNull();
    const request = calls[1]!;
    expect(request.url).toBe('http://api.test/v1/me');
    expect(request.headers['authorization']).toBe('Bearer acceso-de-ana');
  });

  it('does not send the token to the identity service when asking the API', async () => {
    const { fetch, calls } = fakeFetch((url) =>
      new URL(url).origin === 'http://api.test'
        ? json({ identity: { id: 'ana', email: 'ana@example.com' }, membership: null })
        : json(session),
    );
    const auth = createAuth({ auth: config, apiBaseUrl: 'http://api.test', fetch, now: () => NOW });
    await auth.sessions.signIn('ana@example.com', 'clave-larga-1');
    await auth.loadMe.execute();

    expect(calls[0]!.headers['authorization']).toBeUndefined();
  });

  it('starts without a session: nothing is read from the device', () => {
    const { fetch, calls } = fakeFetch(() => json(session));
    const auth = createAuth({ auth: config, apiBaseUrl: '', fetch, now: () => NOW });

    expect(auth.sessions.current()).toBeNull();
    expect(calls).toEqual([]);
  });

  describe('without an identity service configured', () => {
    it('starts, and says the service is unavailable when the person tries to sign in', async () => {
      const { fetch, calls } = fakeFetch(() => json(session));
      const auth = createAuth({ auth: null, apiBaseUrl: '', fetch, now: () => NOW });

      const failure = await auth.sessions
        .signIn('ana@example.com', 'clave-larga-1')
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(AuthError);
      expect((failure as AuthError).kind).toBe('unavailable');
      expect(auth.sessions.current()).toBeNull();
      expect(calls).toEqual([]);
    });
  });
});
