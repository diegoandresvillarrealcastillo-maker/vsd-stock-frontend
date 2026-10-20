import type { AppShellHost } from '../../src/domain/ports/out/app-shell-host';

/** El servicio de la interfaz de mentira: anota lo que se le pide y deja a la prueba avisar de una version nueva. */
export class FakeAppShellHost implements AppShellHost {
  registerResult: 'registered' | 'unsupported' = 'registered';
  registered = 0;
  activations = 0;
  checks = 0;
  private readonly listeners = new Set<() => void>();

  register(): Promise<'registered' | 'unsupported'> {
    this.registered += 1;
    return Promise.resolve(this.registerResult);
  }

  onUpdateReady(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  activateUpdate(): void {
    this.activations += 1;
  }

  checkForUpdate(): Promise<void> {
    this.checks += 1;
    return Promise.resolve();
  }

  /** El navegador avisa que una version nueva ya se descargo. */
  emitUpdateReady(): void {
    for (const listener of [...this.listeners]) listener();
  }

  get listening(): number {
    return this.listeners.size;
  }
}
