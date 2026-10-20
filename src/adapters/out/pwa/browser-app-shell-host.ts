import type { AppShellHost } from '../../../domain/ports/out/app-shell-host';

/** Lo poco que se usa de un service worker: su estado y poder hablarle. Estructural, para probarlo sin un navegador. */
export interface WorkerLike extends EventTarget {
  readonly state: string;
  postMessage(message: unknown): void;
}

export interface ServiceWorkerRegistrationLike extends EventTarget {
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  update(): Promise<unknown>;
}

export interface ServiceWorkerContainerLike extends EventTarget {
  /** La version que controla esta pagina ahora, o `null` si ninguna (la primera vez que se instala). */
  readonly controller: unknown;
  register(url: string, options?: { scope?: string }): Promise<ServiceWorkerRegistrationLike>;
}

interface Environment {
  /** `navigator.serviceWorker`, o `undefined` si el navegador no lo tiene. */
  container: ServiceWorkerContainerLike | undefined;
  /** Donde esta el service worker que escribe la compilacion. */
  scriptUrl: string;
  reload: () => void;
  /** El documento: avisa cuando la persona vuelve a la aplicacion. */
  visibility: (EventTarget & { readonly visibilityState: string }) | undefined;
}

/**
 * El service worker del navegador como servicio de la interfaz (C3-07, ADR 0030). Lo que hace aqui es solo de enlace: registra
 * el archivo, se entera de que una version nueva termino de instalarse, le pide a la que espera que tome el control cuando la
 * persona lo decide y recarga la pagina cuando eso ocurre. Quien decide cuando, y si se puede, es el caso de uso.
 */
export class BrowserAppShellHost implements AppShellHost {
  private registration: ServiceWorkerRegistrationLike | null = null;
  private readonly listeners = new Set<() => void>();
  private updateWaiting = false;
  private applying = false;

  constructor(private readonly env: Environment) {}

  async register(): Promise<'registered' | 'unsupported'> {
    const { container } = this.env;
    if (container === undefined) return 'unsupported';
    let registration: ServiceWorkerRegistrationLike;
    try {
      registration = await container.register(this.env.scriptUrl, { scope: '/' });
    } catch {
      // Un navegador que no deja instalarlo (modo privado, politica del equipo) sigue sirviendo la aplicacion en linea.
      return 'unsupported';
    }
    this.registration = registration;

    // Ya habia una version esperando de una visita anterior.
    if (registration.waiting !== null && container.controller !== null) this.announce();

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (worker === null) return;
      worker.addEventListener('statechange', () => {
        // Sin version anterior no hay nada que actualizar: es la primera instalacion.
        if (worker.state === 'installed' && container.controller !== null) this.announce();
      });
    });

    container.addEventListener('controllerchange', () => {
      // Solo recarga cuando la persona pidio actualizar: la primera instalacion tambien toma el control de la pagina.
      if (!this.applying) return;
      this.applying = false;
      this.env.reload();
    });

    this.env.visibility?.addEventListener('visibilitychange', () => {
      if (this.env.visibility?.visibilityState === 'visible') void this.checkForUpdate();
    });
    return 'registered';
  }

  onUpdateReady(listener: () => void): () => void {
    this.listeners.add(listener);
    if (this.updateWaiting) listener();
    return () => {
      this.listeners.delete(listener);
    };
  }

  activateUpdate(): void {
    const waiting = this.registration?.waiting ?? null;
    if (waiting === null) return;
    this.applying = true;
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  async checkForUpdate(): Promise<void> {
    try {
      await this.registration?.update();
    } catch {
      // Sin conexion no hay nada nuevo que encontrar; se vuelve a preguntar la proxima vez.
    }
  }

  private announce(): void {
    this.updateWaiting = true;
    for (const listener of [...this.listeners]) listener();
  }
}
