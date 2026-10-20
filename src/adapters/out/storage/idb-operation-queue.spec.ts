// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AesGcmCipher } from './aes-gcm-cipher';
import type { NewOperation } from '../../../domain/model/outbox';
import { databaseName, type LocalSchema } from './idb-local-store';
import { IdbLocalStores } from './idb-local-stores';

const ANA = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const LUIS = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c';

const sale = (n: number, at = `2026-10-19T12:0${String(n)}:00.000Z`): NewOperation => ({
  operationId: `00000000-0000-4000-8000-00000000000${String(n)}`,
  kind: 'sale',
  body: {
    operationId: `00000000-0000-4000-8000-00000000000${String(n)}`,
    folio: `AA-00000${String(n)}`,
    total: 3_200 * n,
    cliente: 'Doña Marta',
  },
  createdAt: new Date(at),
});

/** Lo que hay EN EL DISCO de la base de una persona, sin pasar por la aplicacion. */
async function raw(authUserId: string) {
  return await openDB<LocalSchema>(databaseName(authUserId));
}

const stores = new IdbLocalStores();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('the queue of operations of a person', () => {
  describe('adding', () => {
    it('keeps the operation exactly as it will be sent, and asks nothing else of the caller', async () => {
      const store = await stores.open(ANA);

      await store.enqueue(sale(1));

      expect(await store.pendingOperations(10)).toEqual([
        {
          operationId: sale(1).operationId,
          kind: 'sale',
          shiftId: null,
          body: sale(1).body,
          createdAt: '2026-10-19T12:01:00.000Z',
          state: 'pending',
          attempts: 0,
          attention: null,
        },
      ]);
      store.close();
    });

    it('keeps the shift that a closing is for, apart from its body, as the batch sends it', async () => {
      const store = await stores.open(ANA);
      const closing: NewOperation = {
        operationId: '00000000-0000-4000-8000-0000000000c1',
        kind: 'shift-close',
        shiftId: '11111111-1111-4111-8111-111111111111',
        body: { operationId: '00000000-0000-4000-8000-0000000000c1', countedAmount: 57_000 },
        createdAt: new Date('2026-10-19T13:00:00.000Z'),
      };

      await store.enqueue(closing);

      expect(await store.pendingOperations(10)).toEqual([
        expect.objectContaining({
          kind: 'shift-close',
          shiftId: '11111111-1111-4111-8111-111111111111',
          body: closing.body,
        }),
      ]);
      store.close();
    });

    it('does not repeat an operation that is already there, nor undo what happened to it', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.recordAttempts([sale(1).operationId]);

      await store.enqueue(sale(1));

      const [only, ...rest] = await store.pendingOperations(10);
      expect(rest).toEqual([]);
      expect(only?.attempts).toBe(1);
      store.close();
    });

    it('counts what waits and what needs attention, each apart', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.enqueue(sale(2));
      await store.enqueue(sale(3));
      await store.markAttention(sale(2).operationId, { class: 'conflict', status: 409, code: 'x' });

      expect(await store.countPending()).toBe(2);
      expect(await store.countAttention()).toBe(1);
      store.close();
    });
  });

  describe('what is on the disk', () => {
    it('is encrypted: neither the body nor the kind can be read, only what is needed to find it', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      store.close();

      const db = await raw(ANA);
      const [record] = await db.getAll('operations');
      db.close();

      expect(Object.keys(record ?? {}).sort()).toEqual([
        'createdAt',
        'data',
        'iv',
        'operationId',
        'state',
      ]);
      const text = JSON.stringify(Array.from(new Uint8Array(record!.data)));
      expect(text).not.toContain('Marta');
      expect(record).toMatchObject({ state: 'pending', createdAt: '2026-10-19T12:01:00.000Z' });
    });

    it('does not open an operation that was altered by a single bit, nor one copied to the place of another', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.enqueue(sale(2));
      await store.enqueue(sale(3));
      const db = await raw(ANA);
      const one = (await db.get('operations', sale(1).operationId))!;
      const two = (await db.get('operations', sale(2).operationId))!;
      const flipped = new Uint8Array(one.data);
      flipped[0] = (flipped[0] ?? 0) ^ 1;
      await db.put('operations', { ...one, data: flipped.buffer });
      // La operacion 2 puesta en el lugar de la 3: cifrada de verdad, pero con otro nombre.
      await db.put('operations', { ...two, operationId: sale(3).operationId });
      db.close();

      // Solo la 2, que nadie toco, se abre; la 1 (un bit) y la 3 (cifrada con otro nombre) no.
      expect((await store.pendingOperations(10)).map((operation) => operation.operationId)).toEqual(
        [sale(2).operationId],
      );
      expect(await store.countPending()).toBe(3);
      store.close();
    });

    it.each([
      ['a kind that is not one of the three', { kind: 'refund' }],
      ['a shift that is not text', { shiftId: 5 }],
      ['no body', { body: undefined }],
      ['a body that is nothing', { body: null }],
      ['a body that is a text', { body: 'no es un cuerpo' }],
      ['a body that is a list', { body: [] }],
      ['attempts with decimals', { attempts: 1.5 }],
      ['negative attempts', { attempts: -1 }],
      ['attempts that are not a number', { attempts: '1' }],
      ['an attention that is not an object', { attention: 5 }],
      [
        'an attention of a class that does not exist',
        { attention: { class: 'transient', status: 409, code: null } },
      ],
      [
        'an attention whose status has decimals',
        { attention: { class: 'conflict', status: 409.5, code: null } },
      ],
      [
        'an attention whose status is not a number',
        { attention: { class: 'conflict', status: '409', code: null } },
      ],
      [
        'an attention whose code is not text',
        { attention: { class: 'conflict', status: 409, code: 5 } },
      ],
    ])('does not open an operation whose inside is not an operation: %s', async (_name, wrong) => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.enqueue(sale(2));
      const db = await raw(ANA);
      const key = (await db.get('meta', 'key')) as CryptoKey;
      const one = (await db.get('operations', sale(1).operationId))!;
      // Cifrada de verdad, con la clave y el nombre que le tocan, pero con un contenido que no es el de una operacion.
      const content = {
        kind: 'sale',
        shiftId: null,
        body: sale(1).body,
        attempts: 0,
        attention: null,
        ...wrong,
      };
      const sealed = await new AesGcmCipher(key).seal(`operation:${sale(1).operationId}`, content);
      await db.put('operations', { ...one, ...sealed });
      db.close();

      const operations = await store.pendingOperations(10);

      expect(operations.map((operation) => operation.operationId)).toEqual([sale(2).operationId]);
      expect(await store.countPending()).toBe(2);
      store.close();
    });

    it('does not open what another person encrypted', async () => {
      const ana = await stores.open(ANA);
      await ana.enqueue(sale(1));
      ana.close();
      const luis = await stores.open(LUIS);
      const anaDb = await raw(ANA);
      const stolen = (await anaDb.getAll('operations'))[0]!;
      anaDb.close();
      const luisDb = await raw(LUIS);
      await luisDb.put('operations', stolen);
      luisDb.close();

      expect(await luis.pendingOperations(10)).toEqual([]);
      luis.close();
    });
  });

  describe('reading', () => {
    it('gives the oldest first, whatever the order in which they were added', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(3, '2026-10-19T12:03:00.000Z'));
      await store.enqueue(sale(1, '2026-10-19T12:01:00.000Z'));
      await store.enqueue(sale(2, '2026-10-19T12:02:00.000Z'));

      const operations = await store.pendingOperations(10);

      expect(operations.map((operation) => operation.operationId)).toEqual([
        sale(1).operationId,
        sale(2).operationId,
        sale(3).operationId,
      ]);
      store.close();
    });

    it('breaks a tie by the identifier, so the order is the same every time', async () => {
      const store = await stores.open(ANA);
      const at = '2026-10-19T12:00:00.000Z';
      await store.enqueue(sale(2, at));
      await store.enqueue(sale(1, at));

      const operations = await store.pendingOperations(10);

      expect(operations.map((operation) => operation.operationId)).toEqual([
        sale(1).operationId,
        sale(2).operationId,
      ]);
      store.close();
    });

    it('gives no more than it was asked for, and the oldest of them', async () => {
      const store = await stores.open(ANA);
      for (const n of [1, 2, 3, 4]) await store.enqueue(sale(n));

      const operations = await store.pendingOperations(2);

      expect(operations.map((operation) => operation.operationId)).toEqual([
        sale(1).operationId,
        sale(2).operationId,
      ]);
      store.close();
    });

    it('leaves out what needs attention, and gives it apart', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.enqueue(sale(2));
      await store.markAttention(sale(1).operationId, {
        class: 'permanent',
        status: 400,
        code: 'validation-failed',
      });

      expect((await store.pendingOperations(10)).map((operation) => operation.operationId)).toEqual(
        [sale(2).operationId],
      );
      expect(await store.attentionOperations()).toEqual([
        expect.objectContaining({
          operationId: sale(1).operationId,
          state: 'attention',
          attention: { class: 'permanent', status: 400, code: 'validation-failed' },
        }),
      ]);
      store.close();
    });

    it('gives the ones that need attention oldest first as well', async () => {
      const store = await stores.open(ANA);
      for (const n of [2, 1, 3]) await store.enqueue(sale(n));
      for (const n of [3, 1]) {
        await store.markAttention(sale(n).operationId, {
          class: 'conflict',
          status: 409,
          code: null,
        });
      }

      const attention = await store.attentionOperations();

      expect(attention.map((operation) => operation.operationId)).toEqual([
        sale(1).operationId,
        sale(3).operationId,
      ]);
      store.close();
    });

    it('is nothing in a base where nothing was added', async () => {
      const store = await stores.open(ANA);

      expect(await store.pendingOperations(10)).toEqual([]);
      expect(await store.attentionOperations()).toEqual([]);
      expect(await store.countAttention()).toBe(0);
      store.close();
    });
  });

  describe('changing what can not be opened', () => {
    it('leaves alone an operation that can not be opened: it is neither changed nor does it break the others', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.enqueue(sale(2));
      const db = await raw(ANA);
      const one = (await db.get('operations', sale(1).operationId))!;
      const flipped = new Uint8Array(one.data);
      flipped[0] = (flipped[0] ?? 0) ^ 1;
      await db.put('operations', { ...one, data: flipped.buffer });
      db.close();

      await store.recordAttempts([sale(1).operationId, sale(2).operationId]);
      await store.markAttention(sale(1).operationId, {
        class: 'permanent',
        status: 400,
        code: null,
      });

      const after = await raw(ANA);
      const stillOne = (await after.get('operations', sale(1).operationId))!;
      after.close();
      expect(stillOne.state).toBe('pending');
      expect(new Uint8Array(stillOne.data)).toEqual(flipped);
      expect((await store.pendingOperations(10)).map((operation) => operation.attempts)).toEqual([
        1,
      ]);
      store.close();
    });

    it('does not bring back an operation that another tab took out while this one was rewriting it', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      // El original se toma de la descripcion de la propiedad: asi no se separa el metodo de su objeto.
      const seal = Object.getOwnPropertyDescriptor(AesGcmCipher.prototype, 'seal')!
        .value as AesGcmCipher['seal'];
      const spy = vi.spyOn(AesGcmCipher.prototype, 'seal').mockImplementation(async function (
        this: AesGcmCipher,
        name: string,
        value: unknown,
      ) {
        const sealed = await seal.call(this, name, value);
        // Otra pestaña ya la envio y la saco de la cola, justo mientras esta la reescribia.
        await store.resolveOperations([sale(1).operationId]);
        return sealed;
      });

      try {
        await store.recordAttempts([sale(1).operationId]);
      } finally {
        spy.mockRestore();
      }

      expect(await store.countPending()).toBe(0);
      expect(await store.pendingOperations(10)).toEqual([]);
      store.close();
    });
  });

  describe('changing', () => {
    it('removes what the server already has, only those, and does not fail for one that is not there', async () => {
      const store = await stores.open(ANA);
      for (const n of [1, 2, 3]) await store.enqueue(sale(n));

      await store.resolveOperations([sale(1).operationId, sale(3).operationId, 'no-esta']);

      expect((await store.pendingOperations(10)).map((operation) => operation.operationId)).toEqual(
        [sale(2).operationId],
      );
      store.close();
    });

    it('keeps why something needs attention, and keeps it away from the next batch', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));

      await store.markAttention(sale(1).operationId, {
        class: 'conflict',
        status: 409,
        code: 'shift-already-open',
      });

      expect(await store.pendingOperations(10)).toEqual([]);
      expect(await store.attentionOperations()).toEqual([
        expect.objectContaining({
          attention: { class: 'conflict', status: 409, code: 'shift-already-open' },
          body: sale(1).body,
        }),
      ]);
      store.close();
    });

    it('counts the attempts, one for each time it was sent and did not work', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      await store.enqueue(sale(2));

      await store.recordAttempts([sale(1).operationId, sale(2).operationId]);
      await store.recordAttempts([sale(1).operationId]);

      const attempts = (await store.pendingOperations(10)).map((operation) => operation.attempts);
      expect(attempts).toEqual([2, 1]);
      store.close();
    });

    it('does nothing to an operation that is not there', async () => {
      const store = await stores.open(ANA);

      await store.markAttention('no-esta', { class: 'permanent', status: 400, code: null });
      await store.recordAttempts(['no-esta']);

      expect(await store.countPending()).toBe(0);
      expect(await store.countAttention()).toBe(0);
      store.close();
    });

    it('keeps what the others did: it is the operation that changes, never the queue', async () => {
      const store = await stores.open(ANA);
      for (const n of [1, 2]) await store.enqueue(sale(n));

      await store.markAttention(sale(1).operationId, {
        class: 'permanent',
        status: 400,
        code: null,
      });
      await store.recordAttempts([sale(2).operationId]);

      expect(await store.pendingOperations(10)).toEqual([
        expect.objectContaining({ operationId: sale(2).operationId, attempts: 1 }),
      ]);
      store.close();
    });
  });

  describe('when a person is forgotten', () => {
    it('goes with the base: nothing of the queue stays', async () => {
      const store = await stores.open(ANA);
      await store.enqueue(sale(1));
      store.close();

      await stores.forget(ANA);
      const fresh = await stores.open(ANA);

      expect(await fresh.pendingOperations(10)).toEqual([]);
      fresh.close();
    });
  });
});
