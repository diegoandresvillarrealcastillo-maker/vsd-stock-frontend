import type { ThemeMode } from '../../model/theme';

/** Hace visible el tema en la pagina. */
export interface ThemeApplier {
  apply(mode: ThemeMode): void;
}
