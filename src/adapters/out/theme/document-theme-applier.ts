import type { ThemeMode } from '../../../domain/model/theme';
import type { ThemeApplier } from '../../../domain/ports/out/theme-applier';

/** Marca el elemento raiz con `data-theme`, que es lo que leen los tokens de color del CSS. */
export class DocumentThemeApplier implements ThemeApplier {
  constructor(private readonly root: HTMLElement) {}

  apply(mode: ThemeMode): void {
    this.root.dataset['theme'] = mode;
  }
}
