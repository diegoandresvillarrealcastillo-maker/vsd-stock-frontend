import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { parseProduct, type Product } from '../../../domain/model/catalog';
import { LocalKeyLostError } from '../../../domain/model/local-errors';
import { parseProfile, type LocalProfile } from '../../../domain/model/local-profile';
import {
  OPERATION_KINDS,
  type AttentionReason,
  type NewOperation,
  type OperationKind,
  type OperationState,
  type QueuedOperation,
} from '../../../domain/model/outbox';
import {
  NO_DOWNLOADS,
  parseStockLevel,
  type CopyCheckpoint,
  type StockLevel,
} from '../../../domain/model/read-copy';
import { parseLocalShift, type LocalShift } from '../../../domain/model/shift';
import type { DeviceRegistration, LocalStore } from '../../../domain/ports/out/local-store';
import { AesGcmCipher, RecordUnreadableError, type Sealed } from './aes-gcm-cipher';

/** La version del esquema de la base. Subirla es una migracion: `upgrade` de abajo decide que hacer con lo que ya hay. */
export const DB_VERSION = 1;

/** El nombre de la base de una persona: su identificador, nunca su nombre ni su correo (ADR 0018, punto 5). */
export function databaseName(authUserId: string): string {
  return `vsd-stock-${authUserId}`;
}

/** Un registro cifrado. El nombre es la clave del registro y tambien lo que el cifrado autentica. */
interface SealedRecord extends Sealed {
  readonly name: string;
}

/**
 * Una operacion que espera a ser enviada. Lo que se busca va EN CLARO (la clave, el estado, la hora) y jamas lleva datos
 * personales; el contenido va cifrado (ADR 0018, punto 2). La cola del motor sin conexion (C3-09) la escribe y la lee.
 */
export interface QueuedOperationRecord extends Sealed {
  readonly operationId: string;
  readonly state: 'pending' | 'attention';
  readonly createdAt: string;
  /**
   * El numero de orden en que se agrego a la cola: lo que manda para enviarlas. Una operacion puede depender de la de antes (la
   * venta, de la apertura del turno) y la hora del reloj no es de fiar para ordenarlas: se corrige, o se repite en el mismo
   * milisegundo. Las que se guardaron antes de que existiera no lo tienen y van primero, por su hora.
   */
  readonly seq?: number;
}

export interface LocalSchema extends DBSchema {
  /** Lo que no es secreto ni personal y se busca o se cuenta: la clave de cifrado y la serie de folios. */
  meta: { key: string; value: CryptoKey | number };
  records: { key: string; value: SealedRecord };
  operations: {
    key: string;
    value: QueuedOperationRecord;
    indexes: { state: string };
  };
}

export type LocalDatabase = IDBPDatabase<LocalSchema>;

/** Una clave guardada. Se reconoce por su forma y no con `instanceof`: la clase `CryptoKey` no existe en todos los entornos. */
function isCryptoKey(value: unknown): value is CryptoKey {
  return (
    typeof value === 'object' && value !== null && 'algorithm' in value && 'extractable' in value
  );
}

const KEY = 'key';
const CHECKPOINT = 'copy-checkpoint';
const PRODUCT_PREFIX = 'product:';
const STOCK_PREFIX = 'stock:';
const SERIAL = 'serial';
const PROFILE = 'profile';
const DEVICE = 'device';
const SHIFT = 'shift';
const QUEUE_SEQ = 'queue-seq';

/**
 * Abre la base de una persona y deja lista su clave. Si la base no existe, la crea. Si tiene operaciones por enviar pero no la
 * clave, lanza `LocalKeyLostError`: abrirla con una clave nueva las dejaria perdidas sin que nadie lo sepa (ADR 0018).
 */
export async function openLocalDatabase(
  authUserId: string,
  generateKey: () => Promise<CryptoKey>,
): Promise<{ db: LocalDatabase; key: CryptoKey }> {
  const db = await openDB<LocalSchema>(databaseName(authUserId), DB_VERSION, {
    upgrade(upgrading) {
      upgrading.createObjectStore('meta');
      upgrading.createObjectStore('records', { keyPath: 'name' });
      const operations = upgrading.createObjectStore('operations', { keyPath: 'operationId' });
      operations.createIndex('state', 'state');
    },
    // Otra pestaña quiere borrar la base (olvidar) o subir su version: esta conexion se suelta para no estorbar.
    blocking(_current, _blocked, event) {
      if (event.target instanceof IDBDatabase) event.target.close();
    },
  });
  try {
    const existing = await db.get('meta', KEY);
    if (isCryptoKey(existing)) return { db, key: existing };
    const waiting = await db.count('operations');
    if (waiting > 0) throw new LocalKeyLostError(waiting);

    // Dos pestañas pueden llegar aqui a la vez: gana la primera clave que se guarda y la otra la adopta.
    const fresh = await generateKey();
    const tx = db.transaction(['meta', 'records'], 'readwrite');
    const raced = await tx.objectStore('meta').get(KEY);
    if (isCryptoKey(raced)) {
      await tx.done;
      return { db, key: raced };
    }
    await tx.objectStore('meta').put(fresh, KEY);
    // Lo cifrado con una clave que ya no existe no se puede abrir: se tira para no dejar basura que aparenta ser datos.
    await tx.objectStore('records').clear();
    await tx.done;
    return { db, key: fresh };
  } catch (error) {
    db.close();
    throw error;
  }
}

/** La base de UNA persona sobre IndexedDB, con el contenido de cada registro cifrado (ADR 0018). */
export class IdbLocalStore implements LocalStore {
  private readonly cipher: AesGcmCipher;

  constructor(
    private readonly db: LocalDatabase,
    key: CryptoKey,
  ) {
    this.cipher = new AesGcmCipher(key);
  }

  async readProfile(): Promise<LocalProfile | null> {
    const value = await this.readRecord(PROFILE);
    return value === undefined ? null : parseProfile(value);
  }

  async writeProfile(profile: LocalProfile): Promise<void> {
    await this.writeRecord(PROFILE, profile);
  }

  async readDevice(): Promise<DeviceRegistration | null> {
    return parseDevice(await this.readRecord(DEVICE));
  }

  async claimDevice(candidate: DeviceRegistration): Promise<DeviceRegistration> {
    const sealed = await this.cipher.seal(DEVICE, candidate);
    // El cifrado ya termino: dentro de una transaccion de IndexedDB solo se espera a IndexedDB, o la transaccion se cierra sola.
    const tx = this.db.transaction('records', 'readwrite');
    const existing = await tx.store.get(DEVICE);
    if (existing === undefined) {
      await tx.store.put({ name: DEVICE, ...sealed });
      await tx.done;
      return candidate;
    }
    await tx.done;
    const device = parseDevice(await this.openOrUndefined(DEVICE, existing));
    if (device !== null) return device;
    // El que habia no se puede abrir: no sirve de nada conservarlo.
    await this.writeRecord(DEVICE, candidate);
    return candidate;
  }

  async completeDevice(device: DeviceRegistration): Promise<void> {
    await this.writeRecord(DEVICE, device);
  }

  async reserveSerial(): Promise<number> {
    // Una sola transaccion que lee, suma y escribe, SIN esperar nada mas: IndexedDB turna las transacciones de escritura sobre
    // el mismo almacen, aunque vengan de pestañas distintas, asi que dos reservas nunca reciben el mismo numero (ADR 0016).
    // El cifrado de lo que se vaya a hacer con el numero ocurre despues: si falla, queda un salto y nunca una repeticion.
    const tx = this.db.transaction('meta', 'readwrite');
    const current = await tx.store.get(SERIAL);
    const next = (typeof current === 'number' ? current : 0) + 1;
    await tx.store.put(next, SERIAL);
    await tx.done;
    return next;
  }

  countPending(): Promise<number> {
    return this.db.countFromIndex('operations', 'state', 'pending');
  }

  countAttention(): Promise<number> {
    return this.db.countFromIndex('operations', 'state', 'attention');
  }

  async enqueue(operation: NewOperation): Promise<void> {
    // El cifrado va antes de abrir la transaccion: dentro de una de IndexedDB solo se espera a IndexedDB.
    const sealed = await this.sealOperation(operation);
    const tx = this.db.transaction(['operations', 'meta'], 'readwrite');
    const operations = tx.objectStore('operations');
    if ((await operations.get(operation.operationId)) === undefined) {
      const seq = await nextSeq(tx.objectStore('meta'));
      await operations.put(queuedRecord(operation, sealed, seq));
    }
    await tx.done;
  }

  async readCurrentShift(): Promise<LocalShift | null> {
    return parseLocalShift(await this.readRecord(SHIFT));
  }

  async saveShift(shift: LocalShift, operation: NewOperation): Promise<void> {
    // Todo se cifra antes de abrir la transaccion; dentro, el turno y la operacion se escriben juntos o no se escribe nada.
    const sealedShift = await this.cipher.seal(SHIFT, shift);
    const sealedOperation = await this.sealOperation(operation);
    const tx = this.db.transaction(['records', 'operations', 'meta'], 'readwrite');
    try {
      await tx.objectStore('records').put({ name: SHIFT, ...sealedShift });
      const operations = tx.objectStore('operations');
      if ((await operations.get(operation.operationId)) === undefined) {
        const seq = await nextSeq(tx.objectStore('meta'));
        await operations.put(queuedRecord(operation, sealedOperation, seq));
      }
    } catch (error) {
      // Un fallo de JavaScript no deshace la transaccion por si solo: si algo fallo, ni el turno ni la operacion quedan.
      tx.done.catch(() => undefined);
      try {
        tx.abort();
      } catch {
        // Ya habia terminado: no hay nada que deshacer.
      }
      throw error;
    }
    await tx.done;
  }

  async operationState(operationId: string): Promise<OperationState | null> {
    const record = await this.db.get('operations', operationId);
    return record?.state ?? null;
  }

  async pendingOperations(limit: number): Promise<QueuedOperation[]> {
    return await this.readOperations('pending', limit);
  }

  async attentionOperations(): Promise<QueuedOperation[]> {
    return await this.readOperations('attention', Number.POSITIVE_INFINITY);
  }

  async resolveOperations(operationIds: readonly string[]): Promise<void> {
    const tx = this.db.transaction('operations', 'readwrite');
    for (const operationId of operationIds) await tx.store.delete(operationId);
    await tx.done;
  }

  async markAttention(operationId: string, reason: AttentionReason): Promise<void> {
    await this.rewriteOperation(
      operationId,
      (content) => ({ ...content, attention: reason }),
      'attention',
    );
  }

  async recordAttempts(operationIds: readonly string[]): Promise<void> {
    for (const operationId of operationIds) {
      await this.rewriteOperation(operationId, (content) => ({
        ...content,
        attempts: content.attempts + 1,
      }));
    }
  }

  async putProducts(products: readonly Product[]): Promise<void> {
    const sealed: SealedRecord[] = [];
    for (const product of products) {
      const name = productName(product.id);
      const existing = await this.db.get('records', name);
      if (existing !== undefined) {
        const current = parseProduct(await this.openOrUndefined(name, existing));
        // Gana el que cambio despues: la pagina de un minuto antes puede llegar otra vez y no debe deshacer nada.
        if (current !== null && current.updatedAt.getTime() > product.updatedAt.getTime()) continue;
      }
      sealed.push({ name, ...(await this.cipher.seal(name, product)) });
    }
    await this.putAll(sealed);
  }

  async readProducts(): Promise<Product[]> {
    const products: Product[] = [];
    for (const record of await this.recordsStartingWith(PRODUCT_PREFIX)) {
      const product = parseProduct(await this.openOrUndefined(record.name, record));
      if (product !== null) products.push(product);
    }
    return products;
  }

  async putStock(levels: readonly StockLevel[]): Promise<void> {
    const sealed: SealedRecord[] = [];
    for (const level of levels) {
      const name = stockName(level.productId);
      sealed.push({ name, ...(await this.cipher.seal(name, level)) });
    }
    await this.putAll(sealed);
  }

  async readStock(): Promise<StockLevel[]> {
    const levels: StockLevel[] = [];
    for (const record of await this.recordsStartingWith(STOCK_PREFIX)) {
      const level = parseStockLevel(await this.openOrUndefined(record.name, record));
      if (level !== null) levels.push(level);
    }
    return levels;
  }

  async readCheckpoint(): Promise<CopyCheckpoint> {
    return parseCheckpoint(await this.readRecord(CHECKPOINT));
  }

  async writeCheckpoint(checkpoint: CopyCheckpoint): Promise<void> {
    await this.writeRecord(CHECKPOINT, {
      productsAsOf: checkpoint.productsAsOf?.toISOString() ?? null,
      stockAsOf: checkpoint.stockAsOf?.toISOString() ?? null,
    });
  }

  close(): void {
    this.db.close();
  }

  private async sealOperation(operation: NewOperation): Promise<Sealed> {
    return await this.cipher.seal(operationName(operation.operationId), {
      kind: operation.kind,
      shiftId: operation.shiftId ?? null,
      body: operation.body,
      attempts: 0,
      attention: null,
    } satisfies OperationContent);
  }

  /** Todos los registros cuyo nombre empieza por el prefijo, que es la clave de `records`. */
  private async recordsStartingWith(prefix: string): Promise<SealedRecord[]> {
    return await this.db.getAll('records', IDBKeyRange.bound(prefix, `${prefix}\uffff`));
  }

  /** Guarda varios registros ya cifrados en una sola transaccion: dentro de una de IndexedDB solo se espera a IndexedDB. */
  private async putAll(records: readonly SealedRecord[]): Promise<void> {
    const tx = this.db.transaction('records', 'readwrite');
    for (const record of records) await tx.store.put(record);
    await tx.done;
  }

  /** Las operaciones de un estado, en el orden en que se agregaron, abriendo solo las que hacen falta. */
  private async readOperations(
    state: QueuedOperationRecord['state'],
    limit: number,
  ): Promise<QueuedOperation[]> {
    const records = await this.db.getAllFromIndex('operations', 'state', state);
    records.sort(
      (a, b) =>
        (a.seq ?? 0) - (b.seq ?? 0) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.operationId.localeCompare(b.operationId),
    );
    const operations: QueuedOperation[] = [];
    for (const record of records) {
      if (operations.length >= limit) break;
      const operation = await this.openOperation(record);
      if (operation !== null) operations.push(operation);
    }
    return operations;
  }

  private async openOperation(record: QueuedOperationRecord): Promise<QueuedOperation | null> {
    const content = parseOperationContent(
      await this.openOrUndefined(operationName(record.operationId), record),
    );
    if (content === null) return null;
    return {
      operationId: record.operationId,
      createdAt: record.createdAt,
      state: record.state,
      ...content,
    };
  }

  /**
   * Cambia el contenido de una operacion que sigue ahi y, si se pide, su estado. Se lee, se cifra de nuevo y se vuelve a mirar si
   * sigue ahi antes de escribir: una que otra pestaña ya saco de la cola no resucita.
   */
  private async rewriteOperation(
    operationId: string,
    change: (content: OperationContent) => OperationContent,
    state?: QueuedOperationRecord['state'],
  ): Promise<void> {
    const record = await this.db.get('operations', operationId);
    if (record === undefined) return;
    const operation = await this.openOperation(record);
    if (operation === null) return;
    const { kind, shiftId, body, attempts, attention } = operation;
    const sealed = await this.cipher.seal(
      operationName(operationId),
      change({ kind, shiftId, body, attempts, attention }),
    );
    const tx = this.db.transaction('operations', 'readwrite');
    const current = await tx.store.get(operationId);
    if (current !== undefined)
      await tx.store.put({ ...current, ...(state ? { state } : {}), ...sealed });
    await tx.done;
  }

  private async writeRecord(name: string, value: unknown): Promise<void> {
    const sealed = await this.cipher.seal(name, value);
    await this.db.put('records', { name, ...sealed });
  }

  private async readRecord(name: string): Promise<unknown> {
    const stored = await this.db.get('records', name);
    return stored === undefined ? undefined : await this.openOrUndefined(name, stored);
  }

  /** Lo que dice un registro, o `undefined` si no se puede abrir (otra clave, un bit alterado, un registro cambiado de lugar). */
  private async openOrUndefined(name: string, stored: Sealed): Promise<unknown> {
    try {
      return await this.cipher.open(name, stored);
    } catch (error) {
      if (error instanceof RecordUnreadableError) return undefined;
      throw error;
    }
  }
}

/** Lo que se cifra de una operacion de la cola. */
interface OperationContent {
  readonly kind: OperationKind;
  readonly shiftId: string | null;
  readonly body: Readonly<Record<string, unknown>>;
  readonly attempts: number;
  readonly attention: AttentionReason | null;
}

/** Una operacion nueva como se guarda en la cola: en claro solo lo que se busca. */
function queuedRecord(operation: NewOperation, sealed: Sealed, seq: number): QueuedOperationRecord {
  return {
    operationId: operation.operationId,
    state: 'pending',
    createdAt: operation.createdAt.toISOString(),
    seq,
    ...sealed,
  };
}

/** El siguiente numero de orden de la cola, ya asentado. Va en la misma transaccion que escribe la operacion: dos pestañas nunca reciben el mismo. */
async function nextSeq(meta: {
  get(key: string): Promise<unknown>;
  put(value: number, key: string): Promise<unknown>;
}): Promise<number> {
  const last = await meta.get(QUEUE_SEQ);
  const seq = (typeof last === 'number' ? last : 0) + 1;
  await meta.put(seq, QUEUE_SEQ);
  return seq;
}

/** El nombre bajo el que se cifra un producto de la copia: lleva su identificador, asi uno copiado al lugar de otro no se abre. */
function productName(productId: string): string {
  return `${PRODUCT_PREFIX}${productId}`;
}

function stockName(productId: string): string {
  return `${STOCK_PREFIX}${productId}`;
}

function readDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Lo que se bajo, tal como se guardo. Si no tiene la forma, es como si nada se hubiera bajado: se baja todo otra vez. */
function parseCheckpoint(value: unknown): CopyCheckpoint {
  if (typeof value !== 'object' || value === null) return NO_DOWNLOADS;
  const { productsAsOf, stockAsOf } = value as Record<string, unknown>;
  const products = readDate(productsAsOf);
  const stock = readDate(stockAsOf);
  if (products === undefined || stock === undefined) return NO_DOWNLOADS;
  return { productsAsOf: products, stockAsOf: stock };
}

/** El nombre bajo el que se cifra una operacion: lleva su identificador, asi una copiada al lugar de otra no se abre. */
function operationName(operationId: string): string {
  return `operation:${operationId}`;
}

function parseAttention(value: unknown): AttentionReason | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const {
    class: failure,
    status,
    code,
  } = value as { class?: unknown; status?: unknown; code?: unknown };
  if (failure !== 'conflict' && failure !== 'permanent') return undefined;
  if (typeof status !== 'number' || !Number.isInteger(status)) return undefined;
  if (code !== null && typeof code !== 'string') return undefined;
  return { class: failure, status, code };
}

function parseOperationContent(value: unknown): OperationContent | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, shiftId, body, attempts, attention } = value as Record<string, unknown>;
  if (!(OPERATION_KINDS as readonly unknown[]).includes(kind)) return null;
  if (shiftId !== null && typeof shiftId !== 'string') return null;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  if (typeof attempts !== 'number' || !Number.isInteger(attempts) || attempts < 0) return null;
  const reason = parseAttention(attention);
  if (reason === undefined) return null;
  return {
    kind: kind as OperationKind,
    shiftId,
    body: body as Record<string, unknown>,
    attempts,
    attention: reason,
  };
}

function parseDevice(value: unknown): DeviceRegistration | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, code } = value as { id?: unknown; code?: unknown };
  if (typeof id !== 'string' || (code !== null && typeof code !== 'string')) return null;
  return { id, code };
}
