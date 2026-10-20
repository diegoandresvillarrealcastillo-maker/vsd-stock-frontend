import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/model/catalog';
import { NoWorkspaceError } from '../../domain/model/local-errors';
import { indexProducts } from '../../domain/model/product-search';
import { NO_DOWNLOADS, type CopyPage } from '../../domain/model/read-copy';
import { testMe } from '../../../test/support/auth';
import { settle } from '../../../test/support/connection';
import { deferred } from '../../../test/support/deferred';
import {
  copiedProduct,
  createTestCopy,
  hooking,
  overStorage,
  page,
  stockOfProduct,
  type TestCopy,
} from '../../../test/support/fake-copy';
import { failure } from '../../../test/support/fake-sync';

// Se cuenta cuantas veces se arma el indice de busqueda, sin cambiar lo que hace.
vi.mock('../../domain/model/product-search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/model/product-search')>();
  return { ...actual, indexProducts: vi.fn(actual.indexProducts) };
});

const FIRST = new Date('2026-10-19T12:00:00.000Z');
const SECOND = new Date('2026-10-19T12:00:07.000Z');
const LATER = new Date('2026-10-19T13:30:00.000Z');

/** Deja guardado, en la base de quien trabaja, lo que una descarga anterior dejo. */
async function saved(t: TestCopy, products: number[], stock: [number, number][] = []) {
  const copy = t.local.workspace.copy();
  await copy.putProducts(products.map((n) => copiedProduct(n)));
  await copy.putStock(stock.map(([n, quantity]) => stockOfProduct(n, quantity)));
  await copy.writeCheckpoint({ productsAsOf: FIRST, stockAsOf: SECOND });
}

describe('ReadCopyUseCase', () => {
  describe('what was sold in this device', () => {
    it('takes it out of the stock the screen shows, without waiting for the server', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(
        t,
        [1, 2],
        [
          [1, 5_000],
          [2, 8_000],
        ],
      );
      t.copy.start();
      await settle();

      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 2_000 }]);

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(3_000);
      expect(t.copy.stockOf(copiedProduct(2).id)).toBe(8_000);
    });

    it('lets it go below zero: a sale without stock is accepted and marked', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1], [[1, 1_000]]);
      t.copy.start();
      await settle();

      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 3_000 }]);

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(-2_000);
    });

    it('does not invent a stock while the stock was never downloaded: there is nothing to take it out of', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await t.local.workspace.copy().putProducts([copiedProduct(1)]);
      await t.local.workspace.copy().writeCheckpoint({ productsAsOf: FIRST, stockAsOf: null });
      t.copy.start();
      await settle();

      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 1_000 }]);

      expect(t.copy.stockOf(copiedProduct(1).id)).toBeNull();
    });

    it('takes it from nothing for a product the server has no stock of, once the stock was downloaded', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1], []);
      t.copy.start();
      await settle();

      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 1_000 }]);

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(-1_000);
    });

    it('adds up what is sold of the same product twice in a row', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1], [[1, 10_000]]);
      t.copy.start();
      await settle();

      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 1_000 }]);
      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 2_000 }]);

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(7_000);
    });

    it('keeps it saved, so closing and opening the application does not bring the old stock back', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1], [[1, 5_000]]);
      t.copy.start();
      await settle();

      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 2_000 }]);

      expect(await t.local.workspace.copy().readStock()).toEqual([
        { productId: copiedProduct(1).id, quantityMilli: 3_000 },
      ]);
    });

    it('is replaced by what the server says on the next download: its stock already counts what it received', async () => {
      const t = await createTestCopy();
      await saved(t, [1], [[1, 5_000]]);
      t.copy.start();
      await settle();
      await t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 2_000 }]);
      t.api.serveProducts(page([], LATER)).serveStock(page([stockOfProduct(1, 2_000)], LATER));

      await t.copy.refresh();

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(2_000);
    });

    it('does not touch what is saved when there is nothing to take out of the stock', async () => {
      const putStock = vi.fn(() => Promise.resolve());
      let armed = false;
      const t = await createTestCopy({
        status: 'offline',
        wrap: hooking((storage) => (armed ? overStorage(storage, { putStock }) : storage)),
      });
      await saved(t, [1], [[1, 5_000]]);
      t.copy.start();
      await settle();
      armed = true;

      await t.copy.sold([]);

      expect(putStock).not.toHaveBeenCalled();
    });

    it('still shows the new stock when it could not be saved: it is a calculation and the sale is already kept', async () => {
      let armed = false;
      const t = await createTestCopy({
        status: 'offline',
        wrap: hooking((storage) =>
          armed
            ? overStorage(storage, { putStock: () => Promise.reject(new Error('disco lleno')) })
            : storage,
        ),
      });
      await saved(t, [1], [[1, 5_000]]);
      t.copy.start();
      await settle();
      armed = true;

      await expect(
        t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 2_000 }]),
      ).resolves.toBeUndefined();

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(3_000);
    });

    it('does nothing, and says nothing, when nobody works any more', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1], [[1, 5_000]]);
      t.copy.start();
      await settle();
      await t.local.workspace.leave();

      await expect(
        t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 1_000 }]),
      ).resolves.toBeUndefined();
    });

    it('does not touch the stock of the person who arrived while it was saving', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1], [[1, 5_000]]);
      t.copy.start();
      await settle();
      const selling = t.copy.sold([{ productId: copiedProduct(1).id, quantityMilli: 1_000 }]);
      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await selling;
      await settle();

      // Luis no bajo nunca la existencia: no se sabe nada, y menos lo de Ana.
      expect(t.copy.stockOf(copiedProduct(1).id)).toBeNull();
      expect(t.local.stores.dataOf('luis').stock.size).toBe(0);
    });
  });

  describe('before anything was downloaded', () => {
    it('is empty: no catalog, no hour, nothing happening', async () => {
      const t = await createTestCopy();

      expect(t.copy.current()).toEqual({
        status: 'empty',
        productCount: 0,
        productsAsOf: null,
        stockAsOf: null,
        downloading: false,
        fault: null,
      });
      expect(t.copy.search('producto')).toEqual([]);
      expect(t.copy.product(copiedProduct(1).id)).toBeUndefined();
      expect(t.copy.stockOf(copiedProduct(1).id)).toBeNull();
    });
  });

  describe('what was saved by an earlier download', () => {
    it('is there as soon as it starts, also without a connection: that is what selling without one is for', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1, 2], [[1, 12_500]]);

      t.copy.start();
      await settle();

      expect(t.copy.current()).toMatchObject({
        status: 'ready',
        productCount: 2,
        productsAsOf: FIRST,
        stockAsOf: SECOND,
        downloading: false,
        fault: null,
      });
      expect(t.copy.search('producto 2').map((product) => product.id)).toEqual([
        copiedProduct(2).id,
      ]);
      expect(t.copy.product(copiedProduct(1).id)).toEqual(copiedProduct(1));
      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(12_500);
      // El servidor ya dijo la existencia y de este producto no dijo nada: nunca se movio, y sin movimientos no hay existencia.
      expect(t.copy.stockOf(copiedProduct(2).id)).toBe(0);
      expect(t.api.productCalls).toEqual([]);
    });

    it('is loaded when someone starts working after it started, and forgotten when they leave', async () => {
      const t = await createTestCopy({ working: false, status: 'offline' });
      t.local.stores.dataOf('ana').products.set(copiedProduct(1).id, copiedProduct(1));
      t.local.stores.dataOf('ana').checkpoint = { productsAsOf: FIRST, stockAsOf: null };
      t.copy.start();
      await settle();
      expect(t.copy.current().productCount).toBe(0);

      await t.local.workspace.begin(testMe('ana', 'cashier'));
      await settle();
      expect(t.copy.current()).toMatchObject({ status: 'ready', productCount: 1 });

      await t.local.workspace.leave();
      await settle();
      expect(t.copy.current()).toMatchObject({ status: 'empty', productCount: 0 });
      expect(t.copy.search('producto')).toEqual([]);
    });

    it('does not show the catalog of one person to the next one', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1, 2, 3]);
      t.copy.start();
      await settle();
      expect(t.copy.current().productCount).toBe(3);

      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await settle();

      expect(t.copy.current()).toMatchObject({ status: 'empty', productCount: 0 });
      expect(t.copy.search('producto')).toEqual([]);
    });

    it('is nothing downloaded when the base has no hour for it: it will be asked for in full', async () => {
      const t = await createTestCopy({ status: 'offline' });
      t.local.stores.dataOf('ana').products.set(copiedProduct(1).id, copiedProduct(1));
      t.copy.start();
      await settle();

      expect(t.copy.current()).toMatchObject({ status: 'empty', productsAsOf: null });
    });
  });

  describe('downloading', () => {
    it('asks for everything the first time, and keeps what comes with the hour of the server', async () => {
      const t = await createTestCopy();
      t.api
        .serveProducts(page([copiedProduct(1), copiedProduct(2)], FIRST))
        .serveStock(page([stockOfProduct(1, 5_000)], SECOND));

      await t.copy.refresh();

      expect(t.api.productCalls).toEqual([{ since: null, cursor: null, limit: 200 }]);
      expect(t.api.stockCalls).toEqual([{ since: null, cursor: null, limit: 200 }]);
      expect(t.copy.current()).toMatchObject({
        status: 'ready',
        productCount: 2,
        productsAsOf: FIRST,
        stockAsOf: SECOND,
        downloading: false,
        fault: null,
      });
      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(5_000);
      const stored = t.local.stores.dataOf('ana');
      expect([...stored.products.keys()].sort()).toEqual(
        [copiedProduct(1).id, copiedProduct(2).id].sort(),
      );
      expect(stored.stock.get(copiedProduct(1).id)).toEqual(stockOfProduct(1, 5_000));
      expect(stored.checkpoint).toEqual({ productsAsOf: FIRST, stockAsOf: SECOND });
    });

    it('asks, the next time, only for what changed since one minute before the first page of the last download', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));
      await t.copy.refresh();

      await t.copy.refresh();

      expect(t.api.productCalls[1]).toEqual({
        since: new Date('2026-10-19T11:59:00.000Z'),
        cursor: null,
        limit: 200,
      });
      expect(t.api.stockCalls[1]).toEqual({
        since: new Date('2026-10-19T11:59:07.000Z'),
        cursor: null,
        limit: 200,
      });
    });

    it('asks from where it left off after the app was closed: the hour is in the base', async () => {
      const t = await createTestCopy();
      await saved(t, [1]);
      t.copy.start();
      await settle();

      expect(t.api.productCalls).toEqual([
        { since: new Date('2026-10-19T11:59:00.000Z'), cursor: null, limit: 200 },
      ]);
    });

    it('goes through every page by the cursor, and keeps the hour of the FIRST one', async () => {
      const t = await createTestCopy();
      t.api
        .serveProducts(
          page([copiedProduct(1)], FIRST, 'p2'),
          page([copiedProduct(2)], SECOND, 'p3'),
          page([copiedProduct(3)], LATER, null),
        )
        .serveStock(page([], SECOND));

      await t.copy.refresh();

      expect(t.api.productCalls.map((call) => call.cursor)).toEqual([null, 'p2', 'p3']);
      expect(t.copy.current()).toMatchObject({ productCount: 3, productsAsOf: FIRST });
      expect(t.local.stores.dataOf('ana').checkpoint.productsAsOf).toEqual(FIRST);
    });

    it('says it is downloading while it does, and not afterwards', async () => {
      const t = await createTestCopy();
      const gate = deferred<CopyPage<Product>>();
      t.api.serveProducts(() => gate.promise).serveStock(page([], SECOND));

      const downloading = t.copy.refresh();
      await settle();
      expect(t.copy.current().downloading).toBe(true);

      gate.resolve(page([copiedProduct(1)], FIRST));
      await downloading;
      expect(t.copy.current().downloading).toBe(false);
    });

    it('shares one download between two requests made at the same moment', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));

      await Promise.all([t.copy.refresh(), t.copy.refresh()]);

      expect(t.api.productCalls).toHaveLength(1);
    });

    it('can be asked again once the download is over', async () => {
      const t = await createTestCopy();
      t.api
        .serveProducts(page([], FIRST), page([], SECOND))
        .serveStock(page([], FIRST), page([], SECOND));

      await t.copy.refresh();
      await t.copy.refresh();

      expect(t.api.productCalls).toHaveLength(2);
    });

    it('does not download while there is no connection, and says so: only the server answering is online', async () => {
      const t = await createTestCopy({ status: 'offline' });

      await t.copy.refresh();

      expect(t.api.productCalls).toEqual([]);
      expect(t.copy.current().fault).toBe('network');
    });

    it('does not download while the connection is only being checked', async () => {
      const t = await createTestCopy({ status: 'checking' });

      await t.copy.refresh();

      expect(t.api.productCalls).toEqual([]);
    });

    it('does nothing when nobody is working', async () => {
      const t = await createTestCopy({ working: false });

      await t.copy.refresh();

      expect(t.api.productCalls).toEqual([]);
      expect(t.copy.current()).toMatchObject({ downloading: false, fault: null });
    });
  });

  describe('what changed', () => {
    it('replaces a product by the one that changed later, and keeps the archived ones marked', async () => {
      const t = await createTestCopy();
      await saved(t, [1, 2]);
      t.copy.start();
      await settle();
      t.api.serveProducts(
        page(
          [
            copiedProduct(1, { unitPrice: 9_999, updatedAt: new Date('2026-10-19T11:00:00.000Z') }),
            copiedProduct(2, { active: false, updatedAt: new Date('2026-10-19T11:00:00.000Z') }),
          ],
          LATER,
        ),
      );
      await settle();

      await t.copy.refresh();

      expect(t.copy.product(copiedProduct(1).id)?.unitPrice).toBe(9_999);
      expect(t.copy.product(copiedProduct(2).id)?.active).toBe(false);
      expect(t.copy.current().productCount).toBe(2);
      expect(t.copy.search('producto 2')).toEqual([]);
    });

    it('does not go back to an older version of a product that arrives again in the margin of a minute', async () => {
      const t = await createTestCopy();
      await saved(t, [1]);
      t.copy.start();
      await settle();
      t.api.serveProducts(
        page(
          [copiedProduct(1, { unitPrice: 5, updatedAt: new Date('2026-09-01T00:00:00.000Z') })],
          LATER,
        ),
      );

      await t.copy.refresh();

      expect(t.copy.product(copiedProduct(1).id)?.unitPrice).toBe(1_000);
    });

    it('replaces the stock with the one of now, and keeps the one of products that did not move', async () => {
      const t = await createTestCopy();
      await saved(
        t,
        [1, 2],
        [
          [1, 5_000],
          [2, 8_000],
        ],
      );
      t.copy.start();
      await settle();
      t.api.serveStock(page([stockOfProduct(1, -1_000)], LATER));

      await t.copy.refresh();

      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(-1_000);
      expect(t.copy.stockOf(copiedProduct(2).id)).toBe(8_000);
      expect(t.copy.current().stockAsOf).toEqual(LATER);
    });
  });

  describe('when it fails', () => {
    it.each([
      ['no network', failure('network'), 'network'],
      ['a rejected session', failure('session'), 'session'],
      ['a server that fails', failure('transient'), 'other'],
      ['a request the server refused', failure('permanent'), 'other'],
      ['something nobody foresaw', new Error('algo raro'), 'other'],
    ] as const)('says why when it finds %s, and does not throw', async (_name, error, fault) => {
      const t = await createTestCopy();
      t.api.serveProducts(() => error);

      await expect(t.copy.refresh()).resolves.toBeUndefined();

      expect(t.copy.current()).toMatchObject({ downloading: false, fault });
    });

    it('keeps the catalog it already had, so selling goes on', async () => {
      const t = await createTestCopy();
      await saved(t, [1]);
      t.copy.start();
      await settle();
      t.api.serveProducts(() => failure('transient'));

      await t.copy.refresh();

      expect(t.copy.current()).toMatchObject({ status: 'ready', productCount: 1, fault: 'other' });
      expect(t.copy.search('producto 1')).toHaveLength(1);
    });

    it('keeps the catalog that arrived when the stock fails: the hour of each download is kept apart', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(() => failure('transient'));

      await t.copy.refresh();

      expect(t.copy.current()).toMatchObject({
        status: 'ready',
        productCount: 1,
        productsAsOf: FIRST,
        stockAsOf: null,
        fault: 'other',
      });
      expect(t.local.stores.dataOf('ana').checkpoint).toEqual({
        productsAsOf: FIRST,
        stockAsOf: null,
      });
    });

    it('does not move the hour of a download that did not finish: the next one asks for the same', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(page([copiedProduct(1)], FIRST, 'p2'), () => failure('transient'));
      await t.copy.refresh();

      expect(t.local.stores.dataOf('ana').checkpoint).toEqual(NO_DOWNLOADS);
      expect(t.copy.current()).toMatchObject({ status: 'empty', productsAsOf: null });
      // Lo que llego se guardo igual: aplicarlo otra vez no hace dano.
      expect(t.local.stores.dataOf('ana').products.size).toBe(1);
    });

    it('forgets the failure when the next download works', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(() => failure('network'));
      await t.copy.refresh();
      expect(t.copy.current().fault).toBe('network');
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));

      await t.copy.refresh();

      expect(t.copy.current()).toMatchObject({ fault: null, status: 'ready' });
    });
  });

  describe('when the person changes while it downloads', () => {
    it('stops quietly, and nothing of what was coming lands on the person who arrived', async () => {
      const t = await createTestCopy();
      const gate = deferred<CopyPage<Product>>();
      t.api.serveProducts(() => gate.promise);

      const downloading = t.copy.refresh();
      await settle();
      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      gate.resolve(page([copiedProduct(1)], FIRST));
      await expect(downloading).resolves.toBeUndefined();
      await settle();

      expect(t.copy.current()).toMatchObject({ status: 'empty', productCount: 0 });
      expect(t.local.stores.dataOf('luis').products.size).toBe(0);
      expect(t.local.stores.dataOf('ana').products.size).toBe(0);
    });
  });

  describe('when to download by itself', () => {
    it('downloads when it starts, if it is online and somebody is working', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));

      t.copy.start();
      await settle();

      expect(t.copy.current()).toMatchObject({ status: 'ready', productCount: 1 });
    });

    it('downloads when the connection comes back, and not when it goes away', async () => {
      const t = await createTestCopy({ status: 'offline' });
      t.copy.start();
      await settle();
      expect(t.api.productCalls).toHaveLength(0);

      t.connection.go('online');
      await settle();
      expect(t.api.productCalls).toHaveLength(1);

      t.connection.go('offline');
      await settle();
      expect(t.api.productCalls).toHaveLength(1);
    });

    it('downloads when somebody starts working', async () => {
      const t = await createTestCopy({ working: false });
      t.copy.start();
      await settle();
      expect(t.api.productCalls).toHaveLength(0);

      await t.local.workspace.begin(testMe('ana', 'cashier'));
      await settle();

      expect(t.api.productCalls).toHaveLength(1);
    });

    it('downloads again after the device sent something: the stock moved', async () => {
      const t = await createTestCopy();
      t.copy.start();
      await settle();
      expect(t.api.productCalls).toHaveLength(1);

      t.sync.set({ lastSyncedAt: new Date('2026-10-19T12:05:00.000Z') });
      await settle();

      expect(t.api.productCalls).toHaveLength(2);
    });

    it('does not download again for a change of the sending that is not a send that went through', async () => {
      const t = await createTestCopy();
      t.copy.start();
      await settle();

      t.sync.set({ phase: 'sending', pending: 3 });
      t.sync.set({ phase: 'idle', pending: 3 });
      await settle();

      expect(t.api.productCalls).toHaveLength(1);
    });
  });

  describe('starting and stopping', () => {
    it('does not listen twice if it is started twice', async () => {
      const t = await createTestCopy();

      t.copy.start();
      t.copy.start();

      expect(t.connection.subscribers).toBe(1);
      expect(t.sync.subscribers).toBe(1);
    });

    it('stops listening to everything when it is stopped, and can be started again', async () => {
      const t = await createTestCopy();
      t.copy.start();
      await settle();

      t.copy.stop();
      expect(t.connection.subscribers).toBe(0);
      expect(t.sync.subscribers).toBe(0);
      t.connection.go('offline');
      t.connection.go('online');
      await settle();
      expect(t.api.productCalls).toHaveLength(1);

      t.copy.start();
      expect(t.connection.subscribers).toBe(1);
    });

    it('tells those who listen of every change, and no longer after they stop listening', async () => {
      const t = await createTestCopy();
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));
      const listener = vi.fn();
      const stop = t.copy.subscribe(listener);

      await t.copy.refresh();
      const calls = listener.mock.calls.length;
      stop();
      t.api.serveProducts(page([copiedProduct(2)], LATER));
      await t.copy.refresh();

      expect(calls).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(calls);
    });

    it('is the same object while nothing changes', async () => {
      const t = await createTestCopy({ status: 'offline' });
      t.copy.start();
      await settle();

      const before = t.copy.current();
      t.connection.go('checking');
      await settle();

      expect(t.copy.current()).toBe(before);
    });
  });

  describe('what the interface sees while it works', () => {
    it('shows the products that already arrived while the rest are coming', async () => {
      const t = await createTestCopy();
      const gate = deferred<CopyPage<Product>>();
      t.api
        .serveProducts(page([copiedProduct(1)], FIRST, 'p2'), () => gate.promise)
        .serveStock(page([], SECOND));

      const downloading = t.copy.refresh();
      await settle();

      expect(t.copy.current()).toMatchObject({ downloading: true, productCount: 1 });
      gate.resolve(page([copiedProduct(2)], LATER));
      await downloading;
      expect(t.copy.current().productCount).toBe(2);
    });

    it('goes through every page of the stock as well, and keeps the hour of the first one', async () => {
      const t = await createTestCopy();
      t.api
        .serveProducts(page([], FIRST))
        .serveStock(
          page([stockOfProduct(1, 4_000)], SECOND, 's2'),
          page([stockOfProduct(2, 9_000)], LATER),
        );

      await t.copy.refresh();

      expect(t.api.stockCalls.map((call) => call.cursor)).toEqual([null, 's2']);
      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(4_000);
      expect(t.copy.stockOf(copiedProduct(2).id)).toBe(9_000);
      expect(t.copy.current().stockAsOf).toEqual(SECOND);
    });

    it('keeps no flash of an empty catalog while it updates one that is already there', async () => {
      const t = await createTestCopy();
      await saved(t, [1, 2]);
      const seen: number[] = [];
      t.copy.subscribe(() => seen.push(t.copy.current().productCount));
      t.copy.start();
      await settle();

      await t.copy.refresh();

      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((count) => count === 2)).toBe(true);
    });

    it('finds, after an update, a product that arrived once the list had already been used', async () => {
      const t = await createTestCopy();
      await saved(t, [1]);
      t.copy.start();
      await settle();
      expect(t.copy.search('producto')).toHaveLength(1);
      t.api.serveProducts(page([copiedProduct(2)], LATER));

      await t.copy.refresh();

      expect(t.copy.search('producto')).toHaveLength(2);
    });

    it('searches with what it was asked: the size of the list and the archived ones', async () => {
      const t = await createTestCopy();
      await saved(t, [1, 2, 3]);
      await t.local.workspace.copy().putProducts([copiedProduct(4, { active: false })]);
      t.copy.start();
      await settle();

      expect(t.copy.search('producto', { limit: 1 })).toHaveLength(1);
      expect(t.copy.search('producto')).toHaveLength(3);
      expect(t.copy.search('producto', { includeArchived: true })).toHaveLength(4);
    });

    it('tells again when only the hour of the catalog changed, and not when nothing did', async () => {
      const t = await createTestCopy();
      t.api
        .serveProducts(page([], FIRST), page([], LATER))
        .serveStock(page([], SECOND), page([], SECOND));
      await t.copy.refresh();
      const listener = vi.fn();
      t.copy.subscribe(listener);

      await t.copy.refresh();

      expect(t.copy.current().productsAsOf).toEqual(LATER);
      expect(listener).toHaveBeenCalled();
    });

    it('does not tell, nor change, when asked again and nothing changed', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await t.copy.refresh();
      const before = t.copy.current();
      const listener = vi.fn();
      t.copy.subscribe(listener);

      await t.copy.refresh();

      expect(t.copy.current()).toBe(before);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('forgetting the person who left', () => {
    it('forgets their stock and the list that was ready to search', async () => {
      const t = await createTestCopy({ status: 'offline' });
      await saved(t, [1, 2], [[1, 5_000]]);
      t.copy.start();
      await settle();
      expect(t.copy.search('producto')).toHaveLength(2);
      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(5_000);

      await t.local.workspace.leave();
      await settle();

      expect(t.copy.search('producto')).toEqual([]);
      expect(t.copy.stockOf(copiedProduct(1).id)).toBeNull();
      expect(t.copy.product(copiedProduct(1).id)).toBeUndefined();
    });

    it('asks the next person for everything when what they had saved can not be read: the hour of the one who left is not theirs', async () => {
      const t = await createTestCopy({
        wrap: hooking((storage, call) =>
          call === 3
            ? overStorage(storage, { readCheckpoint: () => Promise.reject(new Error('boom')) })
            : storage,
        ),
      });
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));
      await t.copy.refresh();
      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));

      await t.copy.refresh();

      expect(t.api.productCalls[1]?.since).toBeNull();
      expect(t.api.stockCalls[1]?.since).toBeNull();
    });
  });

  describe('when something goes wrong with what is saved', () => {
    it('says it could not read it, and goes on without throwing', async () => {
      const t = await createTestCopy({
        status: 'offline',
        wrap: hooking((storage) =>
          overStorage(storage, { readProducts: () => Promise.reject(new Error('boom')) }),
        ),
      });
      t.copy.start();
      await settle();

      expect(t.copy.current().fault).toBe('other');
      await expect(t.copy.refresh()).resolves.toBeUndefined();
    });

    it('stops quietly when the person leaves between being looked at and downloading', async () => {
      const t = await createTestCopy({
        wrap: hooking((storage, call) => {
          if (call === 2) throw new NoWorkspaceError();
          return storage;
        }),
      });

      await expect(t.copy.refresh()).resolves.toBeUndefined();

      expect(t.copy.current()).toMatchObject({ fault: null, downloading: false });
    });

    it('does not let a slow read of what was saved land on the person who arrived', async () => {
      const gate = deferred<Product[]>();
      const t = await createTestCopy({
        status: 'offline',
        wrap: hooking((storage, call) =>
          call === 1 ? overStorage(storage, { readProducts: () => gate.promise }) : storage,
        ),
      });
      await saved(t, [1, 2]);
      t.copy.start();
      await settle();

      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await settle();
      gate.resolve([copiedProduct(1), copiedProduct(2)]);
      await settle();

      expect(t.copy.current().productCount).toBe(0);
      expect(t.copy.search('producto')).toEqual([]);
    });
  });

  describe('when the person changes in the middle of a download', () => {
    it('does not put what arrived in the memory of the person who came, although it was already saved', async () => {
      const t = await createTestCopy({
        wrap: hooking((storage, call) =>
          call === 2
            ? overStorage(storage, {
                putProducts: async (products) => {
                  await storage.putProducts(products);
                  await t.local.workspace.leave();
                  await t.local.workspace.begin(testMe('luis', 'cashier'));
                },
                putStock: async (levels) => {
                  await storage.putStock(levels);
                },
              })
            : storage,
        ),
      });
      t.local.stores.dataOf('luis').checkpoint = { productsAsOf: FIRST, stockAsOf: SECOND };
      t.api.serveProducts(page([copiedProduct(1)], FIRST)).serveStock(page([], SECOND));

      t.copy.start();
      await settle();

      expect(t.copy.product(copiedProduct(1).id)).toBeUndefined();
      expect(t.copy.search('producto')).toEqual([]);
      // Lo que se pide para quien llego parte de SUS horas, no de las de quien se fue.
      expect(t.api.productCalls[1]?.since).toEqual(new Date('2026-10-19T11:59:00.000Z'));
    });

    it('does not put the stock that arrived in the memory of the person who came either', async () => {
      const t = await createTestCopy({
        wrap: hooking((storage, call) =>
          call === 2
            ? overStorage(storage, {
                putStock: async (levels) => {
                  await storage.putStock(levels);
                  await t.local.workspace.leave();
                  await t.local.workspace.begin(testMe('luis', 'cashier'));
                },
              })
            : storage,
        ),
      });
      t.local.stores.dataOf('luis').checkpoint = { productsAsOf: FIRST, stockAsOf: SECOND };
      t.api.serveProducts(page([], FIRST)).serveStock(page([stockOfProduct(1, 4_000)], SECOND));

      t.copy.start();
      await settle();

      // Lo que se bajo para Ana no llega a Luis: para el, el producto no tiene existencia.
      expect(t.copy.stockOf(copiedProduct(1).id)).toBe(0);
      expect(t.api.stockCalls[1]?.since).toEqual(new Date('2026-10-19T11:59:07.000Z'));
    });

    it('gives the person who came their own download as soon as the other one ends, with their own hours', async () => {
      const t = await createTestCopy();
      t.local.stores.dataOf('luis').products.set(copiedProduct(9).id, copiedProduct(9));
      t.local.stores.dataOf('luis').checkpoint = { productsAsOf: FIRST, stockAsOf: SECOND };
      const gate = deferred<CopyPage<Product>>();
      t.api.serveProducts(() => gate.promise).serveStock(page([], SECOND));
      const faults: (string | null)[] = [];
      t.copy.subscribe(() => faults.push(t.copy.current().fault));

      t.copy.start();
      await settle();
      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await settle();
      gate.resolve(page([copiedProduct(1)], FIRST));
      await settle();

      // El fallo de la descarga de quien se fue no se le cuenta a quien llego, ni un instante.
      expect(faults.filter((fault) => fault !== null)).toEqual([]);

      expect(t.api.productCalls).toHaveLength(2);
      expect(t.api.productCalls[1]).toEqual({
        since: new Date('2026-10-19T11:59:00.000Z'),
        cursor: null,
        limit: 200,
      });
      expect(t.copy.product(copiedProduct(9).id)).toBeDefined();
      expect(t.copy.product(copiedProduct(1).id)).toBeUndefined();
      expect(t.copy.current()).toMatchObject({ fault: null, downloading: false });
    });
  });

  describe('the index of the search', () => {
    it('is made once for any number of searches, and again only when the catalog changes', async () => {
      const t = await createTestCopy();
      t.api
        .serveProducts(page([copiedProduct(1), copiedProduct(2), copiedProduct(3)], FIRST))
        .serveStock(page([], FIRST));
      await t.copy.refresh();
      vi.mocked(indexProducts).mockClear();

      t.copy.search('producto 1');
      t.copy.search('producto 2');
      t.copy.search('producto 3');
      expect(indexProducts).toHaveBeenCalledTimes(1);

      t.api.serveProducts(page([copiedProduct(4)], LATER)).serveStock(page([], LATER));
      await t.copy.refresh();
      t.copy.search('producto 4');
      t.copy.search('producto 1');

      expect(indexProducts).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the device sends something', () => {
    it('does not download again until something new went through: other changes of the sending are not news', async () => {
      const t = await createTestCopy();
      t.sync.set({ lastSyncedAt: new Date('2026-10-19T11:00:00.000Z') });
      t.copy.start();
      await settle();
      expect(t.api.productCalls).toHaveLength(1);

      t.sync.set({ pending: 3 });
      t.sync.set({ phase: 'sending' });
      await settle();
      expect(t.api.productCalls).toHaveLength(1);

      t.sync.set({ lastSyncedAt: new Date('2026-10-19T12:10:00.000Z') });
      await settle();
      expect(t.api.productCalls).toHaveLength(2);

      t.sync.set({ pending: 1 });
      await settle();
      expect(t.api.productCalls).toHaveLength(2);
    });
  });
});
