import type { ThemeMode } from '../../model/theme';

/** Donde se recuerda el tema que la persona eligio, entre una visita y la siguiente. */
export interface ThemeStorage {
  /** El tema guardado, o `null` si la persona nunca eligio o no se puede leer. */
  read(): ThemeMode | null;
  /** Guarda la eleccion. Si no se puede guardar, no falla: el tema cambia igual en esta visita. */
  write(mode: ThemeMode): void;
}
