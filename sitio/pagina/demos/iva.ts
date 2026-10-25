import { Money } from '../../../src/domain/model/money';
import { parsePesos } from '../../../src/domain/model/quantity';
import { splitTaxIncluded } from '../../../src/domain/model/tax';

// La cuenta de la calculadora de IVA de la landing (C4-L5), sin React. No hace ninguna cuenta propia: el precio lo lee `parsePesos`
// (solo digitos, igual que el campo del precio de la aplicacion) y la base y el IVA los separa `splitTaxIncluded`, la misma funcion
// que usa el producto (ADR 0014). Asi la pagina no puede decir un IVA distinto del que calcula el producto.

export type ResultadoIva =
  | {
      readonly ok: true;
      /** El precio, con el IVA incluido. */
      readonly total: number;
      readonly tarifaBp: number;
      readonly base: number;
      readonly iva: number;
      /** Base mas IVA, sumados aqui: es lo que la pagina muestra para que se vea que da el precio. Siempre igual a `total`. */
      readonly suma: number;
    }
  | { readonly ok: false; readonly mensaje: string };

/** Separa el IVA de un precio que lo incluye. `texto` es lo que la persona escribio; `tarifaBp`, una tarifa en puntos basicos (1 % = 100). */
export function calcularIva(texto: string, tarifaBp: number): ResultadoIva {
  const precio = parsePesos(texto);
  if (!precio.ok) return { ok: false, mensaje: precio.message };
  const total = Money.of(precio.value);
  const { base, tax } = splitTaxIncluded(total, tarifaBp);
  return {
    ok: true,
    total: total.amount,
    tarifaBp,
    base: base.amount,
    iva: tax.amount,
    suma: base.add(tax).amount,
  };
}
