import { describe, expect, it } from 'vitest';
import type { ConnectionState } from '../../domain/model/connection';
import type { HealthReport } from '../../domain/model/health-report';
import type { HealthApi } from '../../domain/ports/out/health-api';
import type { NetworkHints } from '../../domain/ports/out/network-hints';
import type { Scheduler } from '../../domain/ports/out/scheduler';
import { ConnectionMonitorUseCase } from './connection-monitor.usecase';

// Dobles en memoria de los tres puertos de salida. El tiempo y la red se
// controlan a mano: nada espera de verdad.

class FakeHealthApi implements HealthApi {
  requests = 0;
  private readonly pending: {
    resolve: (report: HealthReport) => void;
    reject: (error: Error) => void;
  }[] = [];

  fetchHealth(): Promise<HealthReport> {
    this.requests += 1;
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject });
    });
  }

  /** Responde a la peticion mas antigua que sigue abierta. */
  async succeed(reportedAt = new Date('2026-10-16T15:30:00.000Z')): Promise<void> {
    this.next().resolve({ reportedAt });
    await settle();
  }

  async fail(): Promise<void> {
    this.next().reject(new Error('sin respuesta'));
    await settle();
  }

  private next() {
    const request = this.pending.shift();
    if (request === undefined) throw new Error('No hay ninguna peticion abierta');
    return request;
  }
}

class FakeNetworkHints implements NetworkHints {
  private readonly listeners = new Set<(online: boolean) => void>();

  constructor(private online: boolean) {}

  isOnline(): boolean {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** El navegador avisa de que cambio la conexion. */
  emit(online: boolean): void {
    this.online = online;
    for (const listener of [...this.listeners]) listener(online);
  }

  get subscribers(): number {
    return this.listeners.size;
  }
}

class FakeScheduler implements Scheduler {
  private task: { callback: () => void; delayMs: number } | null = null;

  schedule(callback: () => void, delayMs: number): () => void {
    const task = { callback, delayMs };
    this.task = task;
    return () => {
      if (this.task === task) this.task = null;
    };
  }

  /** Cuanto falta para la proxima comprobacion, o `null` si no hay ninguna. */
  get nextDelayMs(): number | null {
    return this.task?.delayMs ?? null;
  }

  /** Deja pasar el tiempo hasta que se cumpla la comprobacion pendiente. */
  async fire(): Promise<void> {
    const task = this.task;
    if (task === null) throw new Error('No hay ninguna comprobacion programada');
    this.task = null;
    task.callback();
    await settle();
  }
}

/** Deja que se resuelvan las promesas pendientes. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setup({ online = true }: { online?: boolean } = {}) {
  const health = new FakeHealthApi();
  const hints = new FakeNetworkHints(online);
  const scheduler = new FakeScheduler();
  const monitor = new ConnectionMonitorUseCase({ health, hints, scheduler });
  const seen: ConnectionState[] = [];
  monitor.subscribe((state) => seen.push(state));
  return { monitor, health, hints, scheduler, seen };
}

const SERVER_TIME = new Date('2026-10-16T15:30:00.000Z');

describe('ConnectionMonitorUseCase: the first answer', () => {
  it('is checking while the first answer has not come, if the browser says there is a connection', () => {
    const { monitor } = setup({ online: true });

    expect(monitor.current()).toEqual({ status: 'checking', confirmedAt: null });
  });

  it('is offline from the start, without asking the server, if the browser says there is no connection', () => {
    const { monitor, health } = setup({ online: false });
    monitor.start();

    expect(monitor.current()).toEqual({ status: 'offline', confirmedAt: null });
    expect(health.requests).toBe(0);
  });

  it('is online, with the time the server reported, once /health answers', async () => {
    const { monitor, health } = setup();
    monitor.start();

    await health.succeed(SERVER_TIME);

    expect(monitor.current()).toEqual({ status: 'online', confirmedAt: SERVER_TIME });
  });

  it('is offline when the browser says online but /health does not answer', async () => {
    const { monitor, health } = setup({ online: true });
    monitor.start();

    await health.fail();

    expect(monitor.current()).toEqual({ status: 'offline', confirmedAt: null });
  });

  it('asks the server only once when started twice', () => {
    const { monitor, health } = setup();
    monitor.start();
    monitor.start();

    expect(health.requests).toBe(1);
  });
});

describe('ConnectionMonitorUseCase: checking again', () => {
  it('checks again 30 seconds after an answer and keeps the screen online while it asks', async () => {
    const { monitor, health, scheduler } = setup();
    monitor.start();
    await health.succeed();
    expect(scheduler.nextDelayMs).toBe(30_000);

    await scheduler.fire();
    expect(health.requests).toBe(2);
    expect(monitor.current().status).toBe('online');

    const later = new Date('2026-10-16T15:30:30.000Z');
    await health.succeed(later);
    expect(monitor.current()).toEqual({ status: 'online', confirmedAt: later });
  });

  it('waits longer after each failure: 5, 10, 20 and then 30 seconds at most', async () => {
    const { monitor, health, scheduler } = setup();
    monitor.start();
    const delays: (number | null)[] = [];

    await health.fail();
    delays.push(scheduler.nextDelayMs);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await scheduler.fire();
      await health.fail();
      delays.push(scheduler.nextDelayMs);
    }

    expect(delays).toEqual([5_000, 10_000, 20_000, 30_000, 30_000]);
  });

  it('goes back to the normal pace once the server answers again, and starts over after the next failure', async () => {
    const { monitor, health, scheduler } = setup();
    monitor.start();
    await health.fail();
    await scheduler.fire();
    await health.fail();
    expect(scheduler.nextDelayMs).toBe(10_000);

    await scheduler.fire();
    await health.succeed(SERVER_TIME);
    expect(monitor.current().status).toBe('online');
    expect(scheduler.nextDelayMs).toBe(30_000);

    await scheduler.fire();
    await health.fail();
    expect(scheduler.nextDelayMs).toBe(5_000);
  });

  it('remembers the last time the server answered while it is offline', async () => {
    const { monitor, health, scheduler } = setup();
    monitor.start();
    await health.succeed(SERVER_TIME);

    await scheduler.fire();
    await health.fail();

    expect(monitor.current()).toEqual({ status: 'offline', confirmedAt: SERVER_TIME });
  });
});

describe('ConnectionMonitorUseCase: what the browser reports', () => {
  it('goes offline at once, without asking the server, when the browser reports it lost the connection', async () => {
    const { monitor, health, hints } = setup();
    monitor.start();
    await health.succeed(SERVER_TIME);

    hints.emit(false);

    expect(monitor.current()).toEqual({ status: 'offline', confirmedAt: SERVER_TIME });
    expect(health.requests).toBe(1);
  });

  it('keeps checking after the browser reports no connection, because that hint can be wrong', async () => {
    const { monitor, health, hints, scheduler } = setup();
    monitor.start();
    await health.succeed();
    hints.emit(false);
    expect(scheduler.nextDelayMs).toBe(5_000);

    hints.emit(true);
    await health.succeed(new Date('2026-10-16T15:31:00.000Z'));

    expect(monitor.current().status).toBe('online');
  });

  it('does not call the server while the browser says there is no connection, and keeps the retry going', async () => {
    const { monitor, health, hints, scheduler } = setup();
    monitor.start();
    await health.succeed();
    hints.emit(false);

    await scheduler.fire();

    expect(health.requests).toBe(1);
    expect(monitor.current().status).toBe('offline');
    expect(scheduler.nextDelayMs).toBe(10_000);
  });

  it('asks the server as soon as the browser reports the connection is back', async () => {
    const { monitor, health, hints } = setup({ online: false });
    monitor.start();
    expect(monitor.current().status).toBe('offline');

    hints.emit(true);
    expect(health.requests).toBe(1);
    await health.succeed(SERVER_TIME);

    expect(monitor.current()).toEqual({ status: 'online', confirmedAt: SERVER_TIME });
  });

  it('does not trust "online" by itself: the server still has to answer', async () => {
    const { monitor, health, hints } = setup({ online: false });
    monitor.start();

    hints.emit(true);
    await health.fail();

    expect(monitor.current().status).toBe('offline');
  });

  it('ignores an answer that arrives after the browser reported the connection was lost', async () => {
    const { monitor, health, hints } = setup();
    monitor.start();

    hints.emit(false);
    await health.succeed(SERVER_TIME);

    expect(monitor.current()).toEqual({ status: 'offline', confirmedAt: null });
  });

  it('asks again when the connection comes back even if an older request is still open', async () => {
    const { monitor, health, hints } = setup();
    monitor.start();
    hints.emit(false);

    hints.emit(true);
    expect(health.requests).toBe(2);
    await health.succeed(new Date('2026-10-16T15:29:00.000Z'));
    await health.succeed(SERVER_TIME);

    expect(monitor.current()).toEqual({ status: 'online', confirmedAt: SERVER_TIME });
  });
});

describe('ConnectionMonitorUseCase: retry', () => {
  it('shows checking while the person retries from offline, then the result', async () => {
    const { monitor, health } = setup();
    monitor.start();
    await health.fail();

    const retrying = monitor.retry();
    expect(monitor.current().status).toBe('checking');

    await health.succeed(SERVER_TIME);
    await retrying;
    expect(monitor.current()).toEqual({ status: 'online', confirmedAt: SERVER_TIME });
  });

  it('goes back to offline when the retry fails too', async () => {
    const { monitor, health } = setup();
    monitor.start();
    await health.fail();

    const retrying = monitor.retry();
    await health.fail();
    await retrying;

    expect(monitor.current().status).toBe('offline');
  });

  it('does not flash checking when the retry happens while online', async () => {
    const { monitor, health, seen } = setup();
    monitor.start();
    await health.succeed();
    seen.length = 0;

    const retrying = monitor.retry();
    expect(monitor.current().status).toBe('online');
    await health.succeed(new Date('2026-10-16T15:31:00.000Z'));
    await retrying;

    expect(seen.map((state) => state.status)).toEqual(['online']);
  });

  it('shares one request between a retry and a check that is already open', async () => {
    const { monitor, health } = setup();
    monitor.start();

    const retrying = monitor.retry();
    await health.succeed();
    await retrying;

    expect(health.requests).toBe(1);
  });

  it('does not ask the server when the browser says there is no connection', async () => {
    const { monitor, health } = setup({ online: false });
    monitor.start();

    await monitor.retry();

    expect(health.requests).toBe(0);
    expect(monitor.current().status).toBe('offline');
  });
});

describe('ConnectionMonitorUseCase: listeners', () => {
  it('tells the listeners every change of state, in order', async () => {
    const { monitor, health, seen } = setup();
    monitor.start();

    await health.succeed(SERVER_TIME);

    expect(seen).toEqual([{ status: 'online', confirmedAt: SERVER_TIME }]);
  });

  it('does not tell anyone when nothing changed', async () => {
    const { monitor, health, scheduler, seen } = setup();
    monitor.start();
    await health.fail();
    seen.length = 0;

    await scheduler.fire();
    await health.fail();

    expect(seen).toEqual([]);
  });

  it('gives the very same object while nothing changes, so React does not redraw', async () => {
    const { monitor, health } = setup();
    monitor.start();
    await health.succeed(SERVER_TIME);

    expect(monitor.current()).toBe(monitor.current());
  });

  it('stops telling a listener that unsubscribed', async () => {
    const { monitor, health } = setup();
    const heard: ConnectionState[] = [];
    const unsubscribe = monitor.subscribe((state) => heard.push(state));
    monitor.start();
    unsubscribe();

    await health.succeed();

    expect(heard).toEqual([]);
  });
});

describe('ConnectionMonitorUseCase: stop', () => {
  it('cancels the next check and stops listening to the browser', async () => {
    const { monitor, health, hints, scheduler } = setup();
    monitor.start();
    await health.succeed();

    monitor.stop();

    expect(scheduler.nextDelayMs).toBeNull();
    expect(hints.subscribers).toBe(0);
  });

  it('leaves no listener of the browser behind even if it was started twice', () => {
    const { monitor, hints } = setup();
    monitor.start();
    monitor.start();

    monitor.stop();

    expect(hints.subscribers).toBe(0);
  });

  it('ignores an answer that arrives after stopping, and schedules nothing', async () => {
    const { monitor, health, scheduler } = setup();
    monitor.start();

    monitor.stop();
    await health.succeed(SERVER_TIME);

    expect(monitor.current().status).toBe('checking');
    expect(scheduler.nextDelayMs).toBeNull();
  });

  it('can start again after stopping', async () => {
    const { monitor, health } = setup();
    monitor.start();
    monitor.stop();

    monitor.start();
    await health.succeed(); // la peticion que quedo abierta al detener
    await health.succeed(SERVER_TIME);

    expect(monitor.current()).toEqual({ status: 'online', confirmedAt: SERVER_TIME });
  });
});
