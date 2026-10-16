import { isThemeMode, type ThemeMode } from '../../../domain/model/theme';
import type { ThemeStorage } from '../../../domain/ports/out/theme-storage';

/**
 * Clave con la que se guarda el tema. El script de index.html la lee ANTES de
 * que arranque React para pintar el tema correcto sin parpadeo; la prueba
 * test/design/theme-bootstrap.spec.ts comprueba que ambos usen la misma.
 */
export const THEME_STORAGE_KEY = 'vsd-stock-theme';

/** Recuerda el tema en el almacenamiento local del navegador. */
export class LocalStorageThemeStorage implements ThemeStorage {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  read(): ThemeMode | null {
    try {
      const value = this.storage.getItem(THEME_STORAGE_KEY);
      return isThemeMode(value) ? value : null;
    } catch {
      // Ventana privada o datos del sitio bloqueados: es como si no hubiera nada guardado.
      return null;
    }
  }

  write(mode: ThemeMode): void {
    try {
      this.storage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // No se pudo guardar: el tema cambia igual en esta visita.
    }
  }
}
