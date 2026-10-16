import type { SystemTheme } from '../../../domain/ports/out/system-theme';

type MatchMedia = (query: string) => { matches: boolean };

/** Lee la preferencia de color del sistema con `prefers-color-scheme`. */
export class MediaQuerySystemTheme implements SystemTheme {
  constructor(private readonly matchMedia: MatchMedia | undefined) {}

  prefersDark(): boolean {
    return this.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
