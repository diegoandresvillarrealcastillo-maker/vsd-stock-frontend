// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AuthError } from '../../../domain/model/auth-failure';
import { HttpIdentityService } from './http-identity-service';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const USER_ID = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';

interface Seen {
  url: string;
  method: string | undefined;
  headers: Headers;
  body: unknown;
  init: RequestInit | undefined;
}

function setup(answer: Response | Error | ((seen: Seen) => Response | Error)) {
  const seen: Seen[] = [];
  const service = new HttpIdentityService({
    authUrl: 'https://abc.supabase.co/auth/v1/',
    publishableKey: 'sb_publishable_FALSA',
    clock: { now: () => NOW },
    fetch: (input, init) => {
      const record: Seen = {
        url: input,
        method: init?.method,
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        init,
      };
      seen.push(record);
      const result = typeof answer === 'function' ? answer(record) : answer;
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result.clone());
    },
  });
  return { service, seen };
}

const tokenResponse = (overrides: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      access_token: 'acceso',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'renovacion',
      user: { id: USER_ID, email: 'ana@example.com', role: 'authenticated' },
      ...overrides,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

const failure = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('HttpIdentityService', () => {
  describe('signing in', () => {
    it('asks the token endpoint for the password grant, with the publishable key and nothing else secret', async () => {
      const { service, seen } = setup(tokenResponse());

      await service.signIn('ana@example.com', 'S3cretoLargo123');

      expect(seen).toHaveLength(1);
      expect(seen[0]?.url).toBe('https://abc.supabase.co/auth/v1/token?grant_type=password');
      expect(seen[0]?.method).toBe('POST');
      expect(seen[0]?.headers.get('apikey')).toBe('sb_publishable_FALSA');
      expect(seen[0]?.headers.get('content-type')).toBe('application/json');
      expect(seen[0]?.body).toEqual({ email: 'ana@example.com', password: 'S3cretoLargo123' });
      expect(seen[0]?.headers.get('authorization')).toBeNull();
    });

    it('never lets the browser keep the answer or send cookies', async () => {
      const { service, seen } = setup(tokenResponse());

      await service.signIn('ana@example.com', 'x');

      expect(seen[0]?.init?.cache).toBe('no-store');
      expect(seen[0]?.init?.credentials).toBe('omit');
    });

    it('turns the answer into a session that expires `expires_in` seconds from now', async () => {
      const { service } = setup(tokenResponse({ expires_in: 1800 }));

      const session = await service.signIn('ana@example.com', 'x');

      expect(session).toEqual({
        accessToken: 'acceso',
        refreshToken: 'renovacion',
        expiresAt: new Date(NOW.getTime() + 1_800_000),
        user: { id: USER_ID, email: 'ana@example.com' },
      });
    });

    it('uses `expires_at` when the service gives no `expires_in`', async () => {
      const unix = Math.floor(NOW.getTime() / 1000) + 600;
      const { service } = setup(tokenResponse({ expires_in: undefined, expires_at: unix }));

      const session = await service.signIn('ana@example.com', 'x');

      expect(session.expiresAt).toEqual(new Date(unix * 1000));
    });

    it('does not believe an answer with an empty access token, or a person without an id', async () => {
      for (const odd of [{ access_token: '' }, { user: { id: '' } }, { user: { id: 3 } }]) {
        const { service } = setup(tokenResponse(odd));

        await expect(service.signIn('ana@example.com', 'x')).rejects.toMatchObject({
          kind: 'unknown',
        });
      }
    });

    it('treats an empty renewal token or an empty email as if the service had given none', async () => {
      const { service } = setup(
        tokenResponse({ refresh_token: '', user: { id: USER_ID, email: '' } }),
      );

      const session = await service.signIn('ana@example.com', 'x');

      expect(session.refreshToken).toBeNull();
      expect(session.user.email).toBeNull();
    });

    it('accepts a person without email and an answer without a renewal token', async () => {
      const { service } = setup(tokenResponse({ refresh_token: undefined, user: { id: USER_ID } }));

      const session = await service.signIn('ana@example.com', 'x');

      expect(session.refreshToken).toBeNull();
      expect(session.user).toEqual({ id: USER_ID, email: null });
    });

    it('says the credentials are wrong without repeating what was typed', async () => {
      const { service } = setup(
        failure(400, {
          code: 400,
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials',
        }),
      );

      const error = await service
        .signIn('ana@example.com', 'S3cretoLargo123')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).kind).toBe('invalid-credentials');
      expect(JSON.stringify(error)).not.toContain('S3cretoLargo123');
      expect((error as AuthError).message).not.toContain('S3cretoLargo123');
    });

    it.each([
      [429, { error_code: 'over_request_rate_limit' }, 'rate-limited'],
      [503, 'caido', 'unavailable'],
      [418, { error_code: 'nuevo' }, 'unknown'],
    ])('reads the %i answer as %s', async (status, body, kind) => {
      const { service } = setup(failure(status, body));

      await expect(service.signIn('a@b.co', 'x')).rejects.toMatchObject({ kind });
    });

    it('reads an error that is not JSON by its status alone', async () => {
      const { service } = setup(new Response('<html>Bad Gateway</html>', { status: 502 }));

      await expect(service.signIn('a@b.co', 'x')).rejects.toMatchObject({ kind: 'unavailable' });
    });

    it('calls the lack of an answer a network failure', async () => {
      const { service } = setup(new TypeError('Failed to fetch'));

      await expect(service.signIn('a@b.co', 'x')).rejects.toMatchObject({ kind: 'network' });
    });

    it.each([
      ['an answer that is not JSON', new Response('hola', { status: 200 })],
      ['a token without access_token', tokenResponse({ access_token: undefined })],
      ['a token that is not text', tokenResponse({ access_token: 5 })],
      ['a person without id', tokenResponse({ user: { email: 'a@b.co' } })],
      ['an answer without any expiry', tokenResponse({ expires_in: undefined })],
      ['an expiry that is not a number', tokenResponse({ expires_in: 'pronto' })],
      ['an expiry that is zero', tokenResponse({ expires_in: 0 })],
      ['a null body', new Response('null', { status: 200 })],
    ])('refuses %s as unknown, instead of inventing a session', async (_name, response) => {
      const { service } = setup(response);

      await expect(service.signIn('a@b.co', 'x')).rejects.toMatchObject({ kind: 'unknown' });
    });
  });

  describe('signing up', () => {
    it('posts to the signup endpoint and returns the session when the service gives one', async () => {
      const { service, seen } = setup(tokenResponse());

      const session = await service.signUp('ana@example.com', 'S3cretoLargo123');

      expect(seen[0]?.url).toBe('https://abc.supabase.co/auth/v1/signup');
      expect(seen[0]?.body).toEqual({ email: 'ana@example.com', password: 'S3cretoLargo123' });
      expect(session?.accessToken).toBe('acceso');
    });

    it('returns null when the service only created the person and wants the email confirmed', async () => {
      const { service } = setup(
        new Response(JSON.stringify({ id: USER_ID, email: 'ana@example.com' }), { status: 200 }),
      );

      await expect(service.signUp('ana@example.com', 'x')).resolves.toBeNull();
    });

    it.each([
      [422, { error_code: 'user_already_exists' }, 'email-taken'],
      [422, { error_code: 'weak_password' }, 'weak-password'],
      [422, { error_code: 'signup_disabled' }, 'signup-disabled'],
    ])('reads the %i answer as %s', async (status, body, kind) => {
      const { service } = setup(failure(status, body));

      await expect(service.signUp('a@b.co', 'x')).rejects.toMatchObject({ kind });
    });
  });

  describe('renewing', () => {
    it('trades the renewal token for a new session', async () => {
      const { service, seen } = setup(
        tokenResponse({ access_token: 'nuevo', refresh_token: 'otro' }),
      );

      const session = await service.refresh('renovacion');

      expect(seen[0]?.url).toBe('https://abc.supabase.co/auth/v1/token?grant_type=refresh_token');
      expect(seen[0]?.body).toEqual({ refresh_token: 'renovacion' });
      expect(session.accessToken).toBe('nuevo');
      expect(session.refreshToken).toBe('otro');
    });

    it('says what went wrong when the service refuses the renewal token', async () => {
      const { service } = setup(failure(400, { error_code: 'refresh_token_not_found' }));

      await expect(service.refresh('viejo')).rejects.toMatchObject({ kind: 'unknown' });
    });
  });

  describe('signing out', () => {
    it('tells the service with the access token of the session', async () => {
      const { service, seen } = setup(new Response(null, { status: 204 }));

      await service.signOut('acceso');

      expect(seen[0]?.url).toBe('https://abc.supabase.co/auth/v1/logout');
      expect(seen[0]?.method).toBe('POST');
      expect(seen[0]?.headers.get('authorization')).toBe('Bearer acceso');
      expect(seen[0]?.headers.get('apikey')).toBe('sb_publishable_FALSA');
    });

    it('fails with its class when the service does not answer or refuses', async () => {
      await expect(setup(new TypeError('offline')).service.signOut('a')).rejects.toMatchObject({
        kind: 'network',
      });
      await expect(
        setup(failure(401, { error_code: 'bad_jwt' })).service.signOut('a'),
      ).rejects.toMatchObject({
        kind: 'unknown',
      });
    });
  });

  it('gives up on a service that does not answer in time, as a network failure', async () => {
    const service = new HttpIdentityService({
      authUrl: 'https://abc.supabase.co/auth/v1',
      publishableKey: 'sb_publishable_FALSA',
      clock: { now: () => NOW },
      timeoutMs: 20,
      fetch: (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('timeout', 'TimeoutError')),
          );
        }),
    });

    await expect(service.signIn('a@b.co', 'x')).rejects.toMatchObject({ kind: 'network' });
  });

  it('builds the addresses the same with or without a trailing slash', async () => {
    const withSlash = setup(tokenResponse());
    await withSlash.service.signIn('a@b.co', 'x');
    const without = new HttpIdentityService({
      authUrl: 'https://abc.supabase.co/auth/v1',
      publishableKey: 'k',
      clock: { now: () => NOW },
      fetch: (input) => {
        expect(input).toBe('https://abc.supabase.co/auth/v1/token?grant_type=password');
        return Promise.resolve(tokenResponse());
      },
    });
    await without.signIn('a@b.co', 'x');

    expect(withSlash.seen[0]?.url).toBe(
      'https://abc.supabase.co/auth/v1/token?grant_type=password',
    );
  });
});
