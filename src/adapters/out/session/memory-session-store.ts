import type { Session } from '../../../domain/model/session';
import type { SessionStore } from '../../../domain/ports/out/session-store';

/**
 * Guarda la sesion en una variable y nada mas (ADR 0018 y 0022): ni almacenamiento local, ni cookies, ni la base del
 * dispositivo. Recargar la pagina la pierde a proposito; es lo que evita dejar una credencial en el equipo de otra persona.
 */
export class MemorySessionStore implements SessionStore {
  private session: Session | null = null;
  private readonly listeners = new Set<() => void>();

  get(): Session | null {
    return this.session;
  }

  set(session: Session): void {
    this.session = session;
    this.notify();
  }

  clear(): void {
    if (this.session === null) return;
    this.session = null;
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    // Una copia: un oyente que se da de baja mientras se avisa no altera el recorrido.
    for (const listener of [...this.listeners]) listener();
  }
}
