import { isUnit, type UnitCode } from './catalog';

/** Lo que hay de un producto, tal como lo da `GET /v1/stock` (ADR 0013): la suma de sus movimientos. */
export interface StockItem {
  readonly productId: string;
  readonly name: string;
  readonly sku: string;
  readonly unit: UnitCode;
  /** `false` si el producto esta archivado. */
  readonly active: boolean;
  /** En milesimas de la unidad. Puede ser negativa (una venta sin conexion que se acepto). */
  readonly quantityMilli: number;
  /** El minimo que fijo el negocio, o `null` si no fijo uno. */
  readonly minStockMilli: number | null;
  /** Hay un minimo y la existencia esta POR DEBAJO de el (igual al minimo no avisa). */
  readonly belowMinimum: boolean;
}

/** Que origino un movimiento de existencias. */
export type MovementKind = 'sale' | 'purchase' | 'adjustment' | 'void';

const KINDS: readonly string[] = ['sale', 'purchase', 'adjustment', 'void'];

const KIND_LABELS: Readonly<Record<MovementKind, string>> = {
  sale: 'Venta',
  purchase: 'Compra',
  adjustment: 'Ajuste',
  void: 'Anulación',
};

export function movementLabel(kind: MovementKind): string {
  return KIND_LABELS[kind];
}

/** Un renglon del historial de un producto. El historial no se edita ni se borra: se corrige con otro movimiento. */
export interface StockMovement {
  readonly id: string;
  readonly operationId: string;
  readonly productId: string;
  readonly kind: MovementKind;
  /** Milesimas de la unidad del producto; negativo si resta. */
  readonly deltaMilli: number;
  /** La nota del movimiento: en un ajuste, el motivo; en una compra, la nota de la compra. */
  readonly reason: string | null;
  readonly createdAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lee la existencia de un producto. Devuelve `null` si no tiene la forma del contrato: los datos de la red no son de fiar. */
export function parseStockItem(value: unknown): StockItem | null {
  if (!isRecord(value)) return null;
  const { productId, name, sku, unit, active, quantityMilli, minStockMilli, belowMinimum } = value;
  if (typeof productId !== 'string' || typeof name !== 'string' || typeof sku !== 'string') {
    return null;
  }
  if (!isUnit(unit)) return null;
  if (typeof active !== 'boolean' || typeof belowMinimum !== 'boolean') return null;
  if (typeof quantityMilli !== 'number' || !Number.isSafeInteger(quantityMilli)) return null;
  if (minStockMilli !== null && !Number.isSafeInteger(minStockMilli)) return null;
  return {
    productId,
    name,
    sku,
    unit,
    active,
    quantityMilli,
    minStockMilli: minStockMilli as number | null,
    belowMinimum,
  };
}

export function parseMovement(value: unknown): StockMovement | null {
  if (!isRecord(value)) return null;
  const { id, operationId, productId, kind, deltaMilli, reason, createdAt } = value;
  if (typeof id !== 'string' || typeof operationId !== 'string' || typeof productId !== 'string') {
    return null;
  }
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return null;
  if (typeof deltaMilli !== 'number' || !Number.isSafeInteger(deltaMilli)) return null;
  if (reason !== null && typeof reason !== 'string') return null;
  if (typeof createdAt !== 'string') return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  return {
    id,
    operationId,
    productId,
    kind: kind as MovementKind,
    deltaMilli,
    reason,
    createdAt: created,
  };
}
