// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../domain/model/me';
import type { ApiGateway, ApiRequest, ApiResponse } from '../domain/ports/out/api-gateway';
import { FakeConnection } from '../../test/support/fake-sync';
import { item } from '../../test/support/fake-selling';
import { FakeReadCopy } from '../../test/support/read-copy';
import { createLocalWorkspace } from './create-local-workspace';
import { createSelling } from './create-selling';
import { createShifts } from './create-shifts';
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
function server(sent: ApiRequest[]): ApiGateway {
  return {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      if (request.path === '/v1/sync') {
        const { operations } = request.body as { operations: { body: { operationId: string } }[] };
        return Promise.resolve({
          status: 200,
          replayed: false,
          body: {
            serverTime: '2026-10-19T13:00:00.500Z',
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

async function wire() {
  const sent: ApiRequest[] = [];
  const api = server(sent);
  const now = () => new Date('2026-10-19T13:00:00.000Z');
  const fillRandom = (bytes: Uint8Array<ArrayBuffer>) => crypto.getRandomValues(bytes);
  const workspace = createLocalWorkspace({ api, now, getStorage: memoryStorage, fillRandom });
  const connection = new FakeConnection('offline');
  const sync = createSyncEngine({ api, workspace, connection, locks: undefined, now });
  const shifts = createShifts({ workspace, sync, now, fillRandom });
  const copy = new FakeReadCopy();
  const selling = createSelling({ workspace, sync, shifts, copy, now, fillRandom });
  await workspace.begin(me);
  await workspace.registerDevice();
  shifts.start();
  sync.start();
  selling.start();
  return {
    workspace,
    connection,
    shifts,
    selling,
    copy,
    batches: () => sent.filter((request) => request.path === '/v1/sync'),
    stop: () => {
      selling.stop();
      shifts.stop();
      sync.stop();
    },
  };
}

describe('createSelling', () => {
  it('sells without a connection and sends the shift and the sale, in order, when it returns', async () => {
    const t = await wire();
    await t.shifts.open(50_000);
    const product = item(1, {
      name: 'Arroz 500 g',
      unitPrice: 3_200,
      taxRateBp: 1_900,
      taxKind: 'taxed',
    });
    t.selling.add(product);
    t.selling.add(product);

    const receipt = await t.selling.confirm({ method: 'cash', received: 10_000 });

    expect(receipt).toMatchObject({
      folio: 'AA-000001',
      payment: { received: 10_000, change: 3_600 },
    });
    expect(t.batches()).toHaveLength(0);
    expect(t.shifts.current()).toMatchObject({
      status: 'open',
      summary: { cashCount: 1, cashAmount: 6_400, expectedAmount: 56_400 },
    });

    t.connection.go('online');
    await vi.waitFor(() => {
      expect(t.shifts.current()).toMatchObject({ status: 'open', opening: 'confirmed' });
    });
    const operations = t
      .batches()
      .flatMap((batch) => (batch.body as { operations: unknown[] }).operations);
    expect(operations).toHaveLength(2);
    const [opening, sale] = operations as { kind: string; body: Record<string, unknown> }[];
    expect(opening?.kind).toBe('shift-open');
    expect(sale?.kind).toBe('sale');
    expect(sale?.body).toEqual({
      operationId: expect.any(String),
      shiftId: opening?.body['shiftId'],
      folio: 'AA-000001',
      total: 6_400,
      lines: [
        {
          productId: product.id,
          quantityMilli: 2_000,
          unitPrice: 3_200,
          discount: 0,
          taxRateBp: 1_900,
          taxKind: 'taxed',
        },
      ],
      payments: [{ method: 'cash', amount: 6_400, reference: null }],
      deviceTime: '2026-10-19T13:00:00.000Z',
      clockOffsetMs: null,
    });
    t.stop();
  });

  it('gives the next folio to the next sale, and keeps the series after the application is closed and opened again', async () => {
    const t = await wire();
    await t.shifts.open(0);
    t.selling.add(item(1));
    await t.selling.confirm({ method: 'cash', received: 3_200 });
    t.stop();
    await t.workspace.leave();
    await t.workspace.begin(me);
    const reopened = createSelling({
      workspace: t.workspace,
      sync: { queued: () => Promise.resolve(), clockOffsetMs: () => null },
      shifts: { refresh: () => Promise.resolve() },
      copy: t.copy,
      now: () => new Date('2026-10-19T14:00:00.000Z'),
      fillRandom: (bytes) => crypto.getRandomValues(bytes),
    });
    reopened.add(item(2));

    const receipt = await reopened.confirm({ method: 'card', reference: null });

    expect(receipt.folio).toBe('AA-000002');
  });
});
