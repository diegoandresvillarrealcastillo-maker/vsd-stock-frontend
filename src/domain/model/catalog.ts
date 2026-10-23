import {
  TAX_RATES_BP,
  isTaxKind,
  startingTaxKind,
  taxKindFitsRate,
  taxKindLabel,
  type TaxKind,
} from './tax';

/** Las unidades en que se vende un producto (ADR 0015). Cada presentacion (paca, caja) es otro producto, no otra unidad. */
export type UnitCode = 'unit' | 'kilogram' | 'gram' | 'pound' | 'liter' | 'milliliter';

export interface UnitInfo {
  readonly code: UnitCode;
  readonly name: string;
  readonly short: string;
  /** Lo que se cuenta de a uno (una lata) no admite fracciones; lo que se pesa o se mide, si. */
  readonly whole: boolean;
}

export const UNITS: readonly UnitInfo[] = [
  { code: 'unit', name: 'Unidad', short: 'und', whole: true },
  { code: 'kilogram', name: 'Kilogramo', short: 'kg', whole: false },
  { code: 'gram', name: 'Gramo', short: 'g', whole: false },
  { code: 'pound', name: 'Libra', short: 'lb', whole: false },
  { code: 'liter', name: 'Litro', short: 'L', whole: false },
  { code: 'milliliter', name: 'Mililitro', short: 'mL', whole: false },
];

export function isUnit(value: unknown): value is UnitCode {
  return UNITS.some((unit) => unit.code === value);
}

function infoOf(code: UnitCode): UnitInfo {
  return UNITS.find((unit) => unit.code === code) ?? UNITS[0]!;
}

/** «Unidad (und)»: como se ofrece en un selector. */
export function unitLabel(code: UnitCode): string {
  const unit = infoOf(code);
  return `${unit.name} (${unit.short})`;
}

export function unitShort(code: UnitCode): string {
  return infoOf(code).short;
}

export function unitIsWhole(code: UnitCode): boolean {
  return infoOf(code).whole;
}

/** «19 %»: la tarifa de IVA, en puntos basicos en la API. */
export function taxLabel(rateBp: number): string {
  return `${String(rateBp / 100)} %`;
}

/** «Gravado 19 %», «Exento», «Excluido»: el tipo como lo dice quien vende; solo lo gravado dice su tarifa. */
export function taxChoiceLabel(kind: TaxKind, rateBp: number): string {
  return kind === 'taxed' ? `${taxKindLabel(kind)} ${taxLabel(rateBp)}` : taxKindLabel(kind);
}

/** Un producto del catalogo, tal como lo da `GET /v1/products` (ADR 0015). Un producto no se borra: se archiva. */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly barcode: string | null;
  readonly unit: UnitCode;
  /** Pesos enteros, con el IVA incluido (ADR 0014). */
  readonly unitPrice: number;
  /** La tarifa de IVA en puntos basicos: 0, 500 o 1900. */
  readonly taxRateBp: number;
  /** Gravado, exento o excluido (ADR 0034 del backend); siempre cabe con la tarifa. */
  readonly taxKind: TaxKind;
  /** `false` si esta archivado: no se vende y conserva su historia. */
  readonly active: boolean;
  readonly categoryId: string | null;
  /** Existencia minima en milesimas de la unidad, para la alerta; `null` si no se avisa. */
  readonly minStockMilli: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Lee un producto. Devuelve `null` si no tiene la forma del contrato: los datos de la red no son de fiar. */
export function parseProduct(value: unknown): Product | null {
  if (!isRecord(value)) return null;
  const { id, name, sku, barcode, unit, unitPrice, taxRateBp, taxKind } = value;
  const { active, categoryId, minStockMilli } = value;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof sku !== 'string') return null;
  if (barcode !== null && typeof barcode !== 'string') return null;
  if (!isUnit(unit)) return null;
  if (typeof unitPrice !== 'number' || !Number.isSafeInteger(unitPrice) || unitPrice < 0) {
    return null;
  }
  if (typeof taxRateBp !== 'number' || !TAX_RATES_BP.includes(taxRateBp)) return null;
  if (!isTaxKind(taxKind) || !taxKindFitsRate(taxKind, taxRateBp)) return null;
  if (typeof active !== 'boolean') return null;
  if (categoryId !== null && typeof categoryId !== 'string') return null;
  if (minStockMilli !== null && !Number.isSafeInteger(minStockMilli)) return null;
  const createdAt = readDate(value['createdAt']);
  const updatedAt = readDate(value['updatedAt']);
  if (createdAt === null || updatedAt === null) return null;
  return {
    id,
    name,
    sku,
    barcode,
    unit,
    unitPrice,
    taxRateBp,
    taxKind,
    active,
    categoryId,
    minStockMilli: minStockMilli as number | null,
    createdAt,
    updatedAt,
  };
}

/**
 * Lee un producto de la copia de este equipo. Uno guardado antes de que existiera el tipo tributario no lo trae: se le da el valor de
 * arranque de su tarifa (`startingTaxKind`) para que el mostrador siga vendiendo sin conexion hasta que la proxima sincronizacion
 * traiga el tipo de verdad, con la hora de cambio que el backend movio (ADR 0034). Un tipo que esta y no es uno de los tres no se corrige.
 */
export function parseStoredProduct(value: unknown): Product | null {
  if (isRecord(value) && value['taxKind'] === undefined && typeof value['taxRateBp'] === 'number') {
    return parseProduct({ ...value, taxKind: startingTaxKind(value['taxRateBp']) });
  }
  return parseProduct(value);
}

export function parseCategory(value: unknown): Category | null {
  if (!isRecord(value)) return null;
  const { id, name } = value;
  const createdAt = readDate(value['createdAt']);
  if (typeof id !== 'string' || typeof name !== 'string' || createdAt === null) return null;
  return { id, name, createdAt };
}
