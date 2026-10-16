import type { ThemeMode } from '../../model/theme';

/** Lo que la interfaz puede hacer con el tema: verlo, cambiarlo y enterarse de los cambios. */
export interface ThemePreference {
  current(): ThemeMode;
  /** Cambia al otro tema, lo recuerda y lo aplica. Devuelve el tema nuevo. */
  toggle(): ThemeMode;
  /** Avisa cada vez que el tema cambia. Devuelve la funcion para dejar de escuchar. */
  subscribe(listener: (mode: ThemeMode) => void): () => void;
}
