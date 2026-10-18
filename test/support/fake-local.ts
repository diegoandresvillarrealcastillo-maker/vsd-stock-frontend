import { LocalKeyLostError } from '../../src/domain/model/local-errors';
import type { LocalProfile } from '../../src/domain/model/local-profile';
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
  pending: number;
}

/** La base de una persona en memoria. Hace lo mismo que el adaptador de IndexedDB, sin navegador. */
class FakeLocalStore implements LocalStore {
  closed = false;

  constructor(private readonly data: PersonData) {}

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

  claimDevice(candidate: DeviceRegistration): Promise<DeviceRegistration> {
    this.data.device ??= candidate;
    return Promise.resolve(this.data.device);
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
    return Promise.resolve(this.data.pending);
  }

  close(): void {
    this.closed = true;
  }
}

/** Las bases locales en memoria, una por persona, con el registro de lo que se abrio y se olvido. */
export class FakeLocalStores implements LocalStores {
  readonly people = new Map<string, PersonData>();
  readonly opened: string[] = [];
  readonly forgotten: string[] = [];
  readonly stores: FakeLocalStore[] = [];
  /** Si se pone, abrir una base espera a que esta promesa se cumpla (para ver el estado «abriendo»). */
  holdOpen: Promise<void> | null = null;
  /** Si se pone, abrir la base de esa persona falla con este error. */
  failOpen: Error | null = null;
  /** Si se pone, abrir la base de esa persona dice que la clave se perdio y quedan operaciones. */
  keyLostFor: string | null = null;

  dataOf(authUserId: string): PersonData {
    let data = this.people.get(authUserId);
    if (data === undefined) {
      data = { profile: null, device: null, serial: 0, pending: 0 };
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
    const store = new FakeLocalStore(this.dataOf(authUserId));
    this.stores.push(store);
    return Promise.resolve(store);
  }

  forget(authUserId: string): Promise<void> {
    this.forgotten.push(authUserId);
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

  register(id: string): Promise<RegisteredDevice> {
    this.calls.push(id);
    if (this.failNext !== null) {
      const error = this.failNext;
      this.failNext = null;
      return Promise.reject(error);
    }
    let code = this.known.get(id);
    if (code === undefined) {
      code = ['AA', 'AB', 'AC', 'AD'][this.known.size] ?? 'ZZ';
      this.known.set(id, code);
    }
    return Promise.resolve({ id, code: this.forceCode ?? code });
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
