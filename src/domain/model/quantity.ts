import { MAX_PESOS } from './money';

/** La cantidad mas grande que acepta el servidor, en milesimas de la unidad (un millon de unidades). */
export const MAX_QUANTITY_MILLI = 1_000_000_000;

export type Parsed = { ok: true; value: number } | { ok: false; message: string };

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Pesos enteros como se leen en Colombia: `$ 3.200`. Un monto negativo lleva el signo antes del simbolo. */
export function formatPesos(amount: number): string {
  const text = `$ ${groupThousands(String(Math.abs(amount)))}`;
  return amount < 0 ? `-${text}` : text;
}

/** Una cantidad en milesimas como se escribe: `10`, `1,5`, `0,25`, `12.345,678`. La coma separa los decimales. */
export function formatQuantity(milli: number): string {
  const magnitude = Math.abs(milli);
  const whole = groupThousands(String(Math.floor(magnitude / 1000)));
  const fraction = String(magnitude % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  const text = fraction === '' ? whole : `${whole},${fraction}`;
  return milli < 0 ? `-${text}` : text;
}

/** Un movimiento de existencias con su signo: `+ 24` si suma, `− 2` si resta (con el signo menos de verdad, no un guion). */
export function formatSignedQuantity(milli: number): string {
  if (milli === 0) return '0';
  return milli > 0 ? `+ ${formatQuantity(milli)}` : `− ${formatQuantity(-milli)}`;
}

/** Una cantidad en milesimas escrita como la lee `parseQuantityMilli`: sin puntos de miles, con coma para los decimales. */
export function quantityToInput(milli: number): string {
  return formatQuantity(milli).replaceAll('.', '');
}

/**
 * Lee un precio escrito por una persona: solo digitos. Un punto o una coma es ambiguo (¿miles o centavos?), asi que no se
 * adivina: se pide escribirlo sin separadores. El dinero es siempre un entero de pesos (ADR 0014).
 */
export function parsePesos(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, message: 'Escribe el precio.' };
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      message: 'Escribe solo números, sin puntos, comas ni símbolos. Por ejemplo: 3200.',
    };
  }
  if (Number(trimmed) > MAX_PESOS) {
    return { ok: false, message: 'Ese precio es demasiado alto.' };
  }
  return { ok: true, value: Number(trimmed) };
}

/**
 * Lee una cantidad escrita por una persona y la devuelve en milesimas. La coma separa los decimales y no se aceptan puntos de
 * miles: «1.500» podria ser uno y medio o mil quinientos, y adivinar mal cambia el inventario. Con `whole`, solo unidades
 * enteras (lo que se cuenta de a uno).
 */
export function parseQuantityMilli(text: string, options: { whole: boolean }): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, message: 'Escribe la cantidad.' };
  if (/^[\d.]*\.[\d.]*$/.test(trimmed) && /\d/.test(trimmed)) {
    return {
      ok: false,
      message: 'Para los decimales usa coma y no escribas puntos de miles. Por ejemplo: 1,5.',
    };
  }
  const match = /^(\d+)(?:,(\d+))?$/.exec(trimmed);
  if (match === null) {
    return {
      ok: false,
      message: 'Escribe solo números, con coma para los decimales. Por ejemplo: 1,5.',
    };
  }
  const integer = match[1] ?? '';
  const decimals = match[2] ?? '';
  if (decimals.length > 3) return { ok: false, message: 'Se aceptan hasta tres decimales.' };
  const milli = Number(integer) * 1000 + Number(decimals.padEnd(3, '0'));
  if (milli > MAX_QUANTITY_MILLI) {
    return { ok: false, message: 'Esa cantidad es demasiado alta.' };
  }
  if (options.whole && milli % 1000 !== 0) {
    return { ok: false, message: 'Este producto se cuenta por unidades enteras.' };
  }
  return { ok: true, value: milli };
}
