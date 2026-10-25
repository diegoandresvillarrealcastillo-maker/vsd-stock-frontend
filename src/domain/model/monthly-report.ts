import { PAYMENT_METHODS, type PaymentMethod } from './sale-payment';
import { isTaxKind, taxKindLabel, type TaxKind } from './tax';

/** Un renglon de la declaracion: lo vendido de un tipo y una tarifa (ADR 0035 del backend). Siempre llegan los cuatro, en este orden. */
export interface ReportRow {
  readonly taxKind: TaxKind;
  readonly rateBp: number;
  /** Con el IVA incluido. */
  readonly total: number;
  readonly base: number;
  readonly tax: number;
}

export interface ReportSection {
  /** Cuantas ventas entran. */
  readonly count: number;
  readonly total: number;
  readonly base: number;
  readonly tax: number;
  readonly rows: readonly ReportRow[];
  /** Lo cobrado por medio de pago, sin el vuelto. */
  readonly payments: readonly { readonly method: PaymentMethod; readonly amount: number }[];
}

/**
 * El reporte de un mes. Las ventas son las hechas en el mes, anuladas despues o no; las anulaciones son las hechas en el mes, de
 * ventas de cualquier mes, y van aparte: el reporte no resta nada (ADR 0032 y 0035 del backend).
 */
export interface MonthlyReport {
  readonly month: string;
  readonly from: Date;
  readonly to: Date;
  readonly sales: ReportSection;
  readonly voids: ReportSection;
}

/** Bogota esta en UTC-5 todo el ano y no cambia de hora: su medianoche son las 05:00 UTC (ADR 0035 del backend). */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** El mes como lo pide el servidor: `AAAA-MM`, de este siglo. */
export function isReportMonth(text: string): boolean {
  return /^2\d{3}-(0[1-9]|1[0-2])$/.test(text);
}

/** El mes en que cae un instante segun un reloj de Bogota, que es el que corta los meses del reporte. */
export function monthOfBogota(date: Date): string {
  return new Date(date.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 7);
}

/** El mes `delta` meses despues de `month` (antes, si es negativo), cruzando el ano si hace falta. */
export function shiftMonth(month: string, delta: number): string {
  const [year = '', number = ''] = month.split('-');
  const index = Number(year) * 12 + (Number(number) - 1) + delta;
  return `${String(Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, '0')}`;
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** `2026-10` como se dice: «octubre de 2026». */
export function monthLabel(month: string): string {
  const [year = '', number = ''] = month.split('-');
  return `${MONTH_NAMES[Number(number) - 1] ?? ''} de ${year}`;
}

/** El nombre de un renglon: «Gravado 19 %», «Gravado 5 %», «Exento» o «Excluido». */
export function rowLabel(row: Pick<ReportRow, 'taxKind' | 'rateBp'>): string {
  return row.taxKind === 'taxed'
    ? `${taxKindLabel(row.taxKind)} ${String(row.rateBp / 100)} %`
    : taxKindLabel(row.taxKind);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseRow(value: unknown): ReportRow | null {
  if (!isRecord(value)) return null;
  const { taxKind, rateBp, total, base, tax } = value;
  if (!isTaxKind(taxKind)) return null;
  if (!Number.isInteger(rateBp) || !Number.isInteger(total)) return null;
  if (!Number.isInteger(base) || !Number.isInteger(tax)) return null;
  return {
    taxKind,
    rateBp: rateBp as number,
    total: total as number,
    base: base as number,
    tax: tax as number,
  };
}

function parsePayment(value: unknown): ReportSection['payments'][number] | null {
  if (!isRecord(value)) return null;
  const { method, amount } = value;
  const known = PAYMENT_METHODS.find((candidate) => candidate.method === method);
  if (known === undefined || !Number.isInteger(amount)) return null;
  return { method: known.method, amount: amount as number };
}

function parseList<T>(value: unknown, parseItem: (raw: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items: T[] = [];
  for (const raw of value as unknown[]) {
    const item = parseItem(raw);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

function parseSection(value: unknown): ReportSection | null {
  if (!isRecord(value)) return null;
  const { count, total, base, tax } = value;
  const rows = parseList(value['rows'], parseRow);
  const payments = parseList(value['payments'], parsePayment);
  if (!Number.isInteger(count) || !Number.isInteger(total)) return null;
  if (!Number.isInteger(base) || !Number.isInteger(tax)) return null;
  if (rows === null || payments === null) return null;
  return {
    count: count as number,
    total: total as number,
    base: base as number,
    tax: tax as number,
    rows,
    payments,
  };
}

/** Lee el reporte con la forma del contrato. Devuelve `null` si algo no la tiene: los datos de la red no son de fiar. */
export function parseMonthlyReport(value: unknown): MonthlyReport | null {
  if (!isRecord(value)) return null;
  const { month } = value;
  const from = readDate(value['from']);
  const to = readDate(value['to']);
  const sales = parseSection(value['sales']);
  const voids = parseSection(value['voids']);
  if (typeof month !== 'string' || !isReportMonth(month)) return null;
  if (from === null || to === null || sales === null || voids === null) return null;
  return { month, from, to, sales, voids };
}
