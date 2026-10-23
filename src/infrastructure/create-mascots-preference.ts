import { MascotsPreferenceUseCase } from '../application/usecases/mascots-preference.usecase';
import { LocalStorageMascotsStorage } from '../adapters/out/mascots/local-storage-mascots-storage';
import type { MascotsPreference } from '../domain/ports/in/mascots-preference';

interface Environment {
  /** Devuelve el almacenamiento local; puede lanzar un error si el navegador lo bloquea. */
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
}

/**
 * Arma la preferencia de mascotas con el adaptador del navegador (C4-M3). Es parte del cableado de `infrastructure/`
 * (ADR 0002), y recibe el entorno para poder probarse con el almacenamiento de jsdom.
 */
export function createMascotsPreference(env: Environment): MascotsPreference {
  return new MascotsPreferenceUseCase({ storage: new LocalStorageMascotsStorage(env.getStorage) });
}
