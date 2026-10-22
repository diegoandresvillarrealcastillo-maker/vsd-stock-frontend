import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnectionMonitor } from './create-connection-monitor';

// Prueba de integracion del cableado: el caso de uso y los tres adaptadores
// reales, con solo el navegador sustituido (fetch, navigator y los eventos).

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

function healthy(timestamp = '2026-10-16T15:30:00.000Z'): Response {
  return new Response(JSON.stringify({ status: 'ok', timestamp }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(fetch: Fetch, { onLine = true }: { onLine?: boolean } = {}) {
  const navigatorLike = { onLine };
  const events = new EventTarget();
  const monitor = createConnectionMonitor({
    apiBaseUrl: 'http://localhost:3000',
    fetch,
    navigator: navigatorLike,
    events,
  });
  return { monitor, navigatorLike, events };
}

describe('createConnectionMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is online once GET /health of the configured server answers', async () => {
    const requests: string[] = [];
    const { monitor } = setup((input) => {
      requests.push(input);
      return Promise.resolve(healthy());
    });

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(requests).toEqual(['http://localhost:3000/health']);
    expect(monitor.current()).toEqual({
      status: 'online',
      confirmedAt: new Date('2026-10-16T15:30:00.000Z'),
    });
    monitor.stop();
  });

  it('is offline when the server does not answer, even though the browser says it is online', async () => {
    const { monitor } = setup(() => Promise.reject(new TypeError('Failed to fetch')));

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(monitor.current().status).toBe('offline');
    monitor.stop();
  });

  it('follows the offline and online events of the browser', async () => {
    const requests: string[] = [];
    const { monitor, events } = setup((input) => {
      requests.push(input);
      return Promise.resolve(healthy());
    });
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    events.dispatchEvent(new Event('offline'));
    expect(monitor.current().status).toBe('offline');

    events.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(0);
    expect(monitor.current().status).toBe('online');
    expect(requests).toHaveLength(2);
    monitor.stop();
  });

  it('asks again 30 seconds after the server answered', async () => {
    let requests = 0;
    const { monitor } = setup(() => {
      requests += 1;
      return Promise.resolve(healthy());
    });
    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(requests).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toBe(2);
    monitor.stop();
  });

  it('does not ask the server while the browser says there is no connection', async () => {
    let requests = 0;
    const { monitor } = setup(
      () => {
        requests += 1;
        return Promise.resolve(healthy());
      },
      { onLine: false },
    );

    monitor.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(requests).toBe(0);
    expect(monitor.current().status).toBe('offline');
    monitor.stop();
  });
});
