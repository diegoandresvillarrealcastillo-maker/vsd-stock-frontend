import type { PersistentStorage } from '../../../domain/ports/out/persistent-storage';

/** Lo poco que se usa de `navigator.storage`. Cada metodo es opcional: los navegadores viejos no los tienen todos. */
export interface StorageManagerLike {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

/** La proteccion del almacenamiento del navegador (`navigator.storage.persist`) como puerto (C3-07, ADR 0018). */
export class BrowserPersistentStorage implements PersistentStorage {
  constructor(private readonly manager: StorageManagerLike | undefined) {}

  isSupported(): boolean {
    return (
      typeof this.manager?.persisted === 'function' && typeof this.manager.persist === 'function'
    );
  }

  async isPersisted(): Promise<boolean> {
    return this.manager?.persisted?.() ?? false;
  }

  async request(): Promise<boolean> {
    return this.manager?.persist?.() ?? false;
  }
}
