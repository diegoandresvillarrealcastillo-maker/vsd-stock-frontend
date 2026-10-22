import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS,
  nombreDeArchivo,
  PERSONAJES,
} from '../../src/presentation/assets/mascotas/mascotas';

// El arte de las mascotas vive en un solo lugar (ADR 0033, punto 5; PLAN-CICLO-4, regla 4) y estas pruebas leen la carpeta
// tal como esta en el disco: que cada estado tenga su dibujo, que sea del tamano que el componente supone y que no pese lo
// que no debe. Si alguien cambia un dibujo por otro de 2 MB o se olvida de uno, falla aqui y no en la pantalla de alguien.
const CARPETA = join(import.meta.dirname, '..', '..', 'src', 'presentation', 'assets', 'mascotas');
const PARES = PERSONAJES.flatMap((personaje) =>
  ESTADOS.map((estado) => [personaje, estado] as const),
);

/** Ancho, alto y si usa transparencia, leidos de la cabecera del WebP (los tres formatos que existen). */
function leerWebp(bytes: Buffer): { ancho: number; alto: number; transparente: boolean } {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('no es un WebP');
  }
  const formato = bytes.toString('ascii', 12, 16);
  if (formato === 'VP8X') {
    return {
      ancho: 1 + bytes.readUIntLE(24, 3),
      alto: 1 + bytes.readUIntLE(27, 3),
      transparente: ((bytes[20] ?? 0) & 0x10) !== 0,
    };
  }
  if (formato === 'VP8L') {
    const cabecera = bytes.readUInt32LE(21);
    return {
      ancho: 1 + (cabecera & 0x3fff),
      alto: 1 + ((cabecera >> 14) & 0x3fff),
      transparente: ((cabecera >> 28) & 1) === 1,
    };
  }
  if (formato === 'VP8 ') {
    return {
      ancho: bytes.readUInt16LE(26) & 0x3fff,
      alto: bytes.readUInt16LE(28) & 0x3fff,
      transparente: false,
    };
  }
  throw new Error(`formato de WebP desconocido: ${formato}`);
}

describe('the mascot art on disk', () => {
  it('has one sprite for each of the 20 pairs of character and state, and nothing else', () => {
    const esperados = PARES.map(([personaje, estado]) => nombreDeArchivo(personaje, estado)).sort();

    const enDisco = readdirSync(CARPETA)
      .filter((archivo) => archivo.endsWith('.webp'))
      .sort();

    expect(enDisco).toEqual(esperados);
    expect(esperados).toHaveLength(20);
  });

  it('does not bring the sixth character of VSD Health: Trama stays there', () => {
    expect(readdirSync(CARPETA).filter((archivo) => /trama|telar/i.test(archivo))).toEqual([]);
  });

  it.each(PARES)(
    '%s, %s is a 256 by 256 WebP with a transparent background',
    (personaje, estado) => {
      const { ancho, alto, transparente } = leerWebp(
        readFileSync(join(CARPETA, nombreDeArchivo(personaje, estado))),
      );

      expect([ancho, alto]).toEqual([256, 256]);
      expect(transparente).toBe(true);
    },
  );

  it.each(PARES)('%s, %s weighs 30 KB or less', (personaje, estado) => {
    const peso = statSync(join(CARPETA, nombreDeArchivo(personaje, estado))).size;

    expect(peso).toBeLessThanOrEqual(30 * 1024);
  });

  it('weighs 400 KB or less all together, so that a page that shows them all stays light', () => {
    const total = PARES.reduce(
      (suma, [personaje, estado]) =>
        suma + statSync(join(CARPETA, nombreDeArchivo(personaje, estado))).size,
      0,
    );

    expect(total).toBeLessThanOrEqual(400 * 1024);
  });
});
