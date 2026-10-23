import type { MascotsStorage } from '../../../domain/ports/out/mascots-storage';
import { MASCOTS_STORAGE_KEY } from './mascots-storage-key';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Recuerda en el almacenamiento local del navegador si la persona apago las mascotas. Como el del tema, recibe una funcion
 * que devuelve el almacenamiento y no el almacenamiento mismo: con los datos del sitio bloqueados, algunos navegadores lanzan
 * un error al ACCEDER a window.localStorage, y ese acceso tiene que quedar dentro del try.
 */
export class LocalStorageMascotsStorage implements MascotsStorage {
  constructor(private readonly getStorage: () => BrowserStorage) {}

  read(): boolean | null {
    try {
      const value = this.getStorage().getItem(MASCOTS_STORAGE_KEY);
      if (value === 'on') return true;
      if (value === 'off') return false;
      return null;
    } catch {
      // Ventana privada o datos del sitio bloqueados: es como si no hubiera nada guardado.
      return null;
    }
  }

  write(enabled: boolean): void {
    try {
      this.getStorage().setItem(MASCOTS_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // No se pudo guardar: la eleccion vale igual en esta visita.
    }
  }
}
