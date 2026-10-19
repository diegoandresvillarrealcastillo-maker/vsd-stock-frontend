import { MAX_PESOS } from './money';
import { formatPesos, type Parsed } from './quantity';

/**
 * El turno de caja tal como lo conoce el dispositivo (C3-11, ADR 0026). Se abre y se cierra sin conexion: lo que la persona
 * hizo queda aqui y, aparte, en la cola de operaciones que el servidor recibira. Los totales de las ventas son los de ESTE
 * dispositivo; el arqueo definitivo lo calcula el servidor cuando recibe todo.
 */

/** Lo vendido en el turno desde este dispositivo: el efectivo cuenta para el arqueo, lo demas no. */
export interface ShiftSales {
  readonly cashCount: number;
  readonly cashAmount: number;
  readonly otherCount: number;
  readonly otherAmount: number;
}

export const NO_SALES: ShiftSales = { cashCount: 0, cashAmount: 0, otherCount: 0, otherAmount: 0 };

/**
 * Suma una venta a lo vendido en el turno: en efectivo si se cobro en efectivo (lo que entra a la caja, sin el vuelto) y aparte si
 * fue con tarjeta o transferencia. No cambia lo que recibe.
 */
export function recordSale(
  sales: ShiftSales,
  method: 'cash' | 'card' | 'transfer',
  amount: number,
): ShiftSales {
  return method === 'cash'
    ? { ...sales, cashCount: sales.cashCount + 1, cashAmount: sales.cashAmount + amount }
    : { ...sales, otherCount: sales.otherCount + 1, otherAmount: sales.otherAmount + amount };
}

/** El cierre: lo que la persona conto en la caja y cuando lo hizo (la hora del dispositivo). */
export interface ShiftClosing {
  /** La operacion de cierre en la cola, para saber si el servidor ya la tiene. */
  readonly operationId: string;
  readonly closedAt: string;
  readonly countedAmount: number;
}

export interface LocalShift {
  /** Lo crea el dispositivo al abrir: es el identificador del turno en el servidor. */
  readonly shiftId: string;
  readonly deviceId: string;
  /** La operacion de apertura en la cola, para saber si el servidor ya la tiene. */
  readonly openOperationId: string;
  /** ISO 8601 UTC: la hora del dispositivo al abrir. */
  readonly openedAt: string;
  readonly openingAmount: number;
  readonly sales: ShiftSales;
  /** `null` mientras el turno sigue abierto. */
  readonly closing: ShiftClosing | null;
}

/** El arqueo del dispositivo: lo que debe haber en la caja frente a lo que se conto. */
export interface ShiftSummary {
  readonly openingAmount: number;
  readonly cashCount: number;
  readonly cashAmount: number;
  readonly otherCount: number;
  readonly otherAmount: number;
  /** El efectivo que debe haber: el inicial mas lo cobrado en efectivo. */
  readonly expectedAmount: number;
  /** `null` mientras el turno sigue abierto. */
  readonly countedAmount: number | null;
  /** Contado menos esperado: negativo es que falta, positivo que sobra; `null` mientras el turno sigue abierto. */
  readonly difference: number | null;
}

export function summarizeShift(shift: LocalShift): ShiftSummary {
  const expectedAmount = shift.openingAmount + shift.sales.cashAmount;
  const countedAmount = shift.closing?.countedAmount ?? null;
  return {
    openingAmount: shift.openingAmount,
    cashCount: shift.sales.cashCount,
    cashAmount: shift.sales.cashAmount,
    otherCount: shift.sales.otherCount,
    otherAmount: shift.sales.otherAmount,
    expectedAmount,
    countedAmount,
    difference: countedAmount === null ? null : countedAmount - expectedAmount,
  };
}

/** Lo que se dice de una diferencia de caja: cuadra, falta o sobra. */
export interface DifferenceNote {
  readonly kind: 'balanced' | 'short' | 'over';
  readonly title: string;
}

export function describeDifference(difference: number): DifferenceNote {
  if (difference === 0) return { kind: 'balanced', title: 'La caja cuadra' };
  if (difference < 0) return { kind: 'short', title: `Faltan ${formatPesos(-difference)}` };
  return { kind: 'over', title: `Sobran ${formatPesos(difference)}` };
}

/** Una diferencia de caja con su signo: `− $ 2.000` si falta, `+ $ 1.500` si sobra y `$ 0` si cuadra (con el signo menos de verdad). */
export function formatDifference(difference: number): string {
  if (difference === 0) return formatPesos(0);
  return difference < 0 ? `− ${formatPesos(-difference)}` : `+ ${formatPesos(difference)}`;
}

/**
 * Lee el efectivo que una persona escribio: solo digitos, porque un punto o una coma es ambiguo (¿miles o centavos?) y adivinar
 * mal descuadra la caja. Cero vale: una caja vacia es un monto, no un olvido.
 */
export function parseCash(text: string): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') {
    return {
      ok: false,
      message: 'Escribe el efectivo que hay en la caja. Si está vacía, escribe 0.',
    };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: 'Escribe el efectivo en pesos, solo con números.' };
  }
  if (Number(trimmed) > MAX_PESOS) return { ok: false, message: 'Ese monto es demasiado alto.' };
  return { ok: true, value: Number(trimmed) };
}

/** El cuerpo de abrir un turno: EXACTAMENTE el de `POST /v1/shifts` (ADR 0028). */
export function openingBody(input: {
  readonly operationId: string;
  readonly shiftId: string;
  readonly deviceId: string;
  readonly openingAmount: number;
  readonly at: Date;
  readonly clockOffsetMs: number | null;
}): Record<string, unknown> {
  return {
    operationId: input.operationId,
    shiftId: input.shiftId,
    deviceId: input.deviceId,
    openingAmount: input.openingAmount,
    deviceTime: input.at.toISOString(),
    clockOffsetMs: input.clockOffsetMs,
  };
}

/** El cuerpo de cerrar un turno: el de `POST /v1/shifts/:id/close`. El turno va aparte, junto a la operacion, como en el lote. */
export function closingBody(input: {
  readonly operationId: string;
  readonly countedAmount: number;
  readonly at: Date;
  readonly clockOffsetMs: number | null;
}): Record<string, unknown> {
  return {
    operationId: input.operationId,
    countedAmount: input.countedAmount,
    deviceTime: input.at.toISOString(),
    clockOffsetMs: input.clockOffsetMs,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isMoment(value: unknown): value is string {
  return isText(value) && !Number.isNaN(new Date(value).getTime());
}

function isPesos(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_PESOS
  );
}

function parseSales(value: unknown): ShiftSales | null {
  if (!isRecord(value)) return null;
  const { cashCount, cashAmount, otherCount, otherAmount } = value;
  if (!isPesos(cashCount) || !isPesos(cashAmount)) return null;
  if (!isPesos(otherCount) || !isPesos(otherAmount)) return null;
  return { cashCount, cashAmount, otherCount, otherAmount };
}

function parseClosing(value: unknown): ShiftClosing | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { operationId, closedAt, countedAmount } = value;
  if (!isText(operationId) || !isMoment(closedAt) || !isPesos(countedAmount)) return undefined;
  return { operationId, closedAt, countedAmount };
}

/** Lee un turno guardado. Devuelve `null` si no tiene la forma que este codigo escribe: lo guardado no es de fiar a ciegas. */
export function parseLocalShift(value: unknown): LocalShift | null {
  if (!isRecord(value)) return null;
  const { shiftId, deviceId, openOperationId, openedAt, openingAmount } = value;
  if (!isText(shiftId) || !isText(deviceId) || !isText(openOperationId)) return null;
  if (!isMoment(openedAt) || !isPesos(openingAmount)) return null;
  const sales = parseSales(value['sales']);
  if (sales === null) return null;
  const closing = parseClosing(value['closing']);
  if (closing === undefined) return null;
  return { shiftId, deviceId, openOperationId, openedAt, openingAmount, sales, closing };
}
