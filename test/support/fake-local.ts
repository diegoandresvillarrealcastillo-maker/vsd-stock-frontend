import { LocalKeyLostError } from '../../src/domain/model/local-errors';
import type { Product } from '../../src/domain/model/catalog';
import type { LocalProfile } from '../../src/domain/model/local-profile';
import type {
  AttentionReason,
  NewOperation,
  OperationState,
  QueuedOperation,
} from '../../src/domain/model/outbox';
import {
  NO_DOWNLOADS,
  type CopyCheckpoint,
  type StockLevel,
} from '../../src/domain/model/read-copy';
import type { LocalShift } from '../../src/domain/model/shift';
import type { DeviceRegistry, RegisteredDevice } from '../../src/domain/ports/out/device-registry';
import type { IdGenerator } from '../../src/domain/ports/out/id-generator';
import type {
  DeviceRegistration,
  LocalStore,
  LocalStores,
} from '../../src/domain/ports/out/local-store';
import type { PersonPointer } from '../../src/domain/ports/out/person-pointer';

/** Lo que una persona tiene guardado en el dispositivo; sobrevive a abrir y cerrar la base. */
export interface PersonData {
  profile: LocalProfile | null;
  device: DeviceRegistration | null;
  serial: number;
  /** Operaciones «fantasma»: cuentan como pendientes sin estar en la cola, para las pruebas que solo cuentan. */
  pending: number;
  /** La cola de operaciones, en el orden en que se agregaron. */
  queue: QueuedOperation[];
  /** La copia de lectura: el catalogo y la existencia por producto, y lo que se sabe de las descargas. */
  products: Map<string, Product>;
  stock: Map<string, StockLevel>;
  checkpoint: CopyCheckpoint;
  /** El turno de caja de ahora: el abierto, o el ultimo cerrado. */
  shift: LocalShift | null;
}

/** La base de una persona en memoria. Hace lo mismo que el adaptador de IndexedDB, sin navegador. */
class FakeLocalStore implements LocalStore {
  closed = false;

  constructor(
    private readonly data: PersonData,
    readonly person: string,
    private readonly owner: FakeLocalStores,
  ) {}

  readProfile(): Promise<LocalProfile | null> {
    return Promise.resolve(this.data.profile);
  }

  writeProfile(profile: LocalProfile): Promise<void> {
    this.data.profile = profile;
    return Promise.resolve();
  }

  readDevice(): Promise<DeviceRegistration | null> {
    return Promise.resolve(this.data.device);
  }

  async claimDevice(candidate: DeviceRegistration): Promise<DeviceRegistration> {
    if (this.owner.holdClaim !== null) await this.owner.holdClaim;
    this.data.device ??= candidate;
    return this.data.device;
  }

  completeDevice(device: DeviceRegistration): Promise<void> {
    this.data.device = device;
    return Promise.resolve();
  }

  reserveSerial(): Promise<number> {
    this.data.serial += 1;
    return Promise.resolve(this.data.serial);
  }

  countPending(): Promise<number> {
    return Promise.resolve(
      this.data.pending +
        this.data.queue.filter((operation) => operation.state === 'pending').length,
    );
  }

  countAttention(): Promise<number> {
    return Promise.resolve(
      this.data.queue.filter((operation) => operation.state === 'attention').length,
    );
  }

  enqueue(operation: NewOperation): Promise<void> {
    if (this.data.queue.some((queued) => queued.operationId === operation.operationId)) {
      return Promise.resolve();
    }
    this.data.queue.push({
      operationId: operation.operationId,
      kind: operation.kind,
      shiftId: operation.shiftId ?? null,
      body: operation.body,
      createdAt: operation.createdAt.toISOString(),
      state: 'pending',
      attempts: 0,
      attention: null,
    });
    return Promise.resolve();
  }

  readCurrentShift(): Promise<LocalShift | null> {
    return Promise.resolve(this.data.shift);
  }

  async saveShift(shift: LocalShift, operation: NewOperation): Promise<void> {
    if (this.owner.holdShift !== null) await this.owner.holdShift;
    if (this.owner.failShift !== null) throw this.owner.failShift;
    // Los dos a la vez y sin esperar nada en medio: es lo que hace la transaccion de la base de verdad.
    this.data.shift = shift;
    await this.enqueue(operation);
  }

  operationState(operationId: string): Promise<OperationState | null> {
    const queued = this.data.queue.find((operation) => operation.operationId === operationId);
    return Promise.resolve(queued?.state ?? null);
  }

  pendingOperations(limit: number): Promise<QueuedOperation[]> {
    return Promise.resolve(this.ofState('pending').slice(0, limit));
  }

  attentionOperations(): Promise<QueuedOperation[]> {
    return Promise.resolve(this.ofState('attention'));
  }

  resolveOperations(operationIds: readonly string[]): Promise<void> {
    this.data.queue = this.data.queue.filter(
      (operation) => !operationIds.includes(operation.operationId),
    );
    return Promise.resolve();
  }

  markAttention(operationId: string, reason: AttentionReason): Promise<void> {
    this.change(operationId, (operation) => ({
      ...operation,
      state: 'attention',
      attention: reason,
    }));
    return Promise.resolve();
  }

  recordAttempts(operationIds: readonly string[]): Promise<void> {
    for (const operationId of operationIds) {
      this.change(operationId, (operation) => ({ ...operation, attempts: operation.attempts + 1 }));
    }
    return Promise.resolve();
  }

  putProducts(products: readonly Product[]): Promise<void> {
    for (const product of products) {
      const current = this.data.products.get(product.id);
      if (current === undefined || current.updatedAt.getTime() <= product.updatedAt.getTime()) {
        this.data.products.set(product.id, product);
      }
    }
    return Promise.resolve();
  }

  readProducts(): Promise<Product[]> {
    return Promise.resolve([...this.data.products.values()]);
  }

  putStock(levels: readonly StockLevel[]): Promise<void> {
    for (const level of levels) this.data.stock.set(level.productId, level);
    return Promise.resolve();
  }

  readStock(): Promise<StockLevel[]> {
    return Promise.resolve([...this.data.stock.values()]);
  }

  readCheckpoint(): Promise<CopyCheckpoint> {
    return Promise.resolve(this.data.checkpoint);
  }

  writeCheckpoint(checkpoint: CopyCheckpoint): Promise<void> {
    this.data.checkpoint = checkpoint;
    return Promise.resolve();
  }

  close(): void {
    this.closed = true;
  }

  /** En el orden en que se agregaron: asi las ordena la base de verdad (una puede depender de la de antes). */
  private ofState(state: QueuedOperation['state']): QueuedOperation[] {
    return this.data.queue.filter((operation) => operation.state === state);
  }

  private change(operationId: string, work: (operation: QueuedOperation) => QueuedOperation): void {
    this.data.queue = this.data.queue.map((operation) =>
      operation.operationId === operationId ? work(operation) : operation,
    );
  }
}

/** Las bases locales en memoria, una por persona, con el registro de lo que se abrio y se olvido. */
export class FakeLocalStores implements LocalStores {
  readonly people = new Map<string, PersonData>();
  readonly opened: string[] = [];
  readonly forgotten: string[] = [];
  /** Las personas que tenian su base abierta en el momento de olvidar a alguien (una por cada `forget`). */
  readonly openAtForget: string[][] = [];
  readonly stores: FakeLocalStore[] = [];
  /** Si se pone, abrir una base espera a que esta promesa se cumpla (para ver el estado «abriendo»). */
  holdOpen: Promise<void> | null = null;
  /** Si se pone, reclamar el dispositivo espera a que esta promesa se cumpla (para cambiar de persona a la mitad). */
  holdClaim: Promise<void> | null = null;
  /** Si se pone, guardar un turno espera a que esta promesa se cumpla (para cambiar de persona a la mitad). */
  holdShift: Promise<void> | null = null;
  /** Si se pone, guardar un turno falla con este error y no guarda nada. */
  failShift: Error | null = null;
  /** Si se pone, abrir la base de esa persona falla con este error. */
  failOpen: Error | null = null;
  /** Si se pone, abrir la base de esa persona dice que la clave se perdio y quedan operaciones. */
  keyLostFor: string | null = null;

  dataOf(authUserId: string): PersonData {
    let data = this.people.get(authUserId);
    if (data === undefined) {
      data = {
        profile: null,
        device: null,
        serial: 0,
        pending: 0,
        queue: [],
        products: new Map(),
        stock: new Map(),
        checkpoint: NO_DOWNLOADS,
        shift: null,
      };
      this.people.set(authUserId, data);
    }
    return data;
  }

  open(authUserId: string): Promise<LocalStore> {
    if (this.holdOpen !== null) return this.holdOpen.then(() => this.open(authUserId));
    if (this.failOpen !== null) return Promise.reject(this.failOpen);
    if (this.keyLostFor === authUserId) {
      return Promise.reject(new LocalKeyLostError(this.dataOf(authUserId).pending));
    }
    this.opened.push(authUserId);
    const store = new FakeLocalStore(this.dataOf(authUserId), authUserId, this);
    this.stores.push(store);
    return Promise.resolve(store);
  }

  forget(authUserId: string): Promise<void> {
    this.forgotten.push(authUserId);
    this.openAtForget.push(
      this.stores.filter((store) => !store.closed).map((store) => store.person),
    );
    this.people.delete(authUserId);
    return Promise.resolve();
  }

  /** La ultima base que se abrio, para ver si se cerro. */
  get lastStore(): FakeLocalStore {
    const store = this.stores.at(-1);
    if (store === undefined) throw new Error('No store was opened');
    return store;
  }
}

/** El puntero a la ultima persona, en memoria. */
export class MemoryPointer implements PersonPointer {
  constructor(private value: string | null = null) {}

  get(): string | null {
    return this.value;
  }

  set(authUserId: string): void {
    this.value = authUserId;
  }

  clear(): void {
    this.value = null;
  }
}

/** El registro de dispositivos del servidor, de mentira: reparte AA, AB... y es idempotente por el identificador. */
export class FakeDeviceRegistry implements DeviceRegistry {
  readonly calls: string[] = [];
  private readonly known = new Map<string, string>();
  /** Si se pone, el siguiente intento falla con este error (y se apaga). */
  failNext: Error | null = null;
  /** Lo que el servidor contesta como codigo, para probar respuestas que no sirven. */
  forceCode: string | null = null;
  /** Lo que el servidor contesta como identificador, para probar que no registro otro dispositivo. */
  forceId: string | null = null;
  /** Si se pone, el siguiente intento espera a que esta promesa se cumpla antes de contestar (y se apaga). */
  holdNext: Promise<void> | null = null;

  async register(id: string): Promise<RegisteredDevice> {
    this.calls.push(id);
    if (this.holdNext !== null) {
      const hold = this.holdNext;
      this.holdNext = null;
      await hold;
    }
    if (this.failNext !== null) {
      const error = this.failNext;
      this.failNext = null;
      throw error;
    }
    let code = this.known.get(id);
    if (code === undefined) {
      code = ['AA', 'AB', 'AC', 'AD'][this.known.size] ?? 'ZZ';
      this.known.set(id, code);
    }
    return { id: this.forceId ?? id, code: this.forceCode ?? code };
  }
}

/** Identificadores predecibles: `id-1`, `id-2`... (las pruebas no necesitan UUID de verdad). */
export class SequentialIds implements IdGenerator {
  private counter = 0;

  newId(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${String(this.counter).padStart(12, '0')}`;
  }
}
