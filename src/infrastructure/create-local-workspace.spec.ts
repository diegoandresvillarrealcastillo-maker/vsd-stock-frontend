// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { CounterLockedError } from '../domain/model/local-errors';
import type { Me } from '../domain/model/me';
import type { ApiGateway, ApiRequest, ApiResponse } from '../domain/ports/out/api-gateway';
import { createLocalWorkspace } from './create-local-workspace';

const AUTH_ID = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const HOUR = 3_600_000;
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

/** Un almacenamiento local en memoria: lo que el navegador deja guardado entre una visita y otra. */
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

/** El servidor registra el dispositivo que le llega con el identificador que trae y le da el codigo `AA`. */
function serverThatRegisters(sent: ApiRequest[]): ApiGateway {
  return {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      const { id } = request.body as { id: string };
      return Promise.resolve({ status: 201, body: { id, code: 'AA' } as T, replayed: false });
    },
  };
}

let clock = new Date('2026-10-19T12:00:00.000Z');

/** Una "visita" a la aplicacion: se arma de nuevo, como al recargar la pagina, sobre el mismo navegador. */
function visit(storage: Storage) {
  const sent: ApiRequest[] = [];
  const workspace = createLocalWorkspace({
    api: serverThatRegisters(sent),
    now: () => clock,
    getStorage: () => storage,
    fillRandom: (bytes) => crypto.getRandomValues(bytes),
  });
  return { workspace, sent };
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  clock = new Date('2026-10-19T12:00:00.000Z');
});

describe('createLocalWorkspace', () => {
  it('registers the device with an identifier it invented and numbers the sales of that device', async () => {
    const { workspace, sent } = visit(memoryStorage());
    await workspace.begin(me);

    await workspace.registerDevice();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/v1/devices' });
    expect((sent[0]?.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(workspace.current()?.deviceCode).toBe('AA');
    expect(await workspace.nextFolio()).toBe('AA-000001');
    expect(await workspace.nextFolio()).toBe('AA-000002');
  });

  it('keeps the series and the device across visits: the next page load goes on from where it was', async () => {
    const storage = memoryStorage();
    const first = visit(storage);
    await first.workspace.begin(me);
    await first.workspace.registerDevice();
    await first.workspace.nextFolio();
    await first.workspace.nextFolio();
    await first.workspace.leave();

    const later = visit(storage);
    await later.workspace.resume();

    expect(later.workspace.current()).toMatchObject({ deviceCode: 'AA', resumed: true });
    expect(await later.workspace.nextFolio()).toBe('AA-000003');
    expect(later.sent).toEqual([]);
  });

  it('remembers who worked last, and resumes the counter without a connection until the seventy-two hours pass', async () => {
    const storage = memoryStorage();
    const first = visit(storage);
    await first.workspace.begin(me);
    await first.workspace.leave();

    clock = new Date(clock.getTime() + 71 * HOUR);
    const inTime = visit(storage);
    expect(await inTime.workspace.lastPerson()).toMatchObject({
      state: 'available',
      access: { state: 'open' },
    });
    await expect(inTime.workspace.resume()).resolves.toBeUndefined();

    clock = new Date(clock.getTime() + 2 * HOUR);
    const tooLate = visit(storage);
    expect(await tooLate.workspace.lastPerson()).toMatchObject({
      state: 'available',
      access: { state: 'locked', reason: 'expired' },
    });
    await expect(tooLate.workspace.resume()).rejects.toBeInstanceOf(CounterLockedError);
  });

  it('forgets everything in one step: nobody is remembered and nothing is left on the disk', async () => {
    const storage = memoryStorage();
    const first = visit(storage);
    await first.workspace.begin(me);

    await first.workspace.forget();

    expect(await indexedDB.databases()).toEqual([]);
    expect(await visit(storage).workspace.lastPerson()).toEqual({ state: 'none' });
  });
});
