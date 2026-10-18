// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalKeyLostError,
  LocalStorageUnavailableError,
} from '../../../domain/model/local-errors';
import type { LocalProfile } from '../../../domain/model/local-profile';
import type { LocalStore } from '../../../domain/ports/out/local-store';
import { generateKey } from './aes-gcm-cipher';
import { databaseName, openLocalDatabase, type LocalSchema } from './idb-local-store';
import { IdbLocalStores } from './idb-local-stores';

const ANA = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const LUIS = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c';

const profile: LocalProfile = {
  authUserId: ANA,
  email: 'ana@ejemplo.co',
  userId: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  businessName: 'Tienda La Esquina',
  role: 'cashier',
  fullName: 'Ana Gómez Villarreal',
  verifiedAt: '2026-10-19T12:00:00.000Z',
};

/** Lo que hay EN EL DISCO de la base de una persona, sin pasar por la aplicacion: lo que vería quien lee los archivos. */
async function raw(authUserId: string) {
  return await openDB<LocalSchema>(databaseName(authUserId));
}

const stores = new IdbLocalStores();

beforeEach(() => {
  // Un navegador nuevo en cada prueba: ninguna base de la anterior.
  globalThis.indexedDB = new IDBFactory();
});

describe('the local database of a person', () => {
  describe('opening it', () => {
    it('is named after the identifier of the person, never after their name or email', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile(profile);

      const names = (await indexedDB.databases()).map((db) => db.name);

      expect(names).toEqual([`vsd-stock-${ANA}`]);
      expect(JSON.stringify(names)).not.toContain('ana@ejemplo.co');
      expect(JSON.stringify(names)).not.toContain('Ana');
      store.close();
    });

    it('makes a key of 256 bits for AES-GCM that can not be exported, and keeps it in the base', async () => {
      (await stores.open(ANA)).close();

      const db = await raw(ANA);
      const key = (await db.get('meta', 'key')) as CryptoKey;
      db.close();

      expect(key.algorithm).toEqual({ name: 'AES-GCM', length: 256 });
      expect(key.extractable).toBe(false);
      expect(key.usages.sort()).toEqual(['decrypt', 'encrypt']);
      await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    });

    it('keeps the same key when it is opened again, so what was saved can still be read', async () => {
      const first = await stores.open(ANA);
      await first.writeProfile(profile);
      first.close();

      const second = await stores.open(ANA);

      expect(await second.readProfile()).toEqual(profile);
      second.close();
    });

    it('gives each person their own base and their own key', async () => {
      const ana = await stores.open(ANA);
      const luis = await stores.open(LUIS);
      await ana.writeProfile(profile);

      expect(await luis.readProfile()).toBeNull();
      ana.close();
      luis.close();
      const keys = await Promise.all(
        [ANA, LUIS].map(async (id) => {
          const db = await raw(id);
          const key = await db.get('meta', 'key');
          db.close();
          return key;
        }),
      );
      expect(keys[0]).not.toBe(keys[1]);
    });

    it('makes one key only when two tabs open an empty base at the same time', async () => {
      const generate = vi.fn(generateKey);

      const [a, b] = await Promise.all([
        openLocalDatabase(ANA, generate),
        openLocalDatabase(ANA, generate),
      ]);

      // Las dos pestañas terminan con la MISMA clave: la que se guardo primero.
      const stored = (await a.db.get('meta', 'key')) as CryptoKey;
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: new Uint8Array(12) },
        a.key,
        new Uint8Array([1, 2, 3]),
      );
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, b.key, encrypted),
      ).resolves.toBeDefined();
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, stored, encrypted),
      ).resolves.toBeDefined();
      a.db.close();
      b.db.close();
    });

    it('refuses an identifier that is not one: nobody names a base after anything', async () => {
      await expect(stores.open('../otra')).rejects.toBeInstanceOf(RangeError);
      await expect(stores.open('ana@ejemplo.co')).rejects.toBeInstanceOf(RangeError);
      await expect(stores.open('')).rejects.toBeInstanceOf(RangeError);
    });

    it('says so when the browser has no IndexedDB, or no WebCrypto because the page is not secure', async () => {
      const noDatabase = new IdbLocalStores(() => ({
        indexedDB: undefined,
        subtle: crypto.subtle,
      }));
      const noCrypto = new IdbLocalStores(() => ({ indexedDB, subtle: undefined }));

      await expect(noDatabase.open(ANA)).rejects.toBeInstanceOf(LocalStorageUnavailableError);
      await expect(noCrypto.open(ANA)).rejects.toThrow(/HTTPS/);
      await expect(noDatabase.forget(ANA)).rejects.toBeInstanceOf(LocalStorageUnavailableError);
    });

    it('says so when the browser does not let it open the base (a private window)', async () => {
      const refusing = {
        open: () => {
          throw new DOMException('The operation is insecure', 'SecurityError');
        },
        databases: () => Promise.resolve([]),
      } as unknown as IDBFactory;
      const blocked = new IdbLocalStores(() => ({ indexedDB: refusing, subtle: crypto.subtle }));
      const original = globalThis.indexedDB;
      globalThis.indexedDB = refusing;

      try {
        await expect(blocked.open(ANA)).rejects.toBeInstanceOf(LocalStorageUnavailableError);
      } finally {
        globalThis.indexedDB = original;
      }
    });
  });

  describe('what is kept on the disk', () => {
    it('is encrypted: nothing of the person can be read from the records', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile(profile);
      await store.claimDevice({ id: 'dispositivo-secreto-123', code: 'AA' });
      store.close();

      const db = await raw(ANA);
      const records = await db.getAll('records');
      db.close();

      expect(records.map((record) => record.name).sort()).toEqual(['device', 'profile']);
      for (const record of records) {
        expect(Object.keys(record).sort()).toEqual(['data', 'iv', 'name']);
        const text = new TextDecoder('latin1').decode(record.data);
        for (const secret of [
          'Gómez',
          'Ana',
          'ana@ejemplo.co',
          'Esquina',
          'dispositivo-secreto',
          'cashier',
        ]) {
          expect(text).not.toContain(secret);
        }
        expect(record.iv).toHaveLength(12);
      }
    });

    it('never repeats a vector or a ciphertext, even when the same thing is written many times', async () => {
      const store = await stores.open(ANA);
      for (let i = 0; i < 60; i += 1) await store.writeProfile(profile);
      store.close();
      const db = await raw(ANA);
      const first = await db.get('records', 'profile');
      db.close();

      // Sellar 60 veces lo mismo: se compara con otras 59 pasadas por el mismo camino.
      const seals = new Set<string>();
      const again = await stores.open(ANA);
      for (let i = 0; i < 60; i += 1) {
        await again.writeProfile(profile);
        const reader = await raw(ANA);
        const record = await reader.get('records', 'profile');
        reader.close();
        seals.add(`${[...record!.iv].join(',')}|${[...new Uint8Array(record!.data)].join(',')}`);
      }
      again.close();

      expect(seals.size).toBe(60);
      expect(first).toBeDefined();
    });

    it('does not open a record that was altered by a single bit', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile(profile);
      const db = await raw(ANA);
      const record = (await db.get('records', 'profile'))!;
      const altered = new Uint8Array(record.data.slice(0));
      altered[3] = (altered[3] ?? 0) ^ 1;
      await db.put('records', { ...record, data: altered.buffer });
      db.close();

      expect(await store.readProfile()).toBeNull();
      store.close();
    });

    it('does not open a record that was copied to the place of another', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile(profile);
      await store.claimDevice({ id: 'dev-1', code: 'AA' });
      const db = await raw(ANA);
      const profileRecord = (await db.get('records', 'profile'))!;
      // El perfil, cifrado de verdad, puesto donde va el dispositivo.
      await db.put('records', { ...profileRecord, name: 'device' });
      db.close();

      expect(await store.readDevice()).toBeNull();
      store.close();
    });

    it('does not open what another person encrypted, even with the same record name', async () => {
      const ana = await stores.open(ANA);
      await ana.writeProfile(profile);
      ana.close();
      const luis = await stores.open(LUIS);
      const anaDb = await raw(ANA);
      const stolen = (await anaDb.get('records', 'profile'))!;
      anaDb.close();
      const luisDb = await raw(LUIS);
      await luisDb.put('records', stolen);
      luisDb.close();

      expect(await luis.readProfile()).toBeNull();
      luis.close();
    });

    it('gives nothing, instead of failing, for a profile that has the wrong shape', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile({ ...profile, role: 'superuser' } as unknown as LocalProfile);

      expect(await store.readProfile()).toBeNull();
      store.close();
    });
  });

  describe('the folio series', () => {
    it('starts at one and only grows', async () => {
      const store = await stores.open(ANA);

      expect([
        await store.reserveSerial(),
        await store.reserveSerial(),
        await store.reserveSerial(),
      ]).toEqual([1, 2, 3]);
      store.close();
    });

    it('goes on from where it was after closing and opening the base', async () => {
      const first = await stores.open(ANA);
      await first.reserveSerial();
      await first.reserveSerial();
      first.close();

      const second = await stores.open(ANA);

      expect(await second.reserveSerial()).toBe(3);
      second.close();
    });

    it('is kept in the clear, with nothing personal: it is only a number', async () => {
      const store = await stores.open(ANA);
      await store.reserveSerial();
      store.close();

      const db = await raw(ANA);
      expect(await db.get('meta', 'serial')).toBe(1);
      db.close();
    });

    it('never repeats a number when many tabs ask at once', async () => {
      const tabs: LocalStore[] = await Promise.all([
        stores.open(ANA),
        stores.open(ANA),
        stores.open(ANA),
      ]);

      const numbers = await Promise.all(
        Array.from({ length: 45 }, (_, index) => tabs[index % 3]!.reserveSerial()),
      );

      expect([...numbers].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 45 }, (_, i) => i + 1),
      );
      for (const tab of tabs) tab.close();
    });

    it('does not start again for another person: each one has their own series', async () => {
      const ana = await stores.open(ANA);
      const luis = await stores.open(LUIS);
      await ana.reserveSerial();
      await ana.reserveSerial();

      expect(await luis.reserveSerial()).toBe(1);
      ana.close();
      luis.close();
    });
  });

  describe('the device', () => {
    it('is nothing until it is claimed', async () => {
      const store = await stores.open(ANA);

      expect(await store.readDevice()).toBeNull();
      store.close();
    });

    it('is the first one that was claimed, whoever comes later', async () => {
      const store = await stores.open(ANA);

      const first = await store.claimDevice({ id: 'primero', code: null });
      const second = await store.claimDevice({ id: 'segundo', code: null });

      expect(first).toEqual({ id: 'primero', code: null });
      expect(second).toEqual({ id: 'primero', code: null });
      store.close();
    });

    it('ends up the same for two tabs that claim at once', async () => {
      const a = await stores.open(ANA);
      const b = await stores.open(ANA);

      const [x, y] = await Promise.all([
        a.claimDevice({ id: 'de-a', code: null }),
        b.claimDevice({ id: 'de-b', code: null }),
      ]);

      expect(x).toEqual(y);
      a.close();
      b.close();
    });

    it('keeps the code that the server gave', async () => {
      const store = await stores.open(ANA);
      await store.claimDevice({ id: 'dev-1', code: null });

      await store.completeDevice({ id: 'dev-1', code: 'AB' });

      expect(await store.readDevice()).toEqual({ id: 'dev-1', code: 'AB' });
      expect((await store.claimDevice({ id: 'otro', code: null })).code).toBe('AB');
      store.close();
    });

    it('is replaced by the new candidate when the one that was kept can not be opened', async () => {
      const store = await stores.open(ANA);
      await store.claimDevice({ id: 'dañado', code: null });
      const db = await raw(ANA);
      const record = (await db.get('records', 'device'))!;
      await db.put('records', { ...record, data: new Uint8Array([1, 2, 3]).buffer });
      db.close();

      const claimed = await store.claimDevice({ id: 'nuevo', code: null });

      expect(claimed).toEqual({ id: 'nuevo', code: null });
      expect(await store.readDevice()).toEqual({ id: 'nuevo', code: null });
      store.close();
    });

    it('is nothing when what was kept is not a device', async () => {
      const store = await stores.open(ANA);
      await store.completeDevice({ id: 5 as unknown as string, code: 'AA' });

      expect(await store.readDevice()).toBeNull();
      store.close();
    });
  });

  describe('what is waiting to be sent', () => {
    const queue = async (states: ('pending' | 'attention')[]) => {
      const db = await raw(ANA);
      for (const [index, state] of states.entries()) {
        await db.put('operations', {
          operationId: `op-${String(index)}`,
          state,
          createdAt: '2026-10-19T12:00:00.000Z',
          iv: new Uint8Array(12),
          data: new ArrayBuffer(16),
        });
      }
      db.close();
    };

    it('is nothing in a new base', async () => {
      const store = await stores.open(ANA);

      expect(await store.countPending()).toBe(0);
      store.close();
    });

    it('counts the operations that wait, and not those that need attention', async () => {
      (await stores.open(ANA)).close();
      await queue(['pending', 'attention', 'pending', 'pending']);
      const store = await stores.open(ANA);

      expect(await store.countPending()).toBe(3);
      store.close();
    });
  });

  describe('when the key is lost', () => {
    const loseTheKey = async () => {
      const db = await raw(ANA);
      await db.delete('meta', 'key');
      db.close();
    };

    it('does not open with a new key if there are operations waiting: they would be lost without anyone knowing', async () => {
      const store = await stores.open(ANA);
      store.close();
      const db = await raw(ANA);
      await db.put('operations', {
        operationId: 'op-1',
        state: 'pending',
        createdAt: '2026-10-19T12:00:00.000Z',
        iv: new Uint8Array(12),
        data: new ArrayBuffer(16),
      });
      db.close();
      await loseTheKey();

      await expect(stores.open(ANA)).rejects.toMatchObject({
        name: 'LocalKeyLostError',
        pending: 1,
      });
      await expect(stores.open(ANA)).rejects.toBeInstanceOf(LocalKeyLostError);
    });

    it('makes a new key when nothing is waiting, and throws away the records it can no longer open', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile(profile);
      store.close();
      await loseTheKey();

      const again = await stores.open(ANA);

      expect(await again.readProfile()).toBeNull();
      const db = await raw(ANA);
      expect(await db.count('records')).toBe(0);
      db.close();
      again.close();
    });
  });

  describe('forgetting', () => {
    it('deletes the base with the key and everything in it, in one step', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile(profile);
      await store.reserveSerial();
      store.close();

      await stores.forget(ANA);

      expect(await indexedDB.databases()).toEqual([]);
    });

    it('leaves the base of every other person alone', async () => {
      (await stores.open(ANA)).close();
      const luis = await stores.open(LUIS);
      await luis.writeProfile({ ...profile, authUserId: LUIS });
      luis.close();

      await stores.forget(ANA);

      expect((await indexedDB.databases()).map((db) => db.name)).toEqual([databaseName(LUIS)]);
    });

    it('makes a copy of the old ciphertext useless: the new key does not open it', async () => {
      const first = await stores.open(ANA);
      await first.writeProfile(profile);
      first.close();
      const before = await raw(ANA);
      const copy = (await before.get('records', 'profile'))!;
      before.close();

      await stores.forget(ANA);
      const fresh = await stores.open(ANA);
      const db = await raw(ANA);
      await db.put('records', copy);
      db.close();

      expect(await fresh.readProfile()).toBeNull();
      fresh.close();
    });

    it('starts the series over, as a base that never existed: a new device is registered then (ADR 0016)', async () => {
      const first = await stores.open(ANA);
      await first.reserveSerial();
      await first.reserveSerial();
      first.close();

      await stores.forget(ANA);
      const fresh = await stores.open(ANA);

      expect(await fresh.reserveSerial()).toBe(1);
      expect(await fresh.readDevice()).toBeNull();
      fresh.close();
    });

    it('works even if another tab still has the base open: that tab lets go', async () => {
      const other = await stores.open(ANA);

      await stores.forget(ANA);

      expect(await indexedDB.databases()).toEqual([]);
      other.close();
    });

    it('is not an error to forget a person who never had a base', async () => {
      await expect(stores.forget(LUIS)).resolves.toBeUndefined();
    });
  });
});
