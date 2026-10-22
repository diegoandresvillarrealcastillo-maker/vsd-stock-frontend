import { deleteDB } from 'idb';
import { LocalStorageUnavailableError } from '../../../domain/model/local-errors';
import type { LocalStore, LocalStores } from '../../../domain/ports/out/local-store';
import { generateKey } from './aes-gcm-cipher';
import { IdbLocalStore, databaseName, openLocalDatabase } from './idb-local-store';

/** Un identificador de persona valido para dar nombre a una base: letras, numeros y guiones, ni mas ni menos que un UUID. */
const PERSON_ID = /^[0-9a-zA-Z-]{8,64}$/;

/** Cuanto se espera a que otras pestañas suelten la base que se quiere borrar, antes de rendirse. */
const FORGET_PATIENCE_MS = 5_000;

/** Lo que el navegador ofrece: se pasa de afuera para poder probar un navegador al que le falta algo. */
export interface StorageEnvironment {
  readonly indexedDB: IDBFactory | undefined;
  readonly subtle: SubtleCrypto | undefined;
}

/** Las bases locales de las personas sobre IndexedDB, con una por persona y su propia clave (ADR 0018). */
export class IdbLocalStores implements LocalStores {
  constructor(private readonly environment: () => StorageEnvironment = browserEnvironment) {}

  async open(authUserId: string): Promise<LocalStore> {
    this.assertAvailable();
    assertPerson(authUserId);
    try {
      const { db, key } = await openLocalDatabase(authUserId, generateKey);
      return new IdbLocalStore(db, key);
    } catch (error) {
      // Firefox en una ventana privada y algunos navegadores con el almacenamiento bloqueado fallan al abrir la base.
      if (error instanceof DOMException) {
        throw new LocalStorageUnavailableError(`${error.name}: ${error.message}`);
      }
      throw error;
    }
  }

  async forget(authUserId: string): Promise<void> {
    this.assertAvailable();
    assertPerson(authUserId);
    let blocked = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const patience = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        if (blocked) reject(new Error('Another tab keeps the local database open'));
      }, FORGET_PATIENCE_MS);
    });
    try {
      await Promise.race([
        deleteDB(databaseName(authUserId), {
          blocked() {
            blocked = true;
          },
        }),
        patience,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  private assertAvailable(): void {
    const { indexedDB, subtle } = this.environment();
    if (indexedDB === undefined) throw new LocalStorageUnavailableError('IndexedDB is missing');
    if (subtle === undefined) {
      throw new LocalStorageUnavailableError('WebCrypto is missing (it needs HTTPS)');
    }
  }
}

function assertPerson(authUserId: string): void {
  if (!PERSON_ID.test(authUserId)) {
    throw new RangeError('A local database is named after the identifier of a person');
  }
}

function browserEnvironment(): StorageEnvironment {
  return {
    indexedDB: typeof indexedDB === 'undefined' ? undefined : indexedDB,
    subtle: typeof crypto === 'undefined' ? undefined : crypto.subtle,
  };
}
