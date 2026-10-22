import { MAX_PESOS } from './money';
import { formatPesos, type Parsed } from './quantity';

export type PaymentMethod = 'cash' | 'card' | 'transfer';

const LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

/** Las formas de pagar, en el orden en que se ofrecen: las mismas que acepta el servidor (ADR 0027). */
export const PAYMENT_METHODS: readonly {
  readonly method: PaymentMethod;
  readonly label: string;
}[] = (['cash', 'card', 'transfer'] as const).map((method) => ({ method, label: LABELS[method] }));

export function methodLabel(method: PaymentMethod): string {
  return LABELS[method];
}

/** Lo mas largo que acepta el servidor para la referencia de un cobro. */
export const MAX_REFERENCE_LENGTH = 100;

/** De cuanto en cuanto suben los billetes que se ofrecen: lo que se suele tener a mano en la caja. */
const BILL_STEPS: readonly number[] = [5_000, 10_000, 50_000, 100_000];

/** El vuelto: lo que se entrega de mas. Nunca es negativo: quien da de menos todavia no pago. */
export function changeOf(total: number, received: number): number {
  return Math.max(0, received - total);
}

/**
 * Los montos que se ofrecen para tocar en vez de escribir, ademas de «exacto»: el billete redondo mas cercano por encima del total
 * en cada escalon, sin repetir y hasta dos. Nunca es el total mismo.
 */
export function quickAmounts(total: number): number[] {
  const offered = new Set<number>();
  for (const step of BILL_STEPS) offered.add((Math.floor(total / step) + 1) * step);
  return [...offered].sort((a, b) => a - b).slice(0, 2);
}

/**
 * Lee el efectivo que entrega quien compra: solo digitos (un punto o una coma es ambiguo, ADR 0014) y, para poder cobrar, al menos
 * el total. Si falta, dice cuanto.
 */
export function parseReceived(text: string, total: number): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, message: 'Escribe el efectivo que te entregan.' };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: 'Escribe el efectivo en pesos, solo con números.' };
  }
  const value = Number(trimmed);
  if (value > MAX_PESOS) return { ok: false, message: 'Ese monto es demasiado alto.' };
  if (value < total) {
    return { ok: false, message: `Faltan ${formatPesos(total - value)} para completar el total.` };
  }
  return { ok: true, value };
}

/** Lee la referencia de un cobro con tarjeta o transferencia (los ultimos digitos, un numero de aprobacion): puede quedar vacia. */
export function parseReference(
  text: string,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > MAX_REFERENCE_LENGTH) {
    return {
      ok: false,
      message: `La referencia es muy larga: ${String(MAX_REFERENCE_LENGTH)} letras como máximo.`,
    };
  }
  return { ok: true, value: trimmed };
}
