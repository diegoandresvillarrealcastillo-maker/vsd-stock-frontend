import { ThemePreferenceUseCase } from '../../src/application/usecases/theme-preference.usecase';
import type { ThemeMode } from '../../src/domain/model/theme';
import type { ThemeApplier } from '../../src/domain/ports/out/theme-applier';

interface Options {
  /** Lo que la persona eligio la ultima vez, o `null` si nunca eligio. */
  saved?: ThemeMode | null;
  /** Lo que prefiere el sistema. */
  systemDark?: boolean;
  /** Quien aplica el tema. Por omision, uno que solo lo anota en `applied`. */
  applier?: ThemeApplier;
}

/**
 * Arma el caso de uso REAL de la preferencia de tema con dobles en memoria de
 * sus puertos de salida: las pruebas de la interfaz no simulan el caso de uso,
 * solo lo que hay detras (el navegador).
 */
export function createTestThemePreference({
  saved = null,
  systemDark = false,
  applier,
}: Options = {}) {
  const applied: ThemeMode[] = [];
  let stored = saved;
  const preference = new ThemePreferenceUseCase({
    storage: {
      read: () => stored,
      write: (mode) => {
        stored = mode;
      },
    },
    system: { prefersDark: () => systemDark },
    applier: applier ?? { apply: (mode) => applied.push(mode) },
  });
  return { preference, applied, savedMode: () => stored };
}
