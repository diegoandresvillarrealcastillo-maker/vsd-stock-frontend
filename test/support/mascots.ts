import { MascotsPreferenceUseCase } from '../../src/application/usecases/mascots-preference.usecase';

interface Options {
  /** Lo que la persona eligio la ultima vez, o `null` si nunca eligio (las mascotas se ven). */
  saved?: boolean | null;
}

/**
 * Arma el caso de uso REAL de la preferencia de mascotas con un doble en memoria de su unico puerto de salida: las pruebas
 * de la interfaz no simulan el caso de uso, solo lo que hay detras (el navegador).
 */
export function createTestMascotsPreference({ saved = null }: Options = {}) {
  let stored = saved;
  const preference = new MascotsPreferenceUseCase({
    storage: {
      read: () => stored,
      write: (enabled) => {
        stored = enabled;
      },
    },
  });
  return { preference, savedValue: () => stored };
}
