import type { Random } from '../../../domain/ports/out/random';

/**
 * El azar del navegador. Sirve para repartir las esperas de muchos dispositivos que vuelven a la vez, no para nada que deba ser
 * secreto: por eso `Math.random()` y no la fuente criptografica.
 */
export class MathRandom implements Random {
  next(): number {
    return Math.random();
  }
}
