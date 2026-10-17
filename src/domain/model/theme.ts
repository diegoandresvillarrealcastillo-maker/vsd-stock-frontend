/** Tema visual de la interfaz. Son los dos que existen: no hay un tercer modo "sistema". */
export type ThemeMode = 'light' | 'dark';

/**
 * Dice si un valor desconocido es un tema. Sirve para lo que viene de afuera
 * (lo guardado en el navegador puede estar viejo o alterado) antes de usarlo.
 */
export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark';
}

/** El tema contrario: lo que hace el boton de tema al presionarlo. */
export function toggleTheme(mode: ThemeMode): ThemeMode {
  return mode === 'light' ? 'dark' : 'light';
}
