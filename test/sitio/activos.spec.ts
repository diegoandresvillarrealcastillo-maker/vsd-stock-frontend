import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../../src/adapters/out/theme/theme-storage-key';
import { CLAVE_DEL_TEMA } from '../../sitio/pagina/claveDelTema';

// Lo que la landing comparte con la aplicacion sin poder importarlo (ADR 0033: la landing solo importa `src/domain` y las
// mascotas). Se copia, y esta prueba hace que la copia no pueda separarse de su origen sin que alguien lo note.
const RAIZ = join(import.meta.dirname, '..', '..');

describe('what the page shares with the app', () => {
  it('has the same logo, byte by byte, as the app', () => {
    const app = readFileSync(join(RAIZ, 'src', 'presentation', 'assets', 'logo-stock.webp'));
    const sitio = readFileSync(join(RAIZ, 'sitio', 'public', 'logo-stock.webp'));

    expect(sitio.equals(app)).toBe(true);
  });

  it('remembers the theme under the same key as the app, so what a person chose in one is seen in the other', () => {
    expect(CLAVE_DEL_TEMA).toBe(THEME_STORAGE_KEY);
  });
});
