import { isThemeMode, toggleTheme, type ThemeMode } from '../../src/domain/model/theme';
import { CLAVE_DEL_TEMA } from './claveDelTema';

/** El tema que tiene pintada la pagina. El script de `index.html` lo pone antes del primer pintado. */
export function temaActual(raiz: HTMLElement): ThemeMode {
  const tema = raiz.dataset['theme'];
  return isThemeMode(tema) ? tema : 'light';
}

/** El almacenamiento del navegador, o `null` si no lo deja usar (algunos navegadores lanzan al tocarlo). */
export function almacenDelNavegador(): Pick<Storage, 'setItem'> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Pinta el otro tema y lo recuerda. Sin almacenamiento el tema cambia igual; solo no se recuerda. */
export function alternarTema(
  raiz: HTMLElement,
  almacen: Pick<Storage, 'setItem'> | null,
): ThemeMode {
  const nuevo = toggleTheme(temaActual(raiz));
  raiz.dataset['theme'] = nuevo;
  try {
    almacen?.setItem(CLAVE_DEL_TEMA, nuevo);
  } catch {
    // Sin permiso para guardar: el tema ya cambio, solo no se recordara en la proxima visita.
  }
  return nuevo;
}
