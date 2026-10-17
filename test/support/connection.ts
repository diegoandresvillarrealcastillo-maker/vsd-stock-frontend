import { ConnectionMonitorUseCase } from '../../src/application/usecases/connection-monitor.usecase';
import type { HealthReport } from '../../src/domain/model/health-report';
import type { HealthApi } from '../../src/domain/ports/out/health-api';
import type { NetworkHints } from '../../src/domain/ports/out/network-hints';
import type { Scheduler } from '../../src/domain/ports/out/scheduler';

// Dobles en memoria de los tres puertos de salida de la vigilancia de conexion.
// El tiempo y la red se controlan a mano: nada espera de verdad. Los usan las
// pruebas del caso de uso y las de la interfaz, que montan el caso de uso REAL
// y solo sustituyen lo que hay detras (el servidor, el navegador y el reloj).

/** Deja que se resuelvan las promesas pendientes. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export class FakeHealthApi implements HealthApi {
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

export class FakeNetworkHints implements NetworkHints {
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

export class FakeScheduler implements Scheduler {
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

/**
 * Arma el caso de uso REAL de la vigilancia de conexion con dobles en memoria de
 * sus puertos de salida. `online` es lo que el navegador cree de la red.
 */
export function createTestConnection({ online = true }: { online?: boolean } = {}) {
  const health = new FakeHealthApi();
  const hints = new FakeNetworkHints(online);
  const scheduler = new FakeScheduler();
  const monitor = new ConnectionMonitorUseCase({ health, hints, scheduler });
  return { monitor, health, hints, scheduler };
}
