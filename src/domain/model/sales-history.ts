import { Money } from './money';
import type { QueuedOperation } from './outbox';
import { lineTotal } from './sale-totals';

// Las ventas que el servidor ya tiene (C3-13, ADR 0027): lo que la lista y el detalle leen de la red, y lo que se dice de cada una.
// Los datos de la red no son de fiar: cada lector devuelve `null` si algo no es lo que dice el contrato.

const SALE_FLAGS = [
  'price-differs',
  'total-differs',
  'payment-mismatch',
  'late-shift',
  'revoked-device',
  'folio-device',
] as const;
const TIME_FLAGS = ['clock-skew', 'clock-unverified', 'future', 'stale', 'unreadable'] as const;
const METHODS = ['cash', 'card', 'transfer'] as const;
const RATES = [0, 500, 1_900] as const;

export type SaleFlag = (typeof SALE_FLAGS)[number];
export type TimeFlag = (typeof TIME_FLAGS)[number];

/** Quien la revisó y cuándo: una revisión saca la venta de la bandeja sin cambiarla. */
export interface SaleReview {
  readonly reviewedAt: Date;
  readonly reviewedByUserId: string;
  readonly note: string | null;
}

/** Quién la anuló, cuándo y por qué. Una venta anulada no se borra ni se edita. */
export interface SaleVoid {
  readonly voidedAt: Date;
  readonly voidedByUserId: string;
  readonly operationId: string;
  readonly reason: string;
}

/** Una venta de la lista: lo que se sabe de ella sin sus líneas ni sus cobros. */
export interface SaleRecord {
  readonly id: string;
  readonly operationId: string;
  readonly shiftId: string;
  readonly deviceId: string | null;
  readonly userId: string;
  readonly folio: string;
  readonly folioReported: string;
  readonly folioConflict: boolean;
  readonly total: number;
  readonly needsAdjustment: boolean;
  readonly flags: readonly SaleFlag[];
  readonly timeFlags: readonly TimeFlag[];
  readonly occurredAt: Date;
  readonly receivedAt: Date;
  readonly review: SaleReview | null;
  readonly voided: SaleVoid | null;
  /** Está en la bandeja «Requiere atención»: pide mirarla y nadie la ha revisado. */
  readonly attention: boolean;
}

export interface SaleLineView {
  readonly productId: string;
  readonly quantityMilli: number;
  readonly unitPrice: number;
  readonly discount: number;
  readonly taxRateBp: number;
}

export interface SalePaymentView {
  readonly method: (typeof METHODS)[number];
  readonly amount: number;
  readonly reference: string | null;
}

export interface SaleRateView {
  readonly rateBp: number;
  readonly total: number;
  readonly base: number;
  readonly tax: number;
}

/** Una venta completa. */
export interface SaleDetail extends SaleRecord {
  readonly lines: readonly SaleLineView[];
  readonly payments: readonly SalePaymentView[];
  readonly summary: {
    readonly total: number;
    readonly base: number;
    readonly tax: number;
    readonly byRate: readonly SaleRateView[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPesos(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isOneOf<T extends string | number>(list: readonly T[], value: unknown): value is T {
  return list.includes(value as T);
}

function readList<T extends string>(list: readonly T[], value: unknown): T[] | null {
  if (!Array.isArray(value)) return null;
  const read: T[] = [];
  for (const item of value as unknown[]) {
    if (!isOneOf(list, item)) return null;
    read.push(item);
  }
  return read;
}

export function parseReview(value: unknown): SaleReview | null {
  if (!isRecord(value)) return null;
  const { reviewedByUserId, note } = value;
  const reviewedAt = readDate(value['reviewedAt']);
  if (reviewedAt === null || typeof reviewedByUserId !== 'string') return null;
  if (note !== null && typeof note !== 'string') return null;
  return { reviewedAt, reviewedByUserId, note };
}

function parseVoid(value: unknown): SaleVoid | null {
  if (!isRecord(value)) return null;
  const { voidedByUserId, operationId, reason } = value;
  const voidedAt = readDate(value['voidedAt']);
  if (voidedAt === null) return null;
  if (typeof voidedByUserId !== 'string' || typeof operationId !== 'string') return null;
  if (typeof reason !== 'string') return null;
  return { voidedAt, voidedByUserId, operationId, reason };
}

export function parseSaleRecord(value: unknown): SaleRecord | null {
  if (!isRecord(value)) return null;
  const { id, operationId, shiftId, deviceId, userId, folio, folioReported } = value;
  if (typeof id !== 'string' || typeof operationId !== 'string' || typeof shiftId !== 'string') {
    return null;
  }
  if (deviceId !== null && typeof deviceId !== 'string') return null;
  if (typeof userId !== 'string' || typeof folio !== 'string') return null;
  if (typeof folioReported !== 'string') return null;
  const { folioConflict, needsAdjustment, attention, total } = value;
  if (typeof folioConflict !== 'boolean' || typeof needsAdjustment !== 'boolean') return null;
  if (typeof attention !== 'boolean' || !isPesos(total)) return null;
  const flags = readList(SALE_FLAGS, value['flags']);
  const timeFlags = readList(TIME_FLAGS, value['timeFlags']);
  const occurredAt = readDate(value['occurredAt']);
  const receivedAt = readDate(value['receivedAt']);
  if (flags === null || timeFlags === null || occurredAt === null || receivedAt === null) {
    return null;
  }
  const rawReview = value['review'];
  const rawVoid = value['voided'];
  const review = rawReview === null ? null : parseReview(rawReview);
  const voided = rawVoid === null ? null : parseVoid(rawVoid);
  if ((rawReview !== null && review === null) || (rawVoid !== null && voided === null)) {
    return null;
  }
  return {
    id,
    operationId,
    shiftId,
    deviceId,
    userId,
    folio,
    folioReported,
    folioConflict,
    total,
    needsAdjustment,
    flags,
    timeFlags,
    occurredAt,
    receivedAt,
    review,
    voided,
    attention,
  };
}

function parseLine(value: unknown): SaleLineView | null {
  if (!isRecord(value)) return null;
  const { productId, quantityMilli, unitPrice, discount, taxRateBp } = value;
  if (typeof productId !== 'string') return null;
  if (!isPesos(quantityMilli) || !isPesos(unitPrice) || !isPesos(discount)) return null;
  if (!isOneOf(RATES, taxRateBp)) return null;
  return { productId, quantityMilli, unitPrice, discount, taxRateBp };
}

function parsePayment(value: unknown): SalePaymentView | null {
  if (!isRecord(value)) return null;
  const { method, amount, reference } = value;
  if (!isOneOf(METHODS, method) || !isPesos(amount)) return null;
  if (reference !== null && typeof reference !== 'string') return null;
  return { method, amount, reference };
}

function parseRate(value: unknown): SaleRateView | null {
  if (!isRecord(value)) return null;
  const { rateBp, total, base, tax } = value;
  if (!isOneOf(RATES, rateBp) || !isPesos(total) || !isPesos(base) || !isPesos(tax)) return null;
  return { rateBp, total, base, tax };
}

function readAll<T>(value: unknown, parse: (raw: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const read: T[] = [];
  for (const raw of value as unknown[]) {
    const item = parse(raw);
    if (item === null) return null;
    read.push(item);
  }
  return read;
}

export function parseSaleDetail(value: unknown): SaleDetail | null {
  const header = parseSaleRecord(value);
  if (header === null || !isRecord(value)) return null;
  const lines = readAll(value['lines'], parseLine);
  const payments = readAll(value['payments'], parsePayment);
  const summary = value['summary'];
  if (lines === null || payments === null || !isRecord(summary)) return null;
  const { total, base, tax } = summary;
  const byRate = readAll(summary['byRate'], parseRate);
  if (!isPesos(total) || !isPesos(base) || !isPesos(tax) || byRate === null) return null;
  return { ...header, lines, payments, summary: { total, base, tax, byRate } };
}

/** Lo que costó una línea: lo que vale menos su rebaja, con el IVA incluido. */
export function saleLineAmount(line: SaleLineView): number {
  return lineTotal({
    unitPrice: Money.of(line.unitPrice),
    quantityMilli: line.quantityMilli,
    discount: Money.of(line.discount),
    rateBp: line.taxRateBp,
  }).amount;
}

export type SaleStatus = 'sent' | 'attention' | 'reviewed' | 'voided';

/** Dónde está una venta que el servidor ya tiene. Anulada manda sobre todo; una revisada conserva sus marcas pero ya no pide nada. */
export function saleStatus(sale: SaleRecord): SaleStatus {
  if (sale.voided !== null) return 'voided';
  if (sale.attention) return 'attention';
  if (sale.review !== null) return 'reviewed';
  return 'sent';
}

const STATUS_LABELS: Record<SaleStatus, string> = {
  sent: 'Enviada',
  attention: 'Requiere atención',
  reviewed: 'Revisada',
  voided: 'Anulada',
};

export function statusLabel(status: SaleStatus): string {
  return STATUS_LABELS[status];
}

const FLAG_NOTES: Record<SaleFlag, string> = {
  'price-differs': 'Algún precio o tarifa no es el del catálogo de hoy: se respetó el de la venta.',
  'total-differs':
    'El total del equipo no era el que calculó el servidor: se guardó el del servidor.',
  'payment-mismatch': 'Los cobros no suman el total de la venta.',
  'late-shift': 'Se vendió después de que el turno se cerró.',
  'revoked-device': 'Se vendió después de dar de baja el equipo.',
  'folio-device': 'El folio es de otro equipo, no del de su turno.',
};

const TIME_NOTES: Record<TimeFlag, string> = {
  'clock-skew': 'El reloj del equipo estaba desfasado: se corrigió la hora de la venta.',
  'clock-unverified':
    'El reloj del equipo todavía no se había medido: la hora es la que dijo el equipo.',
  future: 'La hora del equipo estaba en el futuro: se corrigió la hora de la venta.',
  stale: 'La venta llegó mucho después de ocurrir.',
  unreadable: 'No se pudo leer la hora del equipo: se usó la de llegada.',
};

/** Lo que el servidor encontró raro de la venta, dicho en frases: la existencia, el folio, las marcas y la hora, en ese orden. */
export function attentionNotes(sale: SaleRecord): string[] {
  const notes: string[] = [];
  if (sale.needsAdjustment) {
    notes.push('Se vendió sin existencias. La venta es válida; falta ajustar la existencia.');
  }
  if (sale.folioConflict) {
    notes.push(
      `El folio ${sale.folioReported} ya era de otra venta: esta se guardó como ${sale.folio}.`,
    );
  }
  for (const flag of sale.flags) notes.push(FLAG_NOTES[flag]);
  for (const flag of sale.timeFlags) notes.push(TIME_NOTES[flag]);
  return notes;
}

/** El motivo de anular o la nota de revisar, leídos: `null` si se dejó vacía una nota, que se puede omitir. */
export type ParsedReason =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly message: string };

/** Lo más largo que acepta el servidor para el motivo de anular y la nota de revisar. */
export const MAX_REASON_LENGTH = 200;

/**
 * Lee el motivo de anular (obligatorio) o la nota de revisar (se puede dejar vacía): una línea, con un solo espacio entre palabras y
 * sin pasar de lo que acepta el servidor.
 */
export function parseReason(text: string, options: { required: boolean }): ParsedReason {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value === '') {
    return options.required
      ? { ok: false, message: 'Escribe por qué se anula la venta.' }
      : { ok: true, value: null };
  }
  if (value.length > MAX_REASON_LENGTH) {
    return {
      ok: false,
      message: `Es muy largo: ${String(MAX_REASON_LENGTH)} letras como máximo.`,
    };
  }
  return { ok: true, value };
}

/** Una venta que todavía está en este equipo: la operación que espera en la cola (o que el servidor no aceptó). */
export interface LocalSale {
  readonly operationId: string;
  readonly folio: string;
  readonly total: number;
  readonly at: Date;
  /** El servidor no la aceptó y alguien tiene que mirarla. */
  readonly rejected: boolean;
}

/** Lee de la cola la venta que espera; `null` si la operación no es una venta o su cuerpo no es lo que una venta escribe. */
export function localSaleOf(operation: QueuedOperation): LocalSale | null {
  if (operation.kind !== 'sale') return null;
  const { folio, total } = operation.body;
  const at = readDate(operation.body['deviceTime']);
  if (typeof folio !== 'string' || !isPesos(total) || at === null) return null;
  return {
    operationId: operation.operationId,
    folio,
    total,
    at,
    rejected: operation.state === 'attention',
  };
}
