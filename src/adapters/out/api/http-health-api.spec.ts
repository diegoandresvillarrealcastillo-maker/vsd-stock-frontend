import { describe, expect, it } from 'vitest';
import { HttpHealthApi } from './http-health-api';

const BASE_URL = 'http://localhost:3000';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

/** Un fetch que responde siempre lo mismo y apunta lo que se le pidio. */
function recording(answer: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch: Fetch = (input, init) => {
    calls.push({ url: input, init });
    return Promise.resolve(answer());
  };
  return { fetch, calls };
}

const OK = { status: 'ok', timestamp: '2026-10-16T15:30:00.000Z' };

describe('HttpHealthApi: the request', () => {
  it('asks GET /health of the configured server', async () => {
    const { fetch, calls } = recording(() => json(OK));

    await new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://localhost:3000/health');
    expect(calls[0]?.init?.method).toBe('GET');
  });

  it.each([
    ['without a trailing slash', 'https://api.example.com', 'https://api.example.com/health'],
    ['with a trailing slash', 'https://api.example.com/', 'https://api.example.com/health'],
    [
      'with several trailing slashes',
      'https://api.example.com//',
      'https://api.example.com/health',
    ],
    ['empty, for a server on the same origin', '', '/health'],
  ])('builds the address when the base is %s', async (_label, baseUrl, expected) => {
    const { fetch, calls } = recording(() => json(OK));

    await new HttpHealthApi({ baseUrl, fetch }).fetchHealth();

    expect(calls[0]?.url).toBe(expected);
  });

  it('never accepts an answer from a cache: a cached /health would claim a connection that is gone', async () => {
    const { fetch, calls } = recording(() => json(OK));

    await new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth();

    expect(calls[0]?.init?.cache).toBe('no-store');
  });

  it('asks for JSON and sends no credentials', async () => {
    const { fetch, calls } = recording(() => json(OK));

    await new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth();

    expect(new Headers(calls[0]?.init?.headers).get('accept')).toBe('application/json');
    expect(calls[0]?.init?.credentials).toBe('omit');
  });

  it('attaches a signal so a slow server can be given up on', async () => {
    const { fetch, calls } = recording(() => json(OK));

    await new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth();

    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('HttpHealthApi: a good answer', () => {
  it('reports the time the server gave', async () => {
    const { fetch } = recording(() => json(OK));

    const report = await new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth();

    expect(report.reportedAt).toEqual(new Date('2026-10-16T15:30:00.000Z'));
  });

  it('ignores fields the contract does not mention, so the server can grow', async () => {
    const { fetch } = recording(() => json({ ...OK, version: '0.2.0' }));

    const report = await new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth();

    expect(report.reportedAt).toEqual(new Date(OK.timestamp));
  });
});

describe('HttpHealthApi: what is not a connection', () => {
  const api = (answer: () => Response | Promise<Response>) =>
    new HttpHealthApi({ baseUrl: BASE_URL, fetch: recording(answer).fetch });

  it.each([404, 500, 502, 503])('rejects an HTTP %i and says which one', async (status) => {
    await expect(api(() => json({ message: 'nope' }, { status })).fetchHealth()).rejects.toThrow(
      new RegExp(String(status)),
    );
  });

  it('rejects when the request cannot even be made (no network, CORS, DNS)', async () => {
    const fetch: Fetch = () => Promise.reject(new TypeError('Failed to fetch'));

    await expect(new HttpHealthApi({ baseUrl: BASE_URL, fetch }).fetchHealth()).rejects.toThrow(
      'Failed to fetch',
    );
  });

  it('rejects a 200 that is not JSON, such as the page a host serves when the API is not there', async () => {
    const html = () => new Response('<!doctype html><title>VSD Stock</title>', { status: 200 });

    await expect(api(html).fetchHealth()).rejects.toThrow('GET /health no respondió JSON');
  });

  it.each([
    ['an empty object', {}],
    ['a status other than ok', { status: 'error', timestamp: OK.timestamp }],
    ['a missing timestamp', { status: 'ok' }],
    ['a timestamp that is not text', { status: 'ok', timestamp: 1_760_628_600_000 }],
    ['a timestamp that is not a date', { status: 'ok', timestamp: 'ayer' }],
    ['a list', [OK]],
    ['null', null],
    ['a plain string', 'ok'],
  ])('rejects a 200 whose body is %s', async (_label, body) => {
    await expect(api(() => json(body)).fetchHealth()).rejects.toThrow(/\/health/);
  });

  it('gives up when the server takes longer than the timeout', async () => {
    const hanging: Fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(init.signal?.reason as Error);
        });
      });
    const slow = new HttpHealthApi({ baseUrl: BASE_URL, fetch: hanging, timeoutMs: 20 });

    await expect(slow.fetchHealth()).rejects.toBeDefined();
  });
});
