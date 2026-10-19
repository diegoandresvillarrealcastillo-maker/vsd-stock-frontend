import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/model/catalog';
import { NO_DOWNLOADS, type CopyPage } from '../../domain/model/read-copy';
import { testMe } from '../../../test/support/auth';
import { settle } from '../../../test/support/connection';
import { deferred } from '../../../test/support/deferred';
import {
  copiedProduct,
  createTestCopy,
  page,
  stockOfProduct,
  type TestCopy,
} from '../../../test/support/fake-copy';
import { failure } from '../../../test/support/fake-sync';

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
      expect(t.copy.stockOf(copiedProduct(2).id)).toBeNull();
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
});
