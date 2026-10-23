// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Me } from '../domain/model/me';
import type { ApiGateway, ApiRequest, ApiResponse } from '../domain/ports/out/api-gateway';
import { FakeConnection } from '../../test/support/fake-sync';
import { FakeSyncEngine } from '../../test/support/sync-engine';
import { createLocalWorkspace } from './create-local-workspace';
import { createReadCopy } from './create-read-copy';

const AUTH_ID = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const me: Me = {
  identity: { id: AUTH_ID, email: 'ana@ejemplo.co' },
  membership: {
    userId: '11111111-1111-4111-8111-111111111111',
    businessId: '22222222-2222-4222-8222-222222222222',
    businessName: 'Tienda La Esquina',
    role: 'cashier',
    fullName: 'Ana Gómez',
  },
};
const PRODUCT = {
  id: 'f0000000-0000-4000-8000-000000000001',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  barcode: '7701234567897',
  unit: 'unit',
  unitPrice: 3200,
  taxRateBp: 0,
  taxKind: 'exempt',
  active: true,
  categoryId: null,
  minStockMilli: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-18T10:00:00.000Z',
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

/** Un servidor que registra dispositivos y da un producto con su existencia en la copia de lectura. */
function server(sent: ApiRequest[]): ApiGateway {
  return {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      const asOf = '2026-10-19T12:00:00.000Z';
      if (request.path === '/v1/sync/products') {
        return Promise.resolve({
          status: 200,
          replayed: false,
          body: { asOf, items: [PRODUCT], nextCursor: null } as T,
        });
      }
      if (request.path === '/v1/sync/stock') {
        return Promise.resolve({
          status: 200,
          replayed: false,
          body: {
            asOf,
            items: [{ productId: PRODUCT.id, quantityMilli: 12_000 }],
            nextCursor: null,
          } as T,
        });
      }
      const { id } = request.body as { id: string };
      return Promise.resolve({ status: 201, body: { id, code: 'AA' } as T, replayed: false });
    },
  };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('createReadCopy', () => {
  it('downloads the catalog and the stock from the sync routes, keeps them and finds products without the server', async () => {
    const sent: ApiRequest[] = [];
    const api = server(sent);
    const workspace = createLocalWorkspace({
      api,
      now: () => new Date('2026-10-19T12:00:00.000Z'),
      getStorage: memoryStorage,
      fillRandom: (bytes) => crypto.getRandomValues(bytes),
    });
    const copy = createReadCopy({
      api,
      workspace,
      connection: new FakeConnection('online'),
      sync: new FakeSyncEngine(),
    });
    await workspace.begin(me);

    await copy.refresh();

    expect(
      sent.filter((request) => request.path.startsWith('/v1/sync/')).map((r) => r.path),
    ).toEqual(['/v1/sync/products', '/v1/sync/stock']);
    expect(copy.search('arroz').map((product) => product.sku)).toEqual(['ARR-500']);
    expect(copy.search('7701234567897')).toHaveLength(1);
    expect(copy.stockOf(PRODUCT.id)).toBe(12_000);
    expect(copy.current()).toMatchObject({ status: 'ready', productCount: 1 });
  });

  it('keeps what it downloaded across visits: the next page load finds the catalog without asking', async () => {
    const storage = memoryStorage();
    const sent: ApiRequest[] = [];
    const api = server(sent);
    const visit = () =>
      createLocalWorkspace({
        api,
        now: () => new Date('2026-10-19T12:00:00.000Z'),
        getStorage: () => storage,
        fillRandom: (bytes) => crypto.getRandomValues(bytes),
      });
    const first = visit();
    const firstCopy = createReadCopy({
      api,
      workspace: first,
      connection: new FakeConnection('online'),
      sync: new FakeSyncEngine(),
    });
    await first.begin(me);
    await firstCopy.refresh();
    await first.leave();

    const later = visit();
    const laterCopy = createReadCopy({
      api,
      workspace: later,
      connection: new FakeConnection('offline'),
      sync: new FakeSyncEngine(),
    });
    await later.begin(me);
    laterCopy.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(laterCopy.search('arroz')).toHaveLength(1);
    expect(laterCopy.stockOf(PRODUCT.id)).toBe(12_000);
    laterCopy.stop();
  });
});
