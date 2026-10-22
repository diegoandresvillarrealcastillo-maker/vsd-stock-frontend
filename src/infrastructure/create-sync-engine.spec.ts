// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Me } from '../domain/model/me';
import type { ApiGateway, ApiRequest, ApiResponse } from '../domain/ports/out/api-gateway';
import { FakeConnection, saleOperation } from '../../test/support/fake-sync';
import { createLocalWorkspace } from './create-local-workspace';
import { createSyncEngine } from './create-sync-engine';

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

/** Un servidor que registra dispositivos y acepta todo lo que llega en un lote. */
function server(sent: ApiRequest[], serverTime = new Date('2026-10-19T12:00:00.500Z')): ApiGateway {
  return {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      if (request.path === '/v1/sync') {
        const { operations } = request.body as { operations: { body: { operationId: string } }[] };
        return Promise.resolve({
          status: 200,
          replayed: false,
          body: {
            serverTime: serverTime.toISOString(),
            results: operations.map((operation) => ({
              operationId: operation.body.operationId,
              status: 201,
              replayed: false,
              body: { id: operation.body.operationId },
              problem: null,
            })),
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

describe('createSyncEngine', () => {
  it('sends what the person did to the batch route of the API, and says it was sent', async () => {
    const sent: ApiRequest[] = [];
    const api = server(sent);
    const workspace = createLocalWorkspace({
      api,
      now: () => new Date('2026-10-19T12:00:00.000Z'),
      getStorage: memoryStorage,
      fillRandom: (bytes) => crypto.getRandomValues(bytes),
    });
    const engine = createSyncEngine({
      api,
      workspace,
      connection: new FakeConnection('online'),
      locks: undefined,
      now: () => new Date('2026-10-19T12:00:01.000Z'),
    });
    await workspace.begin(me);

    await engine.enqueue(saleOperation(1));
    await engine.syncNow();

    const batches = sent.filter((request) => request.path === '/v1/sync');
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      method: 'POST',
      body: { operations: [{ kind: 'sale', body: saleOperation(1).body }] },
    });
    expect(engine.current()).toMatchObject({ pending: 0, attention: 0, phase: 'idle' });
    expect(engine.current().lastSyncedAt).toEqual(new Date('2026-10-19T12:00:01.000Z'));
    engine.stop();
  });

  it('sends with the lock of the browser, so only one tab does it at a time', async () => {
    const requested: { name: string; ifAvailable: boolean }[] = [];
    const locks = {
      request: async <T>(
        name: string,
        options: { ifAvailable: boolean },
        callback: (lock: { name: string } | null) => Promise<T>,
      ) => {
        requested.push({ name, ifAvailable: options.ifAvailable });
        return await callback({ name });
      },
    };
    const api = server([]);
    const workspace = createLocalWorkspace({
      api,
      now: () => new Date('2026-10-19T12:00:00.000Z'),
      getStorage: memoryStorage,
      fillRandom: (bytes) => crypto.getRandomValues(bytes),
    });
    const engine = createSyncEngine({
      api,
      workspace,
      connection: new FakeConnection('online'),
      locks,
      now: () => new Date('2026-10-19T12:00:01.000Z'),
    });
    await workspace.begin(me);
    await engine.enqueue(saleOperation(1));

    await engine.syncNow();

    expect(requested).toEqual([{ name: 'vsd-stock-sync', ifAvailable: true }]);
    engine.stop();
  });

  it('measures the clock of the device with the hour that the server gives', async () => {
    const api = server([], new Date('2026-10-19T12:00:11.000Z'));
    const workspace = createLocalWorkspace({
      api,
      now: () => new Date('2026-10-19T12:00:00.000Z'),
      getStorage: memoryStorage,
      fillRandom: (bytes) => crypto.getRandomValues(bytes),
    });
    const engine = createSyncEngine({
      api,
      workspace,
      connection: new FakeConnection('online'),
      locks: undefined,
      now: () => new Date('2026-10-19T12:00:01.000Z'),
    });
    await workspace.begin(me);
    await engine.enqueue(saleOperation(1));

    await engine.syncNow();

    expect(engine.clockOffsetMs()).toBe(10_000);
    engine.stop();
  });
});
