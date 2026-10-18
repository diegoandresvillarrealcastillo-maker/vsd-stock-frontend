/** Un proveedor: a quien se le compra (ADR 0015). Solo el nombre y un contacto. */
export interface Supplier {
  readonly id: string;
  readonly name: string;
  /** Un telefono, un correo o lo que sirva para llamar. */
  readonly contact: string | null;
  readonly createdAt: Date;
}

/** Una compra en la lista: lo que se sabe de ella sin sus lineas. */
export interface PurchaseSummary {
  readonly id: string;
  readonly operationId: string;
  readonly warehouseId: string;
  readonly supplierId: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly createdByUserId: string | null;
  readonly lineCount: number;
}

export interface PurchaseLine {
  readonly productId: string;
  /** Milesimas de la unidad del producto. */
  readonly quantityMilli: number;
  /** Pesos enteros que costo cada unidad. */
  readonly unitCost: number;
}

/** Una compra con sus lineas, como la devuelve el servidor al registrarla. */
export interface Purchase {
  readonly id: string;
  readonly operationId: string;
  readonly warehouseId: string;
  readonly supplierId: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly createdByUserId: string | null;
  readonly lines: readonly PurchaseLine[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function parseSupplier(value: unknown): Supplier | null {
  if (!isRecord(value)) return null;
  const { id, name, contact } = value;
  const createdAt = readDate(value['createdAt']);
  if (typeof id !== 'string' || typeof name !== 'string' || createdAt === null) return null;
  if (!isText(contact)) return null;
  return { id, name, contact, createdAt };
}

/** La cabecera que comparten la compra de la lista y la compra con lineas. */
function parseHeader(value: Record<string, unknown>): Omit<Purchase, 'lines'> | null {
  const { id, operationId, warehouseId, supplierId, note, createdByUserId } = value;
  const createdAt = readDate(value['createdAt']);
  if (typeof id !== 'string' || typeof operationId !== 'string') return null;
  if (typeof warehouseId !== 'string' || createdAt === null) return null;
  if (!isText(supplierId) || !isText(note) || !isText(createdByUserId)) return null;
  return { id, operationId, warehouseId, supplierId, note, createdAt, createdByUserId };
}

export function parsePurchaseSummary(value: unknown): PurchaseSummary | null {
  if (!isRecord(value)) return null;
  const header = parseHeader(value);
  const lineCount = value['lineCount'];
  if (header === null) return null;
  if (typeof lineCount !== 'number' || !Number.isSafeInteger(lineCount) || lineCount < 0) {
    return null;
  }
  return { ...header, lineCount };
}

function parseLine(value: unknown): PurchaseLine | null {
  if (!isRecord(value)) return null;
  const { productId, quantityMilli, unitCost } = value;
  if (typeof productId !== 'string') return null;
  if (typeof quantityMilli !== 'number' || !Number.isSafeInteger(quantityMilli)) return null;
  if (typeof unitCost !== 'number' || !Number.isSafeInteger(unitCost)) return null;
  return { productId, quantityMilli, unitCost };
}

export function parsePurchase(value: unknown): Purchase | null {
  if (!isRecord(value)) return null;
  const header = parseHeader(value);
  const rawLines = value['lines'];
  if (header === null || !Array.isArray(rawLines)) return null;
  const lines: PurchaseLine[] = [];
  for (const raw of rawLines as unknown[]) {
    const line = parseLine(raw);
    if (line === null) return null;
    lines.push(line);
  }
  return { ...header, lines };
}
