import type { AppUpdateState } from '../../domain/model/app-update';
import type { AppUpdates } from '../../domain/ports/in/app-updates';
import type { AppShellHost } from '../../domain/ports/out/app-shell-host';

/**
 * Las versiones nuevas de la aplicacion (C3-07, ADR 0030). El servicio de la interfaz descarga la version nueva en segundo
 * plano y AVISA; este caso de uso nunca la activa por su cuenta. Activarla recarga la pagina, y recargar a mitad de una
 * venta seria perder lo que la persona esta haciendo: por eso solo se activa cuando la persona lo pide y ninguna pantalla
 * pidio esperar (`hold`).
 */
export class AppUpdatesUseCase implements AppUpdates {
  private state: AppUpdateState = { status: 'idle', held: false };
  private readonly listeners = new Set<(state: AppUpdateState) => void>();
  private holds = 0;
  private started = false;
  private stopListening: (() => void) | null = null;
  // Cambia en cada `start` y `stop`: la respuesta tardia de un registro viejo no pisa lo que vino despues.
  private epoch = 0;

  constructor(private readonly host: AppShellHost) {}

  current(): AppUpdateState {
    return this.state;
  }

  subscribe(listener: (state: AppUpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.epoch += 1;
    const epoch = this.epoch;
    void this.host.register().then((result) => {
      if (epoch !== this.epoch) return;
      if (result === 'unsupported') {
        this.set({ status: 'unsupported' });
        return;
      }
      this.stopListening = this.host.onUpdateReady(() => {
        if (this.state.status === 'idle') this.set({ status: 'ready' });
      });
      void this.host.checkForUpdate();
    });
  }

  stop(): void {
    this.started = false;
    this.epoch += 1;
    this.stopListening?.();
    this.stopListening = null;
  }

  apply(): boolean {
    if (this.state.status !== 'ready' || this.holds > 0) return false;
    this.set({ status: 'applying' });
    this.host.activateUpdate();
    return true;
  }

  hold(): () => void {
    this.holds += 1;
    this.set({ held: true });
    let released = false;
    return () => {
      // Soltar dos veces no suelta lo que pidio otra pantalla.
      if (released) return;
      released = true;
      this.holds -= 1;
      this.set({ held: this.holds > 0 });
    };
  }

  private set(change: Partial<AppUpdateState>): void {
    const next = { ...this.state, ...change };
    if (next.status === this.state.status && next.held === this.state.held) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener(next);
  }
}
