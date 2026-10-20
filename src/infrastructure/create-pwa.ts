import { BrowserAppShellHost } from '../adapters/out/pwa/browser-app-shell-host';
import type { ServiceWorkerContainerLike } from '../adapters/out/pwa/browser-app-shell-host';
import { BrowserPersistentStorage } from '../adapters/out/storage/browser-persistent-storage';
import type { StorageManagerLike } from '../adapters/out/storage/browser-persistent-storage';
import { AppUpdatesUseCase } from '../application/usecases/app-updates.usecase';
import { StorageProtectionUseCase } from '../application/usecases/storage-protection.usecase';
import type { AppUpdates } from '../domain/ports/in/app-updates';
import type { StorageProtectionStatus } from '../domain/ports/in/storage-protection';

interface Environment {
  /** `true` en la aplicacion compilada y desplegada; `false` en el servidor de desarrollo. */
  production: boolean;
  navigator: { serviceWorker?: ServiceWorkerContainerLike; storage?: StorageManagerLike };
  /** El documento: avisa cuando la persona vuelve a la aplicacion. */
  document: EventTarget & { readonly visibilityState: string };
  reload: () => void;
}

/** Donde la compilacion deja el service worker (`scripts/build-service-worker.ts`). */
const SERVICE_WORKER_URL = '/sw.js';

/**
 * Arma la aplicacion instalable con los adaptadores del navegador (C3-07, ADR 0030): las versiones nuevas y la proteccion
 * del almacenamiento. En el servidor de desarrollo NO se instala el service worker: una interfaz guardada taparia los
 * cambios que se estan haciendo. Recibe el entorno para poder probarse sin un navegador.
 */
export function createPwa(env: Environment): {
  updates: AppUpdates;
  storage: StorageProtectionStatus;
} {
  return {
    updates: new AppUpdatesUseCase(
      new BrowserAppShellHost({
        container: env.production ? env.navigator.serviceWorker : undefined,
        scriptUrl: SERVICE_WORKER_URL,
        reload: env.reload,
        visibility: env.document,
      }),
    ),
    storage: new StorageProtectionUseCase(new BrowserPersistentStorage(env.navigator.storage)),
  };
}
