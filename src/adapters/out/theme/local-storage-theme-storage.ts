import { isThemeMode, type ThemeMode } from '../../../domain/model/theme';
import type { ThemeStorage } from '../../../domain/ports/out/theme-storage';
import { THEME_STORAGE_KEY } from './theme-storage-key';

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
