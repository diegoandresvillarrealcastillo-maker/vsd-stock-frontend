import { toggleTheme, type ThemeMode } from '../../domain/model/theme';
import type { ThemePreference } from '../../domain/ports/in/theme-preference';
import type { SystemTheme } from '../../domain/ports/out/system-theme';
import type { ThemeApplier } from '../../domain/ports/out/theme-applier';
import type { ThemeStorage } from '../../domain/ports/out/theme-storage';

interface Dependencies {
  storage: ThemeStorage;
  system: SystemTheme;
  applier: ThemeApplier;
}

/**
 * Decide el tema de la interfaz. Arranca con lo que la persona eligio la ultima
 * vez y, si nunca eligio, con la preferencia de su sistema. Solo se guarda una
 * eleccion hecha a proposito: quien nunca toca el boton sigue al sistema.
 */
export class ThemePreferenceUseCase implements ThemePreference {
  private mode: ThemeMode;
  private readonly listeners = new Set<(mode: ThemeMode) => void>();

  constructor(private readonly deps: Dependencies) {
    this.mode = deps.storage.read() ?? (deps.system.prefersDark() ? 'dark' : 'light');
    deps.applier.apply(this.mode);
  }

  current(): ThemeMode {
    return this.mode;
  }

  toggle(): ThemeMode {
    this.mode = toggleTheme(this.mode);
    this.deps.storage.write(this.mode);
    this.deps.applier.apply(this.mode);
    for (const listener of this.listeners) listener(this.mode);
    return this.mode;
  }

  subscribe(listener: (mode: ThemeMode) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
