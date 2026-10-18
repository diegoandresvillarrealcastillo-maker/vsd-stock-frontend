import { AppUpdatesUseCase } from '../../src/application/usecases/app-updates.usecase';
import { StorageProtectionUseCase } from '../../src/application/usecases/storage-protection.usecase';
import type { PersistentStorage } from '../../src/domain/ports/out/persistent-storage';
import { FakeAppShellHost } from './fake-app-shell-host';

/** La proteccion del almacenamiento de mentira: la prueba decide si el navegador la concede. */
export class FakePersistentStorage implements PersistentStorage {
  supported = true;
  persisted = false;
  grants = true;
  requests = 0;
  failure: Error | null = null;

  isSupported(): boolean {
    return this.supported;
  }

  isPersisted(): Promise<boolean> {
    return Promise.resolve(this.persisted);
  }

  request(): Promise<boolean> {
    this.requests += 1;
    if (this.failure !== null) return Promise.reject(this.failure);
    this.persisted = this.grants;
    return Promise.resolve(this.grants);
  }
}

/**
 * Lo que la interfaz recibe de `infrastructure/` para la aplicacion instalable: los dos casos de uso REALES, con el
 * service worker y el almacenamiento del navegador sustituidos por dobles que la prueba maneja a mano.
 */
export function createTestPwa() {
  const host = new FakeAppShellHost();
  const storage = new FakePersistentStorage();
  const updates = new AppUpdatesUseCase(host);
  const protection = new StorageProtectionUseCase(storage);
  return { host, storage, updates, protection, pwa: { updates, storage: protection } };
}
