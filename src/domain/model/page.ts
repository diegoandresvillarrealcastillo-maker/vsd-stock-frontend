/** Una pagina de una lista que se pide por cursor (ADR 0019). */
export interface Page<T> {
  readonly items: readonly T[];
  /** Se pasa tal cual para pedir la pagina siguiente; `null` si no hay mas. */
  readonly nextCursor: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lee una pagina con la forma del contrato (`{ items, nextCursor }`). Devuelve `null` si el cuerpo o alguno de sus elementos
 * no la tiene: los datos de la red no son de fiar.
 */
export function parsePage<T>(
  value: unknown,
  parseItem: (raw: unknown) => T | null,
): Page<T> | null {
  if (!isRecord(value) || !Array.isArray(value['items'])) return null;
  const nextCursor = value['nextCursor'];
  if (nextCursor !== null && typeof nextCursor !== 'string') return null;
  const items: T[] = [];
  for (const raw of value['items'] as unknown[]) {
    const item = parseItem(raw);
    if (item === null) return null;
    items.push(item);
  }
  return { items, nextCursor };
}
