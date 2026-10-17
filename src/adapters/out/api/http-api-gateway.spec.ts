// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../domain/model/api-error';
import type { SessionManager } from '../../../domain/ports/in/session-manager';
import { HttpApiGateway } from './http-api-gateway';

const NOW_MS = Date.parse('2026-10-17T12:00:00.000Z');

interface Seen {
  url: string;
  init: RequestInit | undefined;
  headers: Headers;
  body: unknown;
}

function sessionsWith(token: string | null): SessionManager {
  return {
    current: () => null,
    subscribe: () => () => undefined,
    signIn: () => Promise.reject(new Error('no se usa')),
    signUp: () => Promise.reject(new Error('no se usa')),
    signOut: () => Promise.resolve(),
    accessToken: () => Promise.resolve(token),
  };
}

function setup(
  answer: Response | Error | ((seen: Seen) => Response | Error),
  options: { token?: string | null; baseUrl?: string; timeoutMs?: number } = {},
) {
  const seen: Seen[] = [];
  const gateway = new HttpApiGateway({
    baseUrl: options.baseUrl ?? 'https://api.example.com',
    sessions: sessionsWith(options.token === undefined ? 'acceso' : options.token),
    now: () => NOW_MS,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    fetch: (input, init) => {
      const record: Seen = {
        url: input,
        init,
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      seen.push(record);
      const result = typeof answer === 'function' ? answer(record) : answer;
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result.clone());
    },
  });
  return { gateway, seen };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const problem = (status: number, code: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      type: `urn:vsd-stock:problem:${code}`,
      title: 'Titulo',
      status,
      detail: 'Detalle',
      instance: '/v1/x',
      code,
      traceId: 'traza-123',
      ...extra,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

describe('HttpApiGateway', () => {
  describe('the request', () => {
    it('goes to the API with the access token of the session', async () => {
      const { gateway, seen } = setup(json(200, { ok: true }));

      await gateway.send({ method: 'GET', path: '/v1/me' });

      expect(seen[0]?.url).toBe('https://api.example.com/v1/me');
      expect(seen[0]?.init?.method).toBe('GET');
      expect(seen[0]?.headers.get('authorization')).toBe('Bearer acceso');
      expect(seen[0]?.headers.get('accept')).toBe('application/json');
    });

    it('never lets the browser keep the answer or send cookies', async () => {
      const { gateway, seen } = setup(json(200, {}));

      await gateway.send({ method: 'GET', path: '/v1/me' });

      expect(seen[0]?.init?.cache).toBe('no-store');
      expect(seen[0]?.init?.credentials).toBe('omit');
    });

    it('sends the body as JSON, and says so, only when there is one', async () => {
      const { gateway, seen } = setup(json(201, {}));

      await gateway.send({ method: 'POST', path: '/v1/products', body: { name: 'Arroz' } });
      await gateway.send({ method: 'GET', path: '/v1/products' });

      expect(seen[0]?.body).toEqual({ name: 'Arroz' });
      expect(seen[0]?.headers.get('content-type')).toBe('application/json');
      expect(seen[1]?.body).toBeUndefined();
      expect(seen[1]?.headers.get('content-type')).toBeNull();
    });

    it('writes the query string with what is given, encoded, and leaves out what is undefined', async () => {
      const { gateway, seen } = setup(json(200, {}));

      await gateway.send({
        method: 'GET',
        path: '/v1/products',
        query: { search: 'leche & café', limit: 20, active: true, categoryId: undefined },
      });

      expect(seen[0]?.url).toBe(
        'https://api.example.com/v1/products?search=leche+%26+caf%C3%A9&limit=20&active=true',
      );
    });

    it('writes no question mark when no parameter is left', async () => {
      const { gateway, seen } = setup(json(200, {}));

      await gateway.send({ method: 'GET', path: '/v1/products', query: { search: undefined } });

      expect(seen[0]?.url).toBe('https://api.example.com/v1/products');
    });

    it('works against the same origin, with no base address', async () => {
      const { gateway, seen } = setup(json(200, {}), { baseUrl: '' });

      await gateway.send({ method: 'GET', path: '/v1/me' });

      expect(seen[0]?.url).toBe('/v1/me');
    });

    it('ignores a trailing slash in the base address', async () => {
      const { gateway, seen } = setup(json(200, {}), { baseUrl: 'https://api.example.com/' });

      await gateway.send({ method: 'GET', path: '/v1/me' });

      expect(seen[0]?.url).toBe('https://api.example.com/v1/me');
    });

    it.each([
      'v1/me',
      '//evil.example.com/steal',
      'https://evil.example.com/v1/me',
      '/v1/../x',
      '/v1/x/https://evil.example.com',
      '',
    ])('refuses the path %j, so the token can never be sent anywhere else', async (path) => {
      const { gateway, seen } = setup(json(200, {}));

      await expect(gateway.send({ method: 'GET', path })).rejects.toThrow(RangeError);
      expect(seen).toEqual([]);
    });

    it('does not even send the request without a session, and says it is a session problem', async () => {
      const { gateway, seen } = setup(json(200, {}), { token: null });

      const error = await gateway.send({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).failure).toEqual({
        class: 'session',
        status: null,
        problem: null,
        retryAfterMs: null,
      });
      expect(seen).toEqual([]);
    });
  });

  describe('a good answer', () => {
    it('hands back the status and the body already read', async () => {
      const { gateway } = setup(json(201, { id: 'p1' }));

      const response = await gateway.send<{ id: string }>({
        method: 'POST',
        path: '/v1/products',
        body: {},
      });

      expect(response).toEqual({ status: 201, body: { id: 'p1' }, replayed: false });
    });

    it('says when the server repeated the answer of an operation it had already applied', async () => {
      const { gateway } = setup(json(200, { id: 'p1' }, { 'Idempotent-Replayed': 'true' }));

      const response = await gateway.send({ method: 'POST', path: '/v1/purchases', body: {} });

      expect(response.replayed).toBe(true);
    });

    it('hands back an empty body for a 204', async () => {
      const { gateway } = setup(new Response(null, { status: 204 }));

      const response = await gateway.send({ method: 'DELETE', path: '/v1/categories/x' });

      expect(response).toEqual({ status: 204, body: undefined, replayed: false });
    });

    it('hands back an empty body for a 200 with nothing in it, instead of failing to read it', async () => {
      const { gateway } = setup(new Response('', { status: 200 }));

      const response = await gateway.send({ method: 'POST', path: '/v1/x' });

      expect(response).toEqual({ status: 200, body: undefined, replayed: false });
    });

    it('does not trust an answer that is not JSON: a hosting fallback page is not our API', async () => {
      const { gateway } = setup(new Response('<html>hola</html>', { status: 200 }));

      const error = await gateway.send({ method: 'GET', path: '/v1/me' }).catch((e: unknown) => e);

      expect((error as ApiError).failure).toMatchObject({
        class: 'transient',
        status: 200,
        problem: null,
      });
    });
  });

  describe('a failure', () => {
    it('carries the problem of the contract and the class of the status', async () => {
      const { gateway } = setup(problem(409, 'sku-taken'));

      const error = await gateway
        .send({ method: 'POST', path: '/v1/products', body: {} })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ApiError);
      const failure = (error as ApiError).failure;
      expect(failure.class).toBe('conflict');
      expect(failure.status).toBe(409);
      expect(failure.problem).toMatchObject({ code: 'sku-taken', traceId: 'traza-123' });
      expect((error as ApiError).code).toBe('sku-taken');
    });

    it.each([
      [401, 'unauthenticated', 'session'],
      [403, 'forbidden', 'permanent'],
      [404, 'product-not-found', 'permanent'],
      [409, 'sku-taken', 'conflict'],
      [429, 'rate-limited', 'transient'],
      [503, 'service-unavailable', 'transient'],
    ])('classes the status %i (%s) as %s', async (status, code, expected) => {
      const { gateway } = setup(problem(status, code));

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure.class).toBe(expected);
    });

    it('carries the fields that failed validation, each with its pointer', async () => {
      const { gateway } = setup(
        problem(400, 'validation-failed', {
          errors: [
            { pointer: '/name', code: 'blank', detail: 'El nombre no puede estar en blanco.' },
          ],
        }),
      );

      const error = await gateway
        .send({ method: 'POST', path: '/v1/products', body: {} })
        .catch((e: unknown) => e);

      expect((error as ApiError).failure.problem?.errors).toEqual([
        { pointer: '/name', code: 'blank', detail: 'El nombre no puede estar en blanco.' },
      ]);
    });

    it('reads Retry-After, in seconds, as milliseconds', async () => {
      const { gateway } = setup(
        new Response(null, { status: 503, headers: { 'Retry-After': '5' } }),
      );

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure).toMatchObject({ class: 'transient', retryAfterMs: 5000 });
    });

    it('reads Retry-After given as a date, from the clock it was given', async () => {
      const { gateway } = setup(
        new Response(null, {
          status: 429,
          headers: { 'Retry-After': new Date(NOW_MS + 7000).toUTCString() },
        }),
      );

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure.retryAfterMs).toBe(7000);
    });

    it('keeps the class but no problem when the body is not the contract: a proxy page', async () => {
      const { gateway } = setup(new Response('<html>Bad Gateway</html>', { status: 502 }));

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure).toEqual({
        class: 'transient',
        status: 502,
        problem: null,
        retryAfterMs: null,
      });
    });

    it('does not take JSON that is not a problem for one', async () => {
      const { gateway } = setup(json(500, { mensaje: 'algo' }));

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure.problem).toBeNull();
    });

    it('does not take a redirect that was not followed for an error of the person', async () => {
      const { gateway } = setup(
        new Response(null, { status: 302, headers: { Location: '/otra' } }),
      );

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure).toMatchObject({
        class: 'transient',
        status: 302,
        problem: null,
      });
    });

    it('calls the lack of an answer a network failure', async () => {
      const { gateway } = setup(new TypeError('Failed to fetch'));

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure).toEqual({
        class: 'network',
        status: null,
        problem: null,
        retryAfterMs: null,
      });
    });

    it('gives up on a server that does not answer in time, as a network failure', async () => {
      const gateway = new HttpApiGateway({
        baseUrl: 'https://api.example.com',
        sessions: sessionsWith('acceso'),
        timeoutMs: 20,
        now: () => NOW_MS,
        fetch: (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('timeout', 'TimeoutError')),
            );
          }),
      });

      const error = await gateway.send({ method: 'GET', path: '/v1/x' }).catch((e: unknown) => e);

      expect((error as ApiError).failure.class).toBe('network');
    });
  });
});
