import type { StorageProtection } from '../../domain/model/storage-protection';
import type { StorageProtectionStatus } from '../../domain/ports/in/storage-protection';
import type { PersistentStorage } from '../../domain/ports/out/persistent-storage';

/**
 * Pide que el navegador no borre lo guardado en el dispositivo (C3-07, ADR 0018 y 0030). Las ventas sin enviar viven ahi,
 * cifradas: si el navegador las borrara por falta de espacio, se perderian. El navegador decide si lo promete; este caso de
 * uso solo pregunta, lo pide y cuenta lo que respondio, para que la aplicacion lo diga con honestidad en vez de suponerlo.
 */
export class StorageProtectionUseCase implements StorageProtectionStatus {
  private state: StorageProtection = 'unknown';
  private readonly listeners = new Set<(state: StorageProtection) => void>();

  constructor(private readonly storage: PersistentStorage) {}

  current(): StorageProtection {
    return this.state;
  }

  subscribe(listener: (state: StorageProtection) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async ensure(): Promise<void> {
    if (!this.storage.isSupported()) {
      this.set('unsupported');
      return;
    }
    try {
      if (await this.storage.isPersisted()) {
        this.set('protected');
        return;
      }
      this.set((await this.storage.request()) ? 'protected' : 'not-protected');
    } catch {
      // Un navegador que falla al responder no prometio nada.
      this.set('not-protected');
    }
  }

  private set(next: StorageProtection): void {
    if (next === this.state) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener(next);
  }
}
