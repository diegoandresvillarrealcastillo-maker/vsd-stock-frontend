// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '../domain/model/me';
import type { ApiGateway, ApiRequest, ApiResponse } from '../domain/ports/out/api-gateway';
import { settle } from '../../test/support/connection';
import { FakeConnection } from '../../test/support/fake-sync';
import { createLocalWorkspace } from './create-local-workspace';
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

/** Todo cableado como en el navegador, sobre una base de IndexedDB en memoria. */
async function wire(status: 'online' | 'offline') {
  const sent: ApiRequest[] = [];
  const api = server(sent);
  let now = new Date('2026-10-19T13:00:00.000Z');
  const workspace = createLocalWorkspace({
    api,
    now: () => now,
    getStorage: memoryStorage,
    fillRandom: (bytes) => crypto.getRandomValues(bytes),
  });
  const connection = new FakeConnection(status);
  const sync = createSyncEngine({
    api,
    workspace,
    connection,
    locks: undefined,
    now: () => now,
  });
  const shifts = createShifts({
    workspace,
    sync,
    now: () => now,
    fillRandom: (bytes) => crypto.getRandomValues(bytes),
  });
  await workspace.begin(me);
  await workspace.registerDevice();
  shifts.start();
  sync.start();
  await settle();
  const batches = () => sent.filter((request) => request.path === '/v1/sync');
  return {
    workspace,
    connection,
    sync,
    shifts,
    batches,
    advance: (to: string) => {
      now = new Date(to);
    },
    stop: () => {
      shifts.stop();
      sync.stop();
    },
  };
}

describe('createShifts', () => {
  it('opens the shift without a connection and sends it, exactly as the route takes it, when the connection returns', async () => {
    const t = await wire('offline');

    await t.shifts.open(50_000);
    await settle();

    expect(t.batches()).toHaveLength(0);
    expect(t.shifts.current()).toMatchObject({ status: 'open', opening: 'waiting' });

    t.connection.go('online');
    // La base de IndexedDB tarda varios turnos del navegador: se espera a lo que se quiere ver, no a un tiempo.
    await vi.waitFor(() => {
      expect(t.shifts.current()).toMatchObject({ status: 'open', opening: 'confirmed' });
    });

    const [batch] = t.batches();
    const { operations } = batch?.body as { operations: Record<string, unknown>[] };
    expect(operations).toHaveLength(1);
    expect(operations[0]).toEqual({
      kind: 'shift-open',
      body: {
        operationId: expect.any(String),
        shiftId: expect.any(String),
        deviceId: t.workspace.current()?.deviceId,
        openingAmount: 50_000,
        deviceTime: '2026-10-19T13:00:00.000Z',
        clockOffsetMs: null,
      },
    });
    t.stop();
  });

  it('closes it afterwards with the shift beside the body, in the order the person did things', async () => {
    const t = await wire('offline');
    await t.shifts.open(50_000);
    t.advance('2026-10-19T23:15:00.000Z');

    await t.shifts.close(48_000);
    t.connection.go('online');
    await vi.waitFor(() => {
      expect(t.shifts.current()).toMatchObject({ status: 'closed', closing: 'confirmed' });
    });

    const operations = t
      .batches()
      .flatMap((batch) => (batch.body as { operations: unknown[] }).operations);
    expect(operations).toHaveLength(2);
    const [opening, closing] = operations as {
      kind: string;
      shiftId?: string;
      body: Record<string, unknown>;
    }[];
    expect(opening?.kind).toBe('shift-open');
    expect(closing?.kind).toBe('shift-close');
    expect(closing?.shiftId).toBe(opening?.body['shiftId']);
    expect(closing?.body).toEqual({
      operationId: expect.any(String),
      countedAmount: 48_000,
      deviceTime: '2026-10-19T23:15:00.000Z',
      clockOffsetMs: null,
    });
    expect(t.shifts.current()).toMatchObject({
      status: 'closed',
      summary: { expectedAmount: 50_000, countedAmount: 48_000, difference: -2_000 },
      closing: 'confirmed',
    });
    t.stop();
  });

  it('keeps the shift after the application is closed and opened again', async () => {
    const t = await wire('offline');
    await t.shifts.open(50_000);
    t.stop();
    await t.workspace.leave();

    await t.workspace.begin(me);
    const reopened = createShifts({
      workspace: t.workspace,
      sync: t.sync,
      now: () => new Date('2026-10-19T14:00:00.000Z'),
      fillRandom: (bytes) => crypto.getRandomValues(bytes),
    });
    await reopened.refresh();

    expect(reopened.current()).toMatchObject({
      status: 'open',
      summary: { openingAmount: 50_000 },
      opening: 'waiting',
    });
  });
});
