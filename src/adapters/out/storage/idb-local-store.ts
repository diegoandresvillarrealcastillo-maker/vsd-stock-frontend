import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { LocalKeyLostError } from '../../../domain/model/local-errors';
import { parseProfile, type LocalProfile } from '../../../domain/model/local-profile';
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
const SERIAL = 'serial';
const PROFILE = 'profile';
const DEVICE = 'device';

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

  close(): void {
    this.db.close();
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
  private async openOrUndefined(name: string, stored: SealedRecord): Promise<unknown> {
    try {
      return await this.cipher.open(name, stored);
    } catch (error) {
      if (error instanceof RecordUnreadableError) return undefined;
      throw error;
    }
  }
}

function parseDevice(value: unknown): DeviceRegistration | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, code } = value as { id?: unknown; code?: unknown };
  if (typeof id !== 'string' || (code !== null && typeof code !== 'string')) return null;
  return { id, code };
}
