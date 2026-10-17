import { ThemePreferenceUseCase } from '../application/usecases/theme-preference.usecase';
import { DocumentThemeApplier } from '../adapters/out/theme/document-theme-applier';
import { LocalStorageThemeStorage } from '../adapters/out/theme/local-storage-theme-storage';
import { MediaQuerySystemTheme } from '../adapters/out/theme/media-query-system-theme';
import type { ThemePreference } from '../domain/ports/in/theme-preference';

interface Environment {
  /** Devuelve el almacenamiento local; puede lanzar un error si el navegador lo bloquea. */
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>;
  matchMedia: ((query: string) => { matches: boolean }) | undefined;
  /** El elemento raiz del documento, donde se marca el tema. */
  root: HTMLElement;
}

/**
 * Arma la preferencia de tema con los adaptadores del navegador. Es parte del
 * cableado de `infrastructure/` (ADR 0002): aqui, y solo aqui, el caso de uso
 * conoce las APIs concretas que lo respaldan. Recibe el entorno para poder
 * probarse con el DOM de jsdom.
 */
export function createThemePreference(env: Environment): ThemePreference {
  return new ThemePreferenceUseCase({
    storage: new LocalStorageThemeStorage(env.getStorage),
    system: new MediaQuerySystemTheme(env.matchMedia),
    applier: new DocumentThemeApplier(env.root),
  });
}
