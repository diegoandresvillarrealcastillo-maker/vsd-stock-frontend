import type { ExclusiveRunner } from '../../../domain/ports/out/exclusive-runner';

/** Lo poco que se usa de `navigator.locks`: se pasa de afuera para poder probar un navegador al que le falta. */
export interface LockManagerLike {
  request<T>(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: { name: string } | null) => Promise<T>,
  ): Promise<T>;
}

/**
 * Hace algo solo si ninguna otra pestaña lo esta haciendo, con los candados del navegador (Web Locks, ADR 0009): `ifAvailable`
 * no espera, asi que quien llega cuando otro ya envia simplemente no envia. En un navegador sin ellos, el mismo candado funciona
 * dentro de la pagina: una sola vez a la vez, aunque no pueda ver a las otras pestañas.
 */
export class WebLocksRunner implements ExclusiveRunner {
  private readonly held = new Set<string>();

  constructor(private readonly locks: LockManagerLike | undefined) {}

  async runIfFree<T>(
    name: string,
    work: () => Promise<T>,
  ): Promise<{ ran: true; value: T } | { ran: false }> {
    if (this.locks !== undefined) {
      return await this.locks.request(name, { ifAvailable: true }, async (lock) =>
        lock === null ? { ran: false as const } : { ran: true as const, value: await work() },
      );
    }
    if (this.held.has(name)) return { ran: false };
    this.held.add(name);
    try {
      return { ran: true, value: await work() };
    } finally {
      this.held.delete(name);
    }
  }
}
