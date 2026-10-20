// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Product } from '../../../domain/model/catalog';
import { NO_DOWNLOADS } from '../../../domain/model/read-copy';
import { AesGcmCipher } from './aes-gcm-cipher';
import { databaseName, type LocalSchema } from './idb-local-store';
import { IdbLocalStores } from './idb-local-stores';

const ANA = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const LUIS = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c';

const product = (n: number, change: Partial<Product> = {}): Product => ({
  id: `f0000000-0000-4000-8000-00000000000${String(n)}`,
  name: `Arroz de Doña Marta ${String(n)}`,
  sku: `ARR-${String(n)}`,
  barcode: null,
  unit: 'unit',
  unitPrice: 3_200,
  taxRateBp: 0,
  active: true,
  categoryId: null,
  minStockMilli: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-18T10:00:00.000Z'),
  ...change,
});

async function raw(authUserId: string) {
  return await openDB<LocalSchema>(databaseName(authUserId));
}

const stores = new IdbLocalStores();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('the copy of the catalog and the stock of a person', () => {
  describe('products', () => {
    it('keeps what came and gives it back whole, dates included', async () => {
      const store = await stores.open(ANA);
      const first = product(1, {
        barcode: '7701234567897',
        categoryId: 'c0000000-0000-4000-8000-000000000001',
        minStockMilli: 2_000,
      });

      await store.putProducts([first, product(2)]);

      const read = await store.readProducts();
      expect(read.sort((a, b) => a.sku.localeCompare(b.sku))).toEqual([first, product(2)]);
      store.close();
    });

    it('is nothing in a base where nothing was kept', async () => {
      const store = await stores.open(ANA);

      expect(await store.readProducts()).toEqual([]);
      store.close();
    });

    it('replaces a product that was already there by the one that changed later', async () => {
      const store = await stores.open(ANA);
      await store.putProducts([product(1, { unitPrice: 3_200 })]);

      await store.putProducts([
        product(1, { unitPrice: 3_500, updatedAt: new Date('2026-10-19T09:00:00.000Z') }),
      ]);

      expect((await store.readProducts()).map((item) => item.unitPrice)).toEqual([3_500]);
      store.close();
    });

    it('does not go back to an older version: the page of a minute earlier can arrive again', async () => {
      const store = await stores.open(ANA);
      await store.putProducts([
        product(1, { unitPrice: 3_500, updatedAt: new Date('2026-10-19T09:00:00.000Z') }),
      ]);

      await store.putProducts([product(1, { unitPrice: 3_200 })]);

      expect((await store.readProducts()).map((item) => item.unitPrice)).toEqual([3_500]);
      store.close();
    });

    it('takes the same version again without harm, and the archived ones with their mark', async () => {
      const store = await stores.open(ANA);
      const archived = product(1, { active: false });

      await store.putProducts([archived]);
      await store.putProducts([archived]);

      expect(await store.readProducts()).toEqual([archived]);
      store.close();
    });

    it('is encrypted: neither the name nor the code can be read on the disk, only the name of the record', async () => {
      const store = await stores.open(ANA);
      await store.putProducts([product(1, { barcode: '7701234567897' })]);
      store.close();

      const db = await raw(ANA);
      const record = (await db.getAll('records')).find((item) => item.name.startsWith('product:'))!;
      db.close();

      expect(record.name).toBe(`product:${product(1).id}`);
      const bytes = Array.from(new Uint8Array(record.data), (byte) =>
        String.fromCharCode(byte),
      ).join('');
      expect(bytes).not.toContain('Marta');
      expect(bytes).not.toContain('7701234567897');
    });

    it('does not give what can not be opened: a bit altered, a record at the place of another', async () => {
      const store = await stores.open(ANA);
      await store.putProducts([product(1), product(2), product(3)]);
      const db = await raw(ANA);
      const one = (await db.get('records', `product:${product(1).id}`))!;
      const two = (await db.get('records', `product:${product(2).id}`))!;
      const flipped = new Uint8Array(one.data);
      flipped[0] = (flipped[0] ?? 0) ^ 1;
      await db.put('records', { ...one, data: flipped.buffer });
      await db.put('records', { ...two, name: `product:${product(3).id}` });
      db.close();

      expect((await store.readProducts()).map((item) => item.id)).toEqual([product(2).id]);
      store.close();
    });

    it.each([
      ['a product that is not one', { id: 5 }],
      ['nothing', null],
      ['a list', []],
    ])('does not give what is inside and is %s', async (_name, wrong) => {
      const store = await stores.open(ANA);
      await store.putProducts([product(1), product(2)]);
      const db = await raw(ANA);
      const key = (await db.get('meta', 'key')) as CryptoKey;
      const name = `product:${product(1).id}`;
      await db.put('records', { name, ...(await new AesGcmCipher(key).seal(name, wrong)) });
      db.close();

      expect((await store.readProducts()).map((item) => item.id)).toEqual([product(2).id]);
      store.close();
    });

    it('keeps a version that is newer than what is stored even when what is stored can not be opened', async () => {
      const store = await stores.open(ANA);
      await store.putProducts([product(1, { unitPrice: 1_000 })]);
      const db = await raw(ANA);
      const one = (await db.get('records', `product:${product(1).id}`))!;
      const flipped = new Uint8Array(one.data);
      flipped[0] = (flipped[0] ?? 0) ^ 1;
      await db.put('records', { ...one, data: flipped.buffer });
      db.close();

      await store.putProducts([product(1, { unitPrice: 2_000 })]);

      expect((await store.readProducts()).map((item) => item.unitPrice)).toEqual([2_000]);
      store.close();
    });
  });

  describe('stock', () => {
    it('keeps the stock of each product, negative ones too', async () => {
      const store = await stores.open(ANA);

      await store.putStock([
        { productId: product(1).id, quantityMilli: 12_500 },
        { productId: product(2).id, quantityMilli: -2_000 },
      ]);

      expect(
        (await store.readStock()).sort((a, b) => a.productId.localeCompare(b.productId)),
      ).toEqual([
        { productId: product(1).id, quantityMilli: 12_500 },
        { productId: product(2).id, quantityMilli: -2_000 },
      ]);
      store.close();
    });

    it('is nothing in a base where nothing was kept', async () => {
      const store = await stores.open(ANA);

      expect(await store.readStock()).toEqual([]);
      store.close();
    });

    it('replaces what was there with the stock of now, whether it is more or less', async () => {
      const store = await stores.open(ANA);
      await store.putStock([{ productId: product(1).id, quantityMilli: 5_000 }]);

      await store.putStock([{ productId: product(1).id, quantityMilli: 1_000 }]);

      expect(await store.readStock()).toEqual([{ productId: product(1).id, quantityMilli: 1_000 }]);
      store.close();
    });

    it('keeps the stock apart from the products: one does not come out as the other', async () => {
      const store = await stores.open(ANA);
      await store.putProducts([product(1)]);
      await store.putStock([{ productId: product(1).id, quantityMilli: 3_000 }]);

      expect(await store.readProducts()).toHaveLength(1);
      expect(await store.readStock()).toHaveLength(1);
      store.close();
    });

    it('does not give what can not be opened or is not a stock level', async () => {
      const store = await stores.open(ANA);
      await store.putStock([
        { productId: product(1).id, quantityMilli: 1_000 },
        { productId: product(2).id, quantityMilli: 2_000 },
        { productId: product(3).id, quantityMilli: 3_000 },
      ]);
      const db = await raw(ANA);
      const key = (await db.get('meta', 'key')) as CryptoKey;
      const one = (await db.get('records', `stock:${product(1).id}`))!;
      const flipped = new Uint8Array(one.data);
      flipped[0] = (flipped[0] ?? 0) ^ 1;
      await db.put('records', { ...one, data: flipped.buffer });
      const name = `stock:${product(3).id}`;
      await db.put('records', {
        name,
        ...(await new AesGcmCipher(key).seal(name, { productId: 5 })),
      });
      db.close();

      expect(await store.readStock()).toEqual([{ productId: product(2).id, quantityMilli: 2_000 }]);
      store.close();
    });
  });

  describe('what was downloaded', () => {
    it('is nothing downloaded in a base where nothing was kept', async () => {
      const store = await stores.open(ANA);

      expect(await store.readCheckpoint()).toEqual(NO_DOWNLOADS);
      store.close();
    });

    it('keeps the hour of each download, apart from each other', async () => {
      const store = await stores.open(ANA);
      const checkpoint = {
        productsAsOf: new Date('2026-10-19T15:00:00.123Z'),
        stockAsOf: new Date('2026-10-19T15:00:05.456Z'),
      };

      await store.writeCheckpoint(checkpoint);

      expect(await store.readCheckpoint()).toEqual(checkpoint);
      await store.writeCheckpoint({ ...checkpoint, stockAsOf: null });
      expect(await store.readCheckpoint()).toEqual({ ...checkpoint, stockAsOf: null });
      store.close();
    });

    it.each([
      ['an hour that is not an hour', { productsAsOf: 'ayer', stockAsOf: null }],
      ['an hour that is not text', { productsAsOf: 5, stockAsOf: null }],
      ['something that is not an object', 5],
      ['nothing', null],
    ])('is nothing downloaded when what is stored has %s', async (_name, wrong) => {
      const store = await stores.open(ANA);
      const db = await raw(ANA);
      const key = (await db.get('meta', 'key')) as CryptoKey;
      await db.put('records', {
        name: 'copy-checkpoint',
        ...(await new AesGcmCipher(key).seal('copy-checkpoint', wrong)),
      });
      db.close();

      expect(await store.readCheckpoint()).toEqual(NO_DOWNLOADS);
      store.close();
    });

    it('does not read what another person stored', async () => {
      const ana = await stores.open(ANA);
      await ana.writeCheckpoint({
        productsAsOf: new Date('2026-10-19T15:00:00.000Z'),
        stockAsOf: null,
      });
      ana.close();
      const luis = await stores.open(LUIS);
      const anaDb = await raw(ANA);
      const stolen = (await anaDb.get('records', 'copy-checkpoint'))!;
      anaDb.close();
      const luisDb = await raw(LUIS);
      await luisDb.put('records', stolen);
      luisDb.close();

      expect(await luis.readCheckpoint()).toEqual(NO_DOWNLOADS);
      luis.close();
    });
  });

  describe('each person has their own', () => {
    it('does not show the products of another person', async () => {
      const ana = await stores.open(ANA);
      await ana.putProducts([product(1)]);
      ana.close();
      const luis = await stores.open(LUIS);

      expect(await luis.readProducts()).toEqual([]);
      luis.close();
    });

    it('is not mixed with the profile, the device or the queue that share the same store', async () => {
      const store = await stores.open(ANA);
      await store.writeProfile({
        authUserId: ANA,
        email: 'ana@ejemplo.co',
        userId: '11111111-1111-4111-8111-111111111111',
        businessId: '22222222-2222-4222-8222-222222222222',
        businessName: 'Tienda',
        role: 'cashier',
        fullName: 'Ana',
        verifiedAt: '2026-10-19T12:00:00.000Z',
      });
      await store.claimDevice({ id: '33333333-3333-4333-8333-333333333333', code: null });
      await store.putProducts([product(1)]);

      expect(await store.readProducts()).toHaveLength(1);
      expect(await store.readStock()).toEqual([]);
      store.close();
    });
  });
});
