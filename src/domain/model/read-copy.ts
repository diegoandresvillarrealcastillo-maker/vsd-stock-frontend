/**
 * Lo que el dispositivo baja del servidor para vender sin conexion (ADR 0028): el catalogo y la existencia, con la hora en que
 * se leyeron. Nada de esto es la verdad de hoy en todas las cajas: es lo que el servidor sabia a esa hora.
 */

/**
 * Cuanto se retrocede desde la hora de la primera pagina para pedir lo siguiente: una transaccion que empezo antes de esa hora
 * puede confirmarse despues con una hora anterior, y sin este margen su cambio se perderia. Aplicar dos veces el mismo
 * producto no hace dano (ADR 0028, punto 11).
 */
export const COPY_MARGIN_MS = 60_000;

/** La existencia de un producto en milesimas de su unidad. Puede ser negativa: una venta sin existencias se acepta y se marca. */
export interface StockLevel {
  readonly productId: string;
  readonly quantityMilli: number;
}

/** Una pagina de la copia (`GET /v1/sync/products` y `/stock`). */
export interface CopyPage<T> {
  /** La hora del servidor al leerla. La de la PRIMERA pagina de una descarga es el punto de partida de la siguiente. */
  readonly asOf: Date;
  readonly items: readonly T[];
  /** Se pasa tal cual para pedir la pagina siguiente; `null` si no hay mas. */
  readonly nextCursor: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lee la existencia de un producto. Devuelve `null` si no tiene la forma del contrato: los datos de la red no son de fiar. */
export function parseStockLevel(value: unknown): StockLevel | null {
  if (!isRecord(value)) return null;
  const { productId, quantityMilli } = value;
  if (typeof productId !== 'string') return null;
  if (typeof quantityMilli !== 'number' || !Number.isSafeInteger(quantityMilli)) return null;
  return { productId, quantityMilli };
}

/**
 * Lee una pagina con la forma del contrato (`{ asOf, items, nextCursor }`). Devuelve `null` si el cuerpo, la hora o alguno de
 * los elementos no la tiene.
 */
export function parseCopyPage<T>(
  value: unknown,
  parseItem: (raw: unknown) => T | null,
): CopyPage<T> | null {
  if (!isRecord(value) || !Array.isArray(value['items'])) return null;
  const { asOf: rawAsOf, nextCursor } = value;
  if (typeof rawAsOf !== 'string') return null;
  const asOf = new Date(rawAsOf);
  if (Number.isNaN(asOf.getTime())) return null;
  if (nextCursor !== null && typeof nextCursor !== 'string') return null;
  const items: T[] = [];
  for (const raw of value['items'] as unknown[]) {
    const item = parseItem(raw);
    if (item === null) return null;
    items.push(item);
  }
  return { asOf, items, nextCursor };
}

/**
 * Lo que se sabe de las descargas hechas: la hora del servidor de la PRIMERA pagina de la ultima descarga completa de cada una.
 * De ella sale el `since` de la siguiente (menos el margen) y lo que se dice como «al...».
 */
export interface CopyCheckpoint {
  readonly productsAsOf: Date | null;
  readonly stockAsOf: Date | null;
}

/** Todavia no se bajo nada. */
export const NO_DOWNLOADS: CopyCheckpoint = { productsAsOf: null, stockAsOf: null };

/** Desde cuando se pide la siguiente descarga, dada la hora de la primera pagina de esta. */
export function sinceOf(firstAsOf: Date): Date {
  return new Date(firstAsOf.getTime() - COPY_MARGIN_MS);
}
