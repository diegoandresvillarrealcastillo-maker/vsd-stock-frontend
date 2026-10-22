import type { PersonPointer } from '../../../domain/ports/out/person-pointer';

/** Con que clave se recuerda a quien trabajo por ultima vez en este dispositivo. */
export const PERSON_POINTER_KEY = 'vsd-stock-person';

/** Un identificador de persona: letras, numeros y guiones. Lo demas no es lo que se guardo, y no se le cree. */
const PERSON_ID = /^[0-9a-zA-Z-]{8,64}$/;

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Recuerda en el almacenamiento local del navegador quien trabajo por ultima vez. Es solo un identificador (el que da nombre a
 * su base): nada personal ni secreto. Recibe una funcion que devuelve el almacenamiento porque con los datos del sitio
 * bloqueados algunos navegadores lanzan un error al ACCEDER a `window.localStorage`.
 */
export class LocalStoragePersonPointer implements PersonPointer {
  constructor(private readonly getStorage: () => BrowserStorage) {}

  get(): string | null {
    try {
      const value = this.getStorage().getItem(PERSON_POINTER_KEY);
      return value !== null && PERSON_ID.test(value) ? value : null;
    } catch {
      // Ventana privada o datos del sitio bloqueados: es como si no hubiera nadie.
      return null;
    }
  }

  set(authUserId: string): void {
    try {
      this.getStorage().setItem(PERSON_POINTER_KEY, authUserId);
    } catch {
      // No se pudo recordar: la base de la persona esta ahi, pero la aplicacion no ofrecera «continuar como...».
    }
  }

  clear(): void {
    try {
      this.getStorage().removeItem(PERSON_POINTER_KEY);
    } catch {
      // Nada que quitar si no se pudo guardar.
    }
  }
}
