import type { IdGenerator } from '../../../domain/ports/out/id-generator';

type FillRandom = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

const HEX = '0123456789abcdef';

function hex(bytes: Uint8Array, from: number, to: number): string {
  let text = '';
  for (let index = from; index < to; index += 1) {
    const byte = bytes[index] ?? 0;
    text += `${HEX[byte >> 4] ?? ''}${HEX[byte & 15] ?? ''}`;
  }
  return text;
}

/**
 * Identificadores UUID versiones 4 hechos con la fuente de azar del navegador. No usa `crypto.randomUUID()` a proposito: solo
 * existe en contextos seguros (HTTPS o localhost), y abrir la aplicacion por la red local para probarla en un telefono no lo es;
 * `getRandomValues` sirve en los dos.
 */
export class RandomIdGenerator implements IdGenerator {
  constructor(private readonly fill: FillRandom) {}

  newId(): string {
    const bytes = this.fill(new Uint8Array(16));
    // Version 4 (azar) y variante RFC 4122: es lo que dice el 4 del tercer grupo y el 8, 9, a o b del cuarto.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    return [
      hex(bytes, 0, 4),
      hex(bytes, 4, 6),
      hex(bytes, 6, 8),
      hex(bytes, 8, 10),
      hex(bytes, 10, 16),
    ].join('-');
  }
}
