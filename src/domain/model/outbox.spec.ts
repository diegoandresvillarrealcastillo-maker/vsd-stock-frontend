import { describe, expect, it } from 'vitest';
import {
  BATCH_BYTES,
  BATCH_SIZE,
  OPERATION_KINDS,
  actionOfResult,
  retryDelayMs,
  takeBatch,
  type QueuedOperation,
  type SyncResult,
} from './outbox';

const result = (change: Partial<SyncResult> = {}): SyncResult => ({
  operationId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  status: 201,
  replayed: false,
  body: null,
  problem: null,
  ...change,
});

const problem = (code: string, status: number) => ({
  type: `urn:vsd-stock:problem:${code}`,
  title: 'Título',
  status,
  detail: 'Detalle',
  instance: '/v1/sync',
  code,
  traceId: 'traza-1',
});

describe('what the device sends in a batch', () => {
  it('is the three things that can be done without a connection, and nothing else', () => {
    expect([...OPERATION_KINDS]).toEqual(['shift-open', 'shift-close', 'sale']);
  });

  it('is twenty operations or 64 KB at a time, whichever comes first (ADR 0028)', () => {
    expect(BATCH_SIZE).toBe(20);
    expect(BATCH_BYTES).toBe(64 * 1024);
  });
});

describe('what to do with the result of one operation', () => {
  it('is done when the server applied it, and it did not repeat anything', () => {
    expect(actionOfResult(result({ status: 201 }))).toEqual({ action: 'done', replayed: false });
  });

  it('is done when the server had already applied it before: the answer got lost, not the operation', () => {
    expect(actionOfResult(result({ status: 200, replayed: true }))).toEqual({
      action: 'done',
      replayed: true,
    });
  });

  it('is done, and not a repeat, when the server applied something that has no creation to report, like a closing', () => {
    expect(actionOfResult(result({ status: 200, replayed: false }))).toEqual({
      action: 'done',
      replayed: false,
    });
  });

  it.each([204, 299])('is done for any other success, like %i', (status) => {
    expect(actionOfResult(result({ status })).action).toBe('done');
  });

  it.each([408, 425, 429, 500, 502, 503, 504])(
    'tries again later when the server said %i: it may pass',
    (status) => {
      expect(actionOfResult(result({ status, problem: problem('algo', status) }))).toEqual({
        action: 'retry',
      });
    },
  );

  it('asks for attention, and keeps why, when the server found a conflict', () => {
    const action = actionOfResult(
      result({ status: 409, problem: problem('shift-already-open', 409) }),
    );

    expect(action).toEqual({
      action: 'attention',
      reason: { class: 'conflict', status: 409, code: 'shift-already-open' },
    });
  });

  it.each([400, 403, 404, 413, 422])(
    'asks for attention when the server said %i: sending it again will not change the answer',
    (status) => {
      const action = actionOfResult(
        result({ status, problem: problem('validation-failed', status) }),
      );

      expect(action).toEqual({
        action: 'attention',
        reason: { class: 'permanent', status, code: 'validation-failed' },
      });
    },
  );

  it('asks for attention even when the server did not say why', () => {
    expect(actionOfResult(result({ status: 400, problem: null }))).toEqual({
      action: 'attention',
      reason: { class: 'permanent', status: 400, code: null },
    });
  });

  it('stops everything on a 401: the session is what failed, not the operation', () => {
    expect(actionOfResult(result({ status: 401 }))).toEqual({ action: 'session' });
  });

  it.each([0, 100, 302, 399, 600, 200.5, Number.NaN])(
    'does not believe a status like %s: it is a failure that may pass',
    (status) => {
      expect(actionOfResult(result({ status }))).toEqual({ action: 'retry' });
    },
  );
});

describe('how long to wait before sending again', () => {
  const noLuck = () => 1;
  const worstLuck = () => 0;

  it('starts at two seconds and doubles with each failure in a row', () => {
    expect([1, 2, 3, 4].map((failures) => retryDelayMs(failures, null, noLuck))).toEqual([
      2_000, 4_000, 8_000, 16_000,
    ]);
  });

  it('never waits more than five minutes between tries', () => {
    expect(retryDelayMs(9, null, noLuck)).toBe(300_000);
    expect(retryDelayMs(40, null, noLuck)).toBe(300_000);
  });

  it('spreads the tries of many devices: with the worst luck it still waits half of it', () => {
    expect(retryDelayMs(3, null, worstLuck)).toBe(4_000);
    expect(retryDelayMs(3, null, () => 0.5)).toBe(6_000);
  });

  it('waits at least as long as the server asked', () => {
    expect(retryDelayMs(1, 30_000, noLuck)).toBe(30_000);
    expect(retryDelayMs(1, 30_000, worstLuck)).toBe(30_000);
    expect(retryDelayMs(9, 30_000, noLuck)).toBe(300_000);
  });

  it('does not wait for less than a failure in a row', () => {
    expect(retryDelayMs(0, null, noLuck)).toBe(2_000);
  });
});

describe('how a batch is put together', () => {
  const waiting = (count: number, size = 10): QueuedOperation[] =>
    Array.from({ length: count }, (_, index) => ({
      operationId: `op-${String(index)}`,
      kind: 'sale',
      shiftId: null,
      body: { relleno: 'x'.repeat(size) },
      createdAt: '2026-10-19T12:00:00.000Z',
      state: 'pending',
      attempts: 0,
      attention: null,
    }));
  const ids = (batch: readonly QueuedOperation[]) =>
    batch.map((operation) => operation.operationId);

  it('takes them all when there are few and they are small, in the order they came', () => {
    expect(ids(takeBatch(waiting(3)))).toEqual(['op-0', 'op-1', 'op-2']);
  });

  it('is empty when nothing waits', () => {
    expect(takeBatch([])).toEqual([]);
  });

  it('never takes more than twenty', () => {
    expect(takeBatch(waiting(45))).toHaveLength(20);
    expect(ids(takeBatch(waiting(45))).at(-1)).toBe('op-19');
  });

  it('stops before the bodies weigh more than 64 KB, and leaves the rest for the next batch', () => {
    // Cada cuerpo pesa 20 KB (y unos bytes de la llave): caben tres, no cuatro.
    const batch = takeBatch(waiting(10, 20 * 1024));

    expect(ids(batch)).toEqual(['op-0', 'op-1', 'op-2']);
  });

  it('takes what weighs exactly 64 KB, and not one byte more', () => {
    // El cuerpo es {"relleno":"..."}: lo que pesa sin relleno se descuenta para que cada operacion pese justo 32 KB.
    const overhead = new TextEncoder().encode(JSON.stringify({ relleno: '' })).length;
    const half = 32 * 1024 - overhead;

    expect(takeBatch(waiting(3, half))).toHaveLength(2);
    expect(takeBatch([...waiting(1, half), ...waiting(2, half + 1).slice(1)])).toHaveLength(1);
  });

  it('takes an operation that weighs more than the whole limit, alone, instead of keeping it forever', () => {
    const batch = takeBatch(waiting(3, 80 * 1024));

    expect(ids(batch)).toEqual(['op-0']);
  });

  it('counts bytes and not characters: an accent weighs two', () => {
    const heavy = (index: number): QueuedOperation => ({
      ...waiting(1)[0]!,
      operationId: `op-${String(index)}`,
      body: { relleno: 'é'.repeat(20 * 1024) },
    });

    // 20 K caracteres con tilde son 40 KB: solo uno cabe en 64 KB.
    expect(takeBatch([heavy(0), heavy(1), heavy(2)])).toHaveLength(1);
  });
});
