import { isThemeMode, type ThemeMode } from '../../../domain/model/theme';
import type { ThemeStorage } from '../../../domain/ports/out/theme-storage';
import { THEME_STORAGE_KEY } from './theme-storage-key';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Recuerda el tema en el almacenamiento local del navegador. Recibe una funcion
 * que lo devuelve y no el almacenamiento mismo: con los datos del sitio
 * bloqueados, algunos navegadores lanzan un error al ACCEDER a
 * window.localStorage, y ese acceso tiene que quedar dentro del try.
 */
export class LocalStorageThemeStorage implements ThemeStorage {
  constructor(private readonly getStorage: () => BrowserStorage) {}

  read(): ThemeMode | null {
    try {
      const value = this.getStorage().getItem(THEME_STORAGE_KEY);
      return isThemeMode(value) ? value : null;
    } catch {
      // Ventana privada o datos del sitio bloqueados: es como si no hubiera nada guardado.
      return null;
    }
  }

  write(mode: ThemeMode): void {
    try {
      this.getStorage().setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // No se pudo guardar: el tema cambia igual en esta visita.
    }
  }
}
