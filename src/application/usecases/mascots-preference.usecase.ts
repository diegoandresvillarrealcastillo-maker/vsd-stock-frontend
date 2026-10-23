import type { MascotsPreference } from '../../domain/ports/in/mascots-preference';
import type { MascotsStorage } from '../../domain/ports/out/mascots-storage';

interface Dependencies {
  storage: MascotsStorage;
}

/**
 * Decide si las mascotas se ven (C4-M3). Arrancan encendidas y solo se recuerda una eleccion hecha a proposito: quien nunca
 * toca el boton las sigue viendo, y si algun dia cambia lo que significa el valor por omision, no hay nada viejo guardado
 * que lo contradiga.
 */
export class MascotsPreferenceUseCase implements MascotsPreference {
  private value: boolean;
  private readonly listeners = new Set<(enabled: boolean) => void>();

  constructor(private readonly deps: Dependencies) {
    this.value = deps.storage.read() ?? true;
  }

  enabled(): boolean {
    return this.value;
  }

  toggle(): boolean {
    this.value = !this.value;
    this.deps.storage.write(this.value);
    for (const listener of this.listeners) listener(this.value);
    return this.value;
  }

  subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
