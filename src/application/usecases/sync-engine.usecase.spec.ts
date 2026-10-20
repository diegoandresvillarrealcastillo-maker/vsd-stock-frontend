import { describe, expect, it, vi } from 'vitest';
import { NoWorkspaceError } from '../../domain/model/local-errors';
import type { Outbox } from '../../domain/ports/in/outbox';
import type { SyncResponse } from '../../domain/ports/out/sync-api';
import { MAX_ROUND_TRIP_MS } from '../../domain/model/clock-offset';
import { testMe } from '../../../test/support/auth';
import { settle } from '../../../test/support/connection';
import { deferred } from '../../../test/support/deferred';
import {
  applied,
  createTestSync,
  failure,
  NO_LUCK,
  refused,
  saleOperation,
  type TestSync,
} from '../../../test/support/fake-sync';
import { SyncEngineUseCase } from './sync-engine.usecase';

/** Deja n ventas esperando en la cola de quien trabaja, sin que el motor se entere. */
async function queue(t: TestSync, count: number, from = 1): Promise<string[]> {
  const ids: string[] = [];
  for (let n = from; n < from + count; n += 1) {
    await t.local.workspace.outbox().enqueue(saleOperation(n));
    ids.push(saleOperation(n).operationId);
  }
  return ids;
}

const counts = async (t: TestSync) => await t.local.workspace.outbox().counts();

describe('SyncEngineUseCase', () => {
  describe('sending what waits', () => {
    it('sends the queue when it is online, and what the server accepted leaves the queue', async () => {
      const t = await createTestSync();
      const ids = await queue(t, 3);

      await t.engine.syncNow();

      expect(t.api.sent).toEqual(ids);
      expect(await counts(t)).toEqual({ pending: 0, attention: 0 });
      expect(t.engine.current()).toMatchObject({
        phase: 'idle',
        pending: 0,
        attention: 0,
        lastSyncedAt: t.clock.now(),
        sessionExpired: false,
        nextTryAt: null,
        fault: null,
      });
    });

    it('sends the oldest first, twenty at a time, until nothing waits', async () => {
      const t = await createTestSync();
      const ids = await queue(t, 45);

      await t.engine.syncNow();

      expect(t.api.batches.map((batch) => batch.length)).toEqual([20, 20, 5]);
      expect(t.api.sent).toEqual(ids);
      expect((await counts(t)).pending).toBe(0);
    });

    it('does nothing when nothing waits: no request is made', async () => {
      const t = await createTestSync();

      await t.engine.syncNow();

      expect(t.api.batches).toEqual([]);
      expect(t.engine.current().lastSyncedAt).toBeNull();
    });

    it('does not send while offline, and leaves everything waiting', async () => {
      const t = await createTestSync({ status: 'offline' });
      await queue(t, 2);

      await t.engine.syncNow();

      expect(t.api.batches).toEqual([]);
      expect((await counts(t)).pending).toBe(2);
    });

    it('does not send while the connection is only being checked: only the server answering is online', async () => {
      const t = await createTestSync({ status: 'checking' });
      await queue(t, 1);

      await t.engine.syncNow();

      expect(t.api.batches).toEqual([]);
    });

    it('sends what waits as soon as the connection comes back, once it is started', async () => {
      const t = await createTestSync({ status: 'offline' });
      const ids = await queue(t, 2);
      t.engine.start();
      await settle();
      expect(t.api.batches).toEqual([]);

      t.connection.go('online');
      await settle();

      expect(t.api.sent).toEqual(ids);
    });

    it('sends what waits when it starts, if it is already online', async () => {
      const t = await createTestSync();
      const ids = await queue(t, 2);

      t.engine.start();
      await settle();

      expect(t.api.sent).toEqual(ids);
    });

    it('gives a repeated operation up as done as well: the answer was lost, not the operation', async () => {
      const t = await createTestSync();
      await queue(t, 2);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: operations.map((operation) => applied(operation, true)),
      }));

      await t.engine.syncNow();

      expect((await counts(t)).pending).toBe(0);
    });
  });

  describe('adding to the queue', () => {
    it('keeps the operation and sends it right away when it can', async () => {
      const t = await createTestSync();

      await t.engine.enqueue(saleOperation(1));
      await settle();

      expect(t.api.sent).toEqual([saleOperation(1).operationId]);
      expect((await counts(t)).pending).toBe(0);
    });

    it('keeps it, and counts it, when it can not send: nothing is lost by being offline', async () => {
      const t = await createTestSync({ status: 'offline' });

      await t.engine.enqueue(saleOperation(1));
      await settle();

      expect(t.api.batches).toEqual([]);
      expect(t.engine.current().pending).toBe(1);
    });

    it('needs someone working', async () => {
      const t = await createTestSync({ working: false });

      await expect(t.engine.enqueue(saleOperation(1))).rejects.toBeInstanceOf(NoWorkspaceError);
    });
  });

  describe('something that went into the queue by another way', () => {
    /** Un turno guardado junto con su operacion, que es lo que hace el turno de caja: el motor no pasa por ahi. */
    const openShift = async (t: TestSync) => {
      const operation = {
        operationId: '00000000-0000-4000-8000-0000000000a1',
        kind: 'shift-open' as const,
        body: { openingAmount: 50_000 },
        createdAt: new Date('2026-10-19T13:02:00.000Z'),
      };
      await t.local.workspace.shifts().saveShift(
        {
          shiftId: '00000000-0000-4000-8000-0000000000b1',
          deviceId: '00000000-0000-4000-8000-0000000000d1',
          openOperationId: operation.operationId,
          openedAt: '2026-10-19T13:02:00.000Z',
          openingAmount: 50_000,
          sales: { cashCount: 0, cashAmount: 0, otherCount: 0, otherAmount: 0 },
          closing: null,
        },
        operation,
      );
      return operation.operationId;
    };

    it('counts it and sends it right away when it can', async () => {
      const t = await createTestSync();
      const id = await openShift(t);

      await t.engine.queued();
      await settle();

      expect(t.api.sent).toEqual([id]);
      expect(await counts(t)).toEqual({ pending: 0, attention: 0 });
    });

    it('counts it and keeps it when it can not send: nothing is lost by being offline', async () => {
      const t = await createTestSync({ status: 'offline' });
      await openShift(t);

      await t.engine.queued();
      await settle();

      expect(t.api.batches).toEqual([]);
      expect(t.engine.current().pending).toBe(1);
    });

    it('has nothing to say when nobody works: there is no queue to count', async () => {
      const t = await createTestSync({ working: false });

      await expect(t.engine.queued()).resolves.toBeUndefined();

      expect(t.engine.current().pending).toBe(0);
    });
  });

  describe('what the server says about each operation', () => {
    it('sets apart the one it rejected, with why, and goes on with the rest', async () => {
      const t = await createTestSync();
      const [first, second, third] = await queue(t, 3);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: [
          applied(operations[0]!),
          refused(operations[1]!, 400, 'validation-failed'),
          applied(operations[2]!),
        ],
      }));

      await t.engine.syncNow();

      expect(await counts(t)).toEqual({ pending: 0, attention: 1 });
      const [rejected] = await t.local.workspace.outbox().attention();
      expect(rejected).toMatchObject({
        operationId: second,
        attention: { class: 'permanent', status: 400, code: 'validation-failed' },
      });
      expect(t.api.sent).toEqual([first, second, third]);
      expect(t.engine.current()).toMatchObject({ pending: 0, attention: 1 });
    });

    it('sets a conflict apart as well, and never sends it again by itself', async () => {
      const t = await createTestSync();
      const [only] = await queue(t, 1);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: [refused(operations[0]!, 409, 'shift-already-open')],
      }));
      await t.engine.syncNow();

      await t.engine.syncNow();

      expect(t.api.sent).toEqual([only]);
      const [conflict] = await t.local.workspace.outbox().attention();
      expect(conflict?.attention).toEqual({
        class: 'conflict',
        status: 409,
        code: 'shift-already-open',
      });
    });

    it('keeps waiting the one that may still pass, and counts an attempt', async () => {
      const t = await createTestSync();
      const [first, second] = await queue(t, 2);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: [applied(operations[0]!), refused(operations[1]!, 503, 'service-unavailable')],
      }));

      await t.engine.syncNow();

      const [waiting, ...rest] = await t.local.workspace.outbox().nextBatch();
      expect(rest).toEqual([]);
      expect(waiting).toMatchObject({ operationId: second, attempts: 1, state: 'pending' });
      expect(t.api.sent).toEqual([first, second]);
    });

    it('stops everything on a 401 inside the batch: the session is what failed, and the queue is kept', async () => {
      const t = await createTestSync();
      const [first, second, third] = await queue(t, 3);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: [
          applied(operations[0]!),
          refused(operations[1]!, 401, 'unauthenticated'),
          applied(operations[2]!),
        ],
      }));

      await t.engine.syncNow();

      expect(t.engine.current().sessionExpired).toBe(true);
      const left = (await t.local.workspace.outbox().nextBatch()).map(
        (queued) => queued.operationId,
      );
      expect(left).toEqual([second, third]);
      expect(first).toBe(saleOperation(1).operationId);
      expect(t.scheduler.waiting).toBe(0);
    });
  });

  describe('when it fails and has to wait', () => {
    it('waits two seconds after a result that may pass, then sends again and settles', async () => {
      const t = await createTestSync();
      const [only] = await queue(t, 1);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: [refused(operations[0]!, 503, 'service-unavailable')],
      }));

      await t.engine.syncNow();

      expect(t.engine.current()).toMatchObject({
        phase: 'waiting',
        pending: 1,
        nextTryAt: new Date(t.clock.now().getTime() + 2_000),
      });
      expect(t.scheduler.delays).toEqual([2_000]);

      t.scheduler.advance(2_000);
      await settle();

      expect(t.api.sent).toEqual([only, only]);
      expect(t.engine.current()).toMatchObject({ phase: 'idle', pending: 0, nextTryAt: null });
    });

    it('waits longer with each failure in a row, and starts over when something goes through', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      for (let n = 0; n < 3; n += 1) t.api.failNext(failure('transient'));

      await t.engine.syncNow();
      t.scheduler.advance(2_000);
      await settle();
      t.scheduler.advance(4_000);
      await settle();
      t.scheduler.advance(8_000);
      await settle();

      expect(t.scheduler.delays).toEqual([2_000, 4_000, 8_000]);
      expect(t.engine.current().pending).toBe(0);

      await queue(t, 1, 2);
      t.api.failNext(failure('transient'));
      await t.engine.syncNow();

      expect(t.scheduler.delays.at(-1)).toBe(2_000);
    });

    it('waits at least as long as the server asked', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('transient', { status: 429, retryAfterMs: 30_000 }));

      await t.engine.syncNow();

      expect(t.scheduler.delays).toEqual([30_000]);
    });

    it('counts an attempt for every operation of a batch that failed as a whole', async () => {
      const t = await createTestSync();
      await queue(t, 3);
      t.api.failNext(failure('transient'));

      await t.engine.syncNow();

      const waiting = await t.local.workspace.outbox().nextBatch();
      expect(waiting.map((queued) => queued.attempts)).toEqual([1, 1, 1]);
    });

    it('treats a request the server refused as a whole like one that may pass, and says why', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('permanent', { status: 413, code: 'payload-too-large' }));

      await t.engine.syncNow();

      expect(t.engine.current()).toMatchObject({
        phase: 'waiting',
        fault: { status: 413, code: 'payload-too-large' },
      });
      expect((await counts(t)).attention).toBe(0);
    });

    it('treats an answer that is not the contract as a failure that may pass', async () => {
      const t = await createTestSync();
      await queue(t, 2);
      t.api.next(() => ({ serverTime: t.clock.now(), results: [] }));

      await t.engine.syncNow();

      expect(t.engine.current().phase).toBe('waiting');
      expect((await counts(t)).pending).toBe(2);
    });

    it('treats an answer about other operations as a failure too: it would settle the wrong ones', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.next(() => ({
        serverTime: t.clock.now(),
        results: [applied(saleOperation(99) as never)],
      }));

      await t.engine.syncNow();

      expect((await counts(t)).pending).toBe(1);
      expect(t.engine.current().phase).toBe('waiting');
    });

    it('treats an error nobody foresaw as a failure that may pass, so the queue does not block', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(new Error('algo raro'));

      await t.engine.syncNow();

      expect(t.engine.current().phase).toBe('waiting');
      expect((await counts(t)).pending).toBe(1);
    });

    it('lets the person try again now instead of waiting', async () => {
      const t = await createTestSync();
      const [only] = await queue(t, 1);
      t.api.failNext(failure('transient'));
      await t.engine.syncNow();
      expect(t.scheduler.waiting).toBe(1);

      await t.engine.syncNow();

      expect(t.api.sent).toEqual([only, only]);
      expect(t.scheduler.waiting).toBe(0);
      expect(t.engine.current().phase).toBe('idle');
    });
  });

  describe('when there is no network or no session', () => {
    it('stops without counting an attempt when the request got no answer, and asks the connection to check', async () => {
      const t = await createTestSync();
      await queue(t, 2);
      t.api.failNext(failure('network'));

      await t.engine.syncNow();

      const waiting = await t.local.workspace.outbox().nextBatch();
      expect(waiting.map((queued) => queued.attempts)).toEqual([0, 0]);
      expect(t.connection.retries).toBe(1);
      expect(t.scheduler.waiting).toBe(0);
      expect(t.engine.current()).toMatchObject({ phase: 'idle', pending: 2, fault: null });
    });

    it('goes on by itself when the connection says it is back after a network failure', async () => {
      const t = await createTestSync();
      const ids = await queue(t, 1);
      t.api.failNext(failure('network'));
      t.engine.start();
      await settle();
      t.connection.go('offline');
      await settle();

      t.connection.go('online');
      await settle();

      expect(t.api.sent).toEqual([ids[0], ids[0]]);
      expect((await counts(t)).pending).toBe(0);
    });

    it('stops on a 401, says the session expired, keeps the queue and does not try again by itself', async () => {
      const t = await createTestSync();
      await queue(t, 2);
      t.api.failNext(failure('session'));

      await t.engine.syncNow();

      expect(t.engine.current()).toMatchObject({ sessionExpired: true, pending: 2, phase: 'idle' });
      expect(t.scheduler.waiting).toBe(0);
      const waiting = await t.local.workspace.outbox().nextBatch();
      expect(waiting.map((queued) => queued.attempts)).toEqual([0, 0]);
    });

    it('does not insist while the session is expired: a connection that comes back does not send', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('session'));
      t.engine.start();
      await settle();
      expect(t.api.batches).toHaveLength(1);

      t.connection.go('offline');
      t.connection.go('online');
      await settle();

      expect(t.api.batches).toHaveLength(1);
    });

    it('tries again by itself when someone starts working, since they may have signed in again', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('session'));
      t.engine.start();
      await settle();
      expect(t.engine.current().sessionExpired).toBe(true);

      await t.local.workspace.begin(testMe('ana', 'cashier'));
      await settle();

      expect(t.engine.current()).toMatchObject({ sessionExpired: false, pending: 0 });
    });

    it('tries again when the person asks', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('session'));
      await t.engine.syncNow();
      expect(t.engine.current().sessionExpired).toBe(true);

      await t.engine.syncNow();

      expect(t.engine.current()).toMatchObject({ sessionExpired: false, pending: 0 });
    });
  });

  describe('one at a time', () => {
    it('shares one run between two requests made at the same moment', async () => {
      const t = await createTestSync();
      await queue(t, 2);

      await Promise.all([t.engine.syncNow(), t.engine.syncNow()]);

      expect(t.api.batches).toHaveLength(1);
      expect(t.runner.runs).toBe(1);
    });

    it('leaves the sending to another tab that is already doing it, and only looks at the queue', async () => {
      const t = await createTestSync();
      await queue(t, 2);
      t.runner.busy = true;

      await t.engine.syncNow();

      expect(t.api.batches).toEqual([]);
      expect(t.engine.current().pending).toBe(2);
      expect(t.scheduler.waiting).toBe(0);
    });
  });

  describe('when the person changes', () => {
    it('stops quietly if the person who was working stops while a batch is out, and does not touch the next one', async () => {
      const t = await createTestSync();
      const [first] = await queue(t, 1);
      t.api.next((operations) => {
        // Mientras el lote esta en el aire, la persona cambia.
        void t.local.workspace
          .leave()
          .then(() => t.local.workspace.begin(testMe('luis', 'cashier')));
        return {
          serverTime: t.clock.now(),
          results: operations.map((operation) => applied(operation)),
        };
      });

      await expect(t.engine.syncNow()).resolves.toBeUndefined();
      await settle();

      expect(t.api.sent).toEqual([first]);
      expect((await counts(t)).pending).toBe(0);
      expect(t.local.stores.dataOf('luis').queue).toEqual([]);
      expect(t.local.stores.dataOf('ana').queue).toHaveLength(1);
    });

    it('sends nothing, and counts nothing, when nobody is working', async () => {
      const t = await createTestSync({ working: false });

      await t.engine.syncNow();

      expect(t.api.batches).toEqual([]);
      expect(t.engine.current()).toMatchObject({ pending: 0, attention: 0, phase: 'idle' });
    });

    it('counts what the new person has waiting as soon as they start working', async () => {
      const t = await createTestSync({ working: false, status: 'offline' });
      t.local.stores.dataOf('ana').queue.push({
        ...saleOperationQueued(1),
      });
      t.engine.start();

      await t.local.workspace.begin(testMe('ana', 'cashier'));
      await settle();

      expect(t.engine.current().pending).toBe(1);
      await t.local.workspace.leave();
      await settle();
      expect(t.engine.current().pending).toBe(0);
    });
  });

  describe('the clock of the device', () => {
    it('measures how far the server is ahead from the hour it gives, in the middle of the trip', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.latencyMs = 400;
      t.api.serverAheadMs = 90_000;

      await t.engine.syncNow();

      expect(t.engine.clockOffsetMs()).toBe(90_000);
    });

    it('does not know it until something was sent', async () => {
      const t = await createTestSync();

      expect(t.engine.clockOffsetMs()).toBeNull();
    });

    it('keeps the last good measurement when a trip took too long to trust', async () => {
      const t = await createTestSync();
      await queue(t, 2);
      t.api.serverAheadMs = 5_000;
      await t.engine.syncNow();
      expect(t.engine.clockOffsetMs()).toBe(5_000);
      await queue(t, 1, 3);
      t.api.latencyMs = MAX_ROUND_TRIP_MS + 1;
      t.api.serverAheadMs = 80_000;

      await t.engine.syncNow();

      expect(t.engine.clockOffsetMs()).toBe(5_000);
    });

    it('does not measure from a trip that failed', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('transient'));

      await t.engine.syncNow();

      expect(t.engine.clockOffsetMs()).toBeNull();
    });
  });

  describe('starting and stopping', () => {
    it('does not listen twice if it is started twice', async () => {
      const t = await createTestSync();

      t.engine.start();
      t.engine.start();

      expect(t.connection.subscribers).toBe(1);
    });

    it('stops listening and cancels the wait when it is stopped', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('transient'));
      t.engine.start();
      await settle();
      expect(t.scheduler.waiting).toBe(1);

      t.engine.stop();

      expect(t.scheduler.waiting).toBe(0);
      expect(t.connection.subscribers).toBe(0);
    });

    it('tells those who listen of every change, and no longer after they stop listening', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      const listener = vi.fn();
      const stop = t.engine.subscribe(listener);

      await t.engine.syncNow();
      const calls = listener.mock.calls.length;
      stop();
      await queue(t, 1, 2);
      await t.engine.syncNow();

      expect(calls).toBeGreaterThan(0);
      expect(listener).toHaveBeenCalledTimes(calls);
    });

    it('is the same object while nothing changes', async () => {
      const t = await createTestSync();

      const before = t.engine.current();
      await t.engine.syncNow();

      expect(t.engine.current()).toBe(before);
    });
  });

  describe('what the person sees while it works', () => {
    it('counts what waits before the first batch goes out, so the person sees how much is being sent', async () => {
      const t = await createTestSync();
      await queue(t, 3);
      const gate = deferred<SyncResponse>();
      t.api.next(() => gate.promise);

      t.engine.start();
      await settle();

      expect(t.engine.current()).toMatchObject({ phase: 'sending', pending: 3 });
      gate.resolve(t.api.accept(t.api.batches[0]!));
      await settle();
      expect(t.engine.current()).toMatchObject({ phase: 'idle', pending: 0 });
    });

    it('counts again between one batch and the next: the second goes out with what is really left', async () => {
      const t = await createTestSync();
      await queue(t, 25);
      const gate = deferred<SyncResponse>();
      t.api.next((operations) => t.api.accept(operations));
      t.api.next(() => gate.promise);

      const sending = t.engine.syncNow();
      await settle();

      expect(t.engine.current()).toMatchObject({ phase: 'sending', pending: 5 });
      gate.resolve(t.api.accept(t.api.batches[1]!));
      await sending;
    });

    it('forgets the reason and the wait of a failure once something goes through', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('permanent', { status: 413, code: 'payload-too-large' }));
      await t.engine.syncNow();
      expect(t.engine.current()).toMatchObject({ fault: { status: 413 } });
      expect(t.engine.current().nextTryAt).not.toBeNull();

      await t.engine.syncNow();

      expect(t.engine.current()).toMatchObject({ phase: 'idle', fault: null, nextTryAt: null });
    });

    it('says the time of the answer, not the time it was sent, when the trip took a while', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      const sentAt = t.clock.now();
      t.api.latencyMs = 1_000;

      await t.engine.syncNow();

      expect(t.engine.current().lastSyncedAt).toEqual(new Date(sentAt.getTime() + 1_000));
    });

    it('does not give a reason when what failed may simply pass: only a refusal of the whole request has one', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('transient', { status: 503 }));

      await t.engine.syncNow();

      expect(t.engine.current()).toMatchObject({ phase: 'waiting', fault: null });
    });

    it('stops saying when it will try again once the wait is over and it is sending', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('transient'));
      await t.engine.syncNow();
      expect(t.engine.current().nextTryAt).not.toBeNull();
      const gate = deferred<SyncResponse>();
      t.api.next(() => gate.promise);

      t.scheduler.advance(2_000);
      await settle();

      expect(t.engine.current()).toMatchObject({ phase: 'sending', nextTryAt: null });
      gate.resolve(t.api.accept(t.api.batches[1]!));
      await settle();
    });

    it('counts what is queued even while the session is expired, without trying to send it', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('session'));
      await t.engine.syncNow();
      expect(t.engine.current().sessionExpired).toBe(true);

      await t.engine.enqueue(saleOperation(2));

      expect(t.engine.current().pending).toBe(2);
      expect(t.api.batches).toHaveLength(1);
    });
  });

  describe('the waits in detail', () => {
    it('also waits longer when it is one operation, and not the whole request, that may pass', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      for (let n = 0; n < 2; n += 1) {
        t.api.next((operations) => ({
          serverTime: t.clock.now(),
          results: [refused(operations[0]!, 503, 'service-unavailable')],
        }));
      }

      await t.engine.syncNow();
      t.scheduler.advance(2_000);
      await settle();

      expect(t.scheduler.delays).toEqual([2_000, 4_000]);
    });

    it('waits at least as long as the server asked even when it refused the whole request', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.failNext(failure('permanent', { status: 413, retryAfterMs: 30_000 }));

      await t.engine.syncNow();

      expect(t.scheduler.delays).toEqual([30_000]);
    });

    it('spreads the wait with luck: with the best luck it waits half', async () => {
      const t = await createTestSync({ random: { next: () => 0 } });
      await queue(t, 1);
      t.api.failNext(failure('transient'));

      await t.engine.syncNow();

      expect(t.scheduler.delays).toEqual([1_000]);
    });
  });

  describe('a connection that is not online does not wake it', () => {
    it.each(['offline', 'checking'] as const)(
      'does not try to send when the connection says %s',
      async (status) => {
        const t = await createTestSync();
        await queue(t, 1);
        t.engine.start();
        await settle();
        const runs = t.runner.runs;

        t.connection.go(status);
        await settle();

        expect(t.runner.runs).toBe(runs);
      },
    );
  });

  describe('what the server did not know how to read', () => {
    it('sets apart the operation it could not even identify, by its place in the batch', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      t.api.next((operations) => ({
        serverTime: t.clock.now(),
        results: [{ ...refused(operations[0]!, 400, 'validation-failed'), operationId: null }],
      }));

      await t.engine.syncNow();

      expect(await counts(t)).toEqual({ pending: 0, attention: 1 });
      expect(t.engine.current().phase).toBe('idle');
    });
  });

  describe('starting again after stopping', () => {
    it('listens again when it is started after being stopped', async () => {
      const t = await createTestSync();

      t.engine.start();
      t.engine.stop();
      t.engine.start();

      expect(t.connection.subscribers).toBe(1);
    });
  });

  describe('an error nobody foresaw in the queue itself', () => {
    /** Un motor sobre la misma base, cuya cola falla como la prueba lo pida. */
    function brokenEngine(t: TestSync, broken: Partial<Outbox> | 'unavailable') {
      const real = t.local.workspace.outbox();
      const outbox: Outbox = {
        enqueue: (operation) => real.enqueue(operation),
        nextBatch: () => real.nextBatch(),
        settle: (settlements) => real.settle(settlements),
        counts: () => real.counts(),
        attention: () => real.attention(),
        ...(broken === 'unavailable' ? {} : broken),
      };
      const workspace = new Proxy(t.local.workspace, {
        get(target, property) {
          if (property === 'outbox') {
            return () => {
              if (broken === 'unavailable') throw new Error('boom');
              return outbox;
            };
          }
          const value = Reflect.get(target, property) as unknown;
          return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
        },
      });
      return new SyncEngineUseCase({
        workspace,
        api: t.api,
        connection: t.connection,
        runner: t.runner,
        scheduler: t.scheduler,
        clock: t.clock,
        random: NO_LUCK,
      });
    }

    it('is not swallowed when the queue can not be opened: whoever asked finds out', async () => {
      const t = await createTestSync();

      await expect(brokenEngine(t, 'unavailable').syncNow()).rejects.toThrow('boom');
    });

    it('is not swallowed when the next batch can not be read', async () => {
      const t = await createTestSync();
      await queue(t, 1);
      const engine = brokenEngine(t, { nextBatch: () => Promise.reject(new Error('boom')) });

      await expect(engine.syncNow()).rejects.toThrow('boom');
    });

    it('is not swallowed when what waits can not be counted', async () => {
      const t = await createTestSync();
      const engine = brokenEngine(t, { counts: () => Promise.reject(new Error('boom')) });

      await expect(engine.syncNow()).rejects.toThrow('boom');
    });
  });
});

function saleOperationQueued(n: number) {
  const operation = saleOperation(n);
  return {
    operationId: operation.operationId,
    kind: operation.kind,
    shiftId: null,
    body: operation.body,
    createdAt: operation.createdAt.toISOString(),
    state: 'pending' as const,
    attempts: 0,
    attention: null,
  };
}
