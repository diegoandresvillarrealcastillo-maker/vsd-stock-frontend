// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewOperation } from '../../../domain/model/outbox';
import { NO_SALES, type LocalShift } from '../../../domain/model/shift';
import { AesGcmCipher } from './aes-gcm-cipher';
import { databaseName, type LocalSchema } from './idb-local-store';
import { IdbLocalStores } from './idb-local-stores';

const ANA = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const LUIS = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c';

const OPENED: LocalShift = {
  shiftId: '5b0c8a7e-0000-4000-8000-000000000001',
  deviceId: '5b0c8a7e-0000-4000-8000-0000000000d1',
  openOperationId: '5b0c8a7e-0000-4000-8000-0000000000a1',
  openedAt: '2026-10-19T13:02:00.000Z',
  openingAmount: 50_000,
  sales: NO_SALES,
  closing: null,
};

const opening: NewOperation = {
  operationId: OPENED.openOperationId,
  kind: 'shift-open',
  body: { operationId: OPENED.openOperationId, openingAmount: 50_000, shiftId: OPENED.shiftId },
  createdAt: new Date('2026-10-19T13:02:00.000Z'),
};

const CLOSED: LocalShift = {
  ...OPENED,
  closing: {
    operationId: '5b0c8a7e-0000-4000-8000-0000000000a2',
    closedAt: '2026-10-19T23:15:00.000Z',
    countedAmount: 168_000,
  },
};

const closing: NewOperation = {
  operationId: CLOSED.closing!.operationId,
  kind: 'shift-close',
  shiftId: OPENED.shiftId,
  body: { operationId: CLOSED.closing!.operationId, countedAmount: 168_000 },
  createdAt: new Date('2026-10-19T23:15:00.000Z'),
};

async function raw(authUserId: string) {
  return await openDB<LocalSchema>(databaseName(authUserId));
}

const stores = new IdbLocalStores();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('the shift of a person in this device', () => {
  it('is nothing in a base where no shift was ever opened', async () => {
    const store = await stores.open(ANA);

    expect(await store.readCurrentShift()).toBeNull();
    store.close();
  });

  it('keeps the shift and its operation together, and gives both back', async () => {
    const store = await stores.open(ANA);

    await store.saveShift(OPENED, opening);

    expect(await store.readCurrentShift()).toEqual(OPENED);
    expect(await store.pendingOperations(10)).toEqual([
      {
        operationId: opening.operationId,
        kind: 'shift-open',
        shiftId: null,
        body: opening.body,
        createdAt: '2026-10-19T13:02:00.000Z',
        state: 'pending',
        attempts: 0,
        attention: null,
      },
    ]);
    store.close();
  });

  it('is the closed shift once it is closed, and the closing waits next to the opening', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(OPENED, opening);

    await store.saveShift(CLOSED, closing);

    expect(await store.readCurrentShift()).toEqual(CLOSED);
    const waiting = await store.pendingOperations(10);
    expect(waiting.map((operation) => operation.kind)).toEqual(['shift-open', 'shift-close']);
    expect(waiting[1]?.shiftId).toBe(OPENED.shiftId);
    store.close();
  });

  it('keeps the order in which they were saved, even when the clock of the device went back in between', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(OPENED, opening);

    await store.saveShift(CLOSED, { ...closing, createdAt: new Date('2026-10-19T12:00:00.000Z') });

    const waiting = await store.pendingOperations(10);
    expect(waiting.map((operation) => operation.kind)).toEqual(['shift-open', 'shift-close']);
    store.close();
  });

  it('is the one that was opened last: a new shift takes the place of the one that was closed', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(CLOSED, closing);
    const next: LocalShift = {
      ...OPENED,
      shiftId: '5b0c8a7e-0000-4000-8000-000000000002',
      openOperationId: '5b0c8a7e-0000-4000-8000-0000000000a3',
    };

    await store.saveShift(next, {
      ...opening,
      operationId: next.openOperationId,
      createdAt: new Date('2026-10-20T13:00:00.000Z'),
    });

    expect(await store.readCurrentShift()).toEqual(next);
    expect(await store.countPending()).toBe(2);
    store.close();
  });

  it('does not repeat an operation that was already in the queue, nor undo what happened to it', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(OPENED, opening);
    await store.markAttention(opening.operationId, { class: 'conflict', status: 409, code: 'x' });

    await store.saveShift({ ...OPENED, openingAmount: 60_000 }, opening);

    expect(await store.countPending()).toBe(0);
    expect(await store.countAttention()).toBe(1);
    expect((await store.readCurrentShift())?.openingAmount).toBe(60_000);
    store.close();
  });

  it('keeps neither the shift nor the operation when the operation can not be kept', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(OPENED, opening);

    await expect(
      store.saveShift(CLOSED, { ...closing, operationId: undefined as unknown as string }),
    ).rejects.toThrow();

    expect(await store.readCurrentShift()).toEqual(OPENED);
    expect(await store.countPending()).toBe(1);
    store.close();
  });

  it('is encrypted: neither the cash nor the shift can be read on the disk', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(CLOSED, opening);
    store.close();

    const db = await raw(ANA);
    const record = (await db.getAll('records')).find((item) => item.name === 'shift')!;
    const operations = await db.getAll('operations');
    db.close();

    const bytes = (data: ArrayBuffer) =>
      Array.from(new Uint8Array(data), (byte) => String.fromCharCode(byte)).join('');
    expect(bytes(record.data)).not.toContain('168000');
    expect(bytes(record.data)).not.toContain(OPENED.shiftId);
    expect(bytes(operations[0]!.data)).not.toContain('50000');
  });

  it('does not give what can not be opened: a bit altered', async () => {
    const store = await stores.open(ANA);
    await store.saveShift(OPENED, opening);
    const db = await raw(ANA);
    const stored = (await db.get('records', 'shift'))!;
    const flipped = new Uint8Array(stored.data);
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    await db.put('records', { ...stored, data: flipped.buffer });
    db.close();

    expect(await store.readCurrentShift()).toBeNull();
    store.close();
  });

  it.each([
    ['a shift that is not one', { shiftId: 5 }],
    ['nothing', null],
    ['a list', []],
  ])('does not give what is inside and is %s', async (_name, wrong) => {
    const store = await stores.open(ANA);
    await store.saveShift(OPENED, opening);
    const db = await raw(ANA);
    const stored = (await db.get('records', 'shift'))!;
    const key = await db.get('meta', 'key');
    db.close();
    const cipher = new AesGcmCipher(key as CryptoKey);
    const forged = await cipher.seal('shift', wrong);
    const again = await raw(ANA);
    await again.put('records', { name: stored.name, ...forged });
    again.close();

    expect(await store.readCurrentShift()).toBeNull();
    store.close();
  });

  it('is of the person who works, and of nobody else', async () => {
    const ana = await stores.open(ANA);
    await ana.saveShift(OPENED, opening);
    ana.close();

    const luis = await stores.open(LUIS);
    expect(await luis.readCurrentShift()).toBeNull();
    luis.close();
  });

  describe('where an operation is', () => {
    it('is waiting, needing attention, or not there any more', async () => {
      const store = await stores.open(ANA);
      await store.saveShift(OPENED, opening);
      await store.saveShift(CLOSED, closing);
      await store.markAttention(closing.operationId, {
        class: 'permanent',
        status: 422,
        code: null,
      });

      expect(await store.operationState(opening.operationId)).toBe('pending');
      expect(await store.operationState(closing.operationId)).toBe('attention');

      await store.resolveOperations([opening.operationId]);
      expect(await store.operationState(opening.operationId)).toBeNull();
      expect(await store.operationState('00000000-0000-4000-8000-00000000ffff')).toBeNull();
      store.close();
    });
  });
});
