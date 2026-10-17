import type { ConnectionState } from '../../domain/model/connection';
import type { ConnectionMonitor } from '../../domain/ports/in/connection-monitor';
import type { HealthApi } from '../../domain/ports/out/health-api';
import type { NetworkHints } from '../../domain/ports/out/network-hints';
import type { Scheduler } from '../../domain/ports/out/scheduler';

interface Dependencies {
  health: HealthApi;
  hints: NetworkHints;
  scheduler: Scheduler;
}

/** Cada cuanto se vuelve a preguntar al servidor mientras responde. */
const ONLINE_INTERVAL_MS = 30_000;

/**
 * Cada cuanto se reintenta tras un fallo: la primera vez pronto, y despues cada
 * vez mas despacio hasta el ultimo valor, que se mantiene. Asi una red mala no
 * se llena de peticiones y una que vuelve se nota en segundos.
 */
const RETRY_INTERVALS_MS = [5_000, 10_000, 20_000, 30_000] as const;

function retryDelayMs(failures: number): number {
  const index = Math.min(failures, RETRY_INTERVALS_MS.length) - 1;
  return RETRY_INTERVALS_MS[index] ?? ONLINE_INTERVAL_MS;
}

/**
 * Vigila si la aplicacion puede hablar con el servidor. La fuente de la verdad
 * es `GET /health`: lo que el navegador cree de la red (`NetworkHints`) solo
 * decide cuando preguntar. Si dice que no hay red, ni se pregunta; si dice que
 * la hay, se pregunta, y solo la respuesta del servidor deja el estado en linea.
 */
export class ConnectionMonitorUseCase implements ConnectionMonitor {
  private state: ConnectionState;
  private readonly listeners = new Set<(state: ConnectionState) => void>();
  private started = false;
  private failures = 0;
  // Cambia cada vez que lo que ya se pregunto deja de valer (el navegador avisa
  // que se perdio la red, o se detiene la vigilancia): la respuesta tardia de
  // una peticion vieja se descarta en vez de pisar un estado mas reciente.
  private epoch = 0;
  private inFlight: Promise<void> | null = null;
  private cancelTimer: (() => void) | null = null;
  private stopListening: (() => void) | null = null;

  constructor(private readonly deps: Dependencies) {
    this.state = { status: deps.hints.isOnline() ? 'checking' : 'offline', confirmedAt: null };
  }

  current(): ConnectionState {
    return this.state;
  }

  subscribe(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopListening = this.deps.hints.subscribe((online) => {
      this.onHint(online);
    });
    void this.probe();
  }

  stop(): void {
    this.started = false;
    this.invalidatePending();
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.stopListening?.();
    this.stopListening = null;
  }

  retry(): Promise<void> {
    // Solo se muestra "comprobando" si la persona estaba sin conexion y hay
    // algo que comprobar: en linea, un parpadeo no le diria nada.
    if (this.state.status === 'offline' && this.deps.hints.isOnline()) {
      this.set({ status: 'checking', confirmedAt: this.state.confirmedAt });
    }
    return this.probe();
  }

  private onHint(online: boolean): void {
    if (!this.started) return;
    if (online) {
      void this.probe();
      return;
    }
    // Se perdio la red: lo que se estaba preguntando ya no vale. Se sigue
    // comprobando de todos modos, porque la pista puede equivocarse.
    this.invalidatePending();
    this.failures += 1;
    this.set({ status: 'offline', confirmedAt: this.state.confirmedAt });
    this.scheduleNext(retryDelayMs(this.failures));
  }

  private probe(): Promise<void> {
    if (this.inFlight !== null) return this.inFlight;

    if (!this.deps.hints.isOnline()) {
      this.failures += 1;
      this.set({ status: 'offline', confirmedAt: this.state.confirmedAt });
      this.scheduleNext(retryDelayMs(this.failures));
      return Promise.resolve();
    }

    const epoch = this.epoch;
    const request: Promise<void> = this.deps.health.fetchHealth().then(
      (report) => {
        if (epoch !== this.epoch) return;
        this.failures = 0;
        this.set({ status: 'online', confirmedAt: report.reportedAt });
        this.scheduleNext(ONLINE_INTERVAL_MS);
      },
      () => {
        if (epoch !== this.epoch) return;
        this.failures += 1;
        this.set({ status: 'offline', confirmedAt: this.state.confirmedAt });
        this.scheduleNext(retryDelayMs(this.failures));
      },
    );
    this.inFlight = request;
    void request.finally(() => {
      if (this.inFlight === request) this.inFlight = null;
    });
    return request;
  }

  private invalidatePending(): void {
    this.epoch += 1;
    this.inFlight = null;
  }

  private scheduleNext(delayMs: number): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    if (!this.started) return;
    this.cancelTimer = this.deps.scheduler.schedule(() => {
      this.cancelTimer = null;
      void this.probe();
    }, delayMs);
  }

  private set(next: ConnectionState): void {
    const sameTime = this.state.confirmedAt?.getTime() === next.confirmedAt?.getTime();
    if (this.state.status === next.status && sameTime) return;
    this.state = next;
    for (const listener of this.listeners) listener(next);
  }
}
