import { describe, expect, it, vi } from 'vitest';
import {
  DeviceNotRegisteredError,
  NoOpenShiftError,
  NoWorkspaceError,
  ShiftAlreadyOpenError,
} from '../../domain/model/local-errors';
import { MAX_PESOS } from '../../domain/model/money';
import { NO_SALES, type LocalShift } from '../../domain/model/shift';
import type { LocalWorkspace } from '../../domain/ports/in/local-workspace';
import type { ShiftStorage } from '../../domain/ports/in/shift-storage';
import { testMe } from '../../../test/support/auth';
import { settle } from '../../../test/support/connection';
import { deferred } from '../../../test/support/deferred';
import { createTestShifts, shiftId, type TestShifts } from '../../../test/support/fake-shifts';

const ANA = 'ana';
const OPENED_AT = '2026-10-19T13:02:00.000Z';

/** Un espacio de trabajo cuyo `shifts()` pasa por la prueba: en cada llamada puede dar otro almacen, o lanzar. */
function hookingShifts(
  change: (storage: ShiftStorage, call: number) => ShiftStorage,
): (real: LocalWorkspace) => LocalWorkspace {
  return (real) => {
    let calls = 0;
    return new Proxy(real, {
      get(target, property) {
        if (property === 'shifts') {
          return () => {
            calls += 1;
            return change(target.shifts(), calls);
          };
        }
        const value = Reflect.get(target, property) as unknown;
        return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
      },
    });
  };
}

const over = (real: ShiftStorage, patch: Partial<ShiftStorage>): ShiftStorage => ({
  readCurrentShift: () => real.readCurrentShift(),
  saveShift: (shift, operation) => real.saveShift(shift, operation),
  operationState: (operationId) => real.operationState(operationId),
  ...patch,
});

/** Un turno abierto como lo deja `open`, guardado directamente para las pruebas que parten de ahi. */
async function seedOpen(t: TestShifts, sales = NO_SALES): Promise<LocalShift> {
  const shift: LocalShift = {
    shiftId: shiftId(901),
    deviceId: t.local.workspace.current()?.deviceId ?? 'sin-dispositivo',
    openOperationId: shiftId(902),
    openedAt: OPENED_AT,
    openingAmount: 50_000,
    sales,
    closing: null,
  };
  await t.local.workspace.shifts().saveShift(shift, {
    operationId: shift.openOperationId,
    kind: 'shift-open',
    body: { openingAmount: 50_000 },
    createdAt: new Date(OPENED_AT),
  });
  return shift;
}

async function started(t: TestShifts): Promise<TestShifts> {
  t.shifts.start();
  await settle();
  return t;
}

describe('ShiftsUseCase', () => {
  describe('what it knows', () => {
    it('knows nothing until it is started: it did not look at what is saved yet', async () => {
      const t = await createTestShifts();

      expect(t.shifts.current()).toEqual({ status: 'loading' });
    });

    it('says there is no shift when none was ever opened', async () => {
      const t = await started(await createTestShifts());

      expect(t.shifts.current()).toEqual({ status: 'none' });
    });

    it('says there is no shift when nobody works', async () => {
      const t = await started(await createTestShifts({ working: false }));

      expect(t.shifts.current()).toEqual({ status: 'none' });
    });

    it('reads the open shift with the cash it expects, and its opening still waiting to be sent', async () => {
      const t = await createTestShifts();
      const shift = await seedOpen(t, {
        cashCount: 3,
        cashAmount: 120_000,
        otherCount: 2,
        otherAmount: 48_500,
      });

      await started(t);

      expect(t.shifts.current()).toEqual({
        status: 'open',
        shift: expect.objectContaining({ shiftId: shift.shiftId }),
        summary: expect.objectContaining({
          openingAmount: 50_000,
          cashCount: 3,
          cashAmount: 120_000,
          otherCount: 2,
          otherAmount: 48_500,
          expectedAmount: 170_000,
          countedAmount: null,
          difference: null,
        }),
        opening: 'waiting',
      });
    });

    it('says the server has the opening once it left the queue', async () => {
      const t = await createTestShifts();
      const shift = await seedOpen(t);
      await started(t);

      await t.local.stores.lastStore.resolveOperations([shift.openOperationId]);
      t.sync.set({ pending: 0, lastSyncedAt: new Date(OPENED_AT) });
      await settle();

      expect(t.shifts.current()).toMatchObject({ status: 'open', opening: 'confirmed' });
    });

    it('says the server did not accept the opening, when it set it apart', async () => {
      const t = await createTestShifts();
      const shift = await seedOpen(t);
      await started(t);

      await t.local.stores.lastStore.markAttention(shift.openOperationId, {
        class: 'conflict',
        status: 409,
        code: 'shift-already-open',
      });
      t.sync.set({ pending: 0, attention: 1 });
      await settle();

      expect(t.shifts.current()).toMatchObject({ status: 'open', opening: 'attention' });
    });

    it('reads the last shift closed, with what was counted and what is missing', async () => {
      const t = await createTestShifts();
      const shift = await seedOpen(t, {
        cashCount: 3,
        cashAmount: 120_000,
        otherCount: 0,
        otherAmount: 0,
      });
      await t.local.workspace.shifts().saveShift(
        {
          ...shift,
          closing: {
            operationId: shiftId(903),
            closedAt: '2026-10-19T23:15:00.000Z',
            countedAmount: 168_000,
          },
        },
        {
          operationId: shiftId(903),
          kind: 'shift-close',
          shiftId: shift.shiftId,
          body: { countedAmount: 168_000 },
          createdAt: new Date('2026-10-19T23:15:00.000Z'),
        },
      );

      await started(t);

      expect(t.shifts.current()).toMatchObject({
        status: 'closed',
        summary: { expectedAmount: 170_000, countedAmount: 168_000, difference: -2_000 },
        opening: 'waiting',
        closing: 'waiting',
      });
    });

    it('goes to the shift of the person who arrives, and forgets the one who left', async () => {
      const t = await createTestShifts();
      await seedOpen(t);
      await started(t);
      expect(t.shifts.current().status).toBe('open');

      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await settle();

      expect(t.shifts.current()).toEqual({ status: 'none' });
    });

    it('does not let a slow reading of the person who left land on the one who arrived', async () => {
      const gate = deferred<LocalShift | null>();
      const t = await createTestShifts({
        wrap: hookingShifts((storage, call) =>
          call === 1 ? over(storage, { readCurrentShift: () => gate.promise }) : storage,
        ),
      });
      const shift = await seedOpen(t);
      t.shifts.start();
      await settle();

      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await settle();
      gate.resolve(shift);
      await settle();

      expect(t.shifts.current()).toEqual({ status: 'none' });
    });

    it('says it could not read what is saved, and does not take that for no shift', async () => {
      let fail = true;
      const t = await createTestShifts({
        wrap: hookingShifts((storage) =>
          over(storage, {
            readCurrentShift: () =>
              fail ? Promise.reject(new Error('boom')) : storage.readCurrentShift(),
          }),
        ),
      });

      await started(t);
      expect(t.shifts.current()).toEqual({ status: 'failed' });

      fail = false;
      await t.shifts.refresh();
      expect(t.shifts.current()).toEqual({ status: 'none' });
    });

    it('reads again when asked, for example after a sale', async () => {
      const t = await started(await createTestShifts());
      await seedOpen(t, { cashCount: 1, cashAmount: 3_200, otherCount: 0, otherAmount: 0 });

      await t.shifts.refresh();

      expect(t.shifts.current()).toMatchObject({
        status: 'open',
        summary: { expectedAmount: 53_200 },
      });
    });

    it('tells those who listen only when something changed', async () => {
      const t = await started(await createTestShifts());
      const listener = vi.fn();
      t.shifts.subscribe(listener);

      await t.shifts.refresh();
      expect(listener).not.toHaveBeenCalled();

      await seedOpen(t);
      await t.shifts.refresh();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not let a slow reading that ends late overwrite what a newer one already said', async () => {
      const gate = deferred<LocalShift | null>();
      const t = await createTestShifts({
        wrap: hookingShifts((storage, call) =>
          call === 1 ? over(storage, { readCurrentShift: () => gate.promise }) : storage,
        ),
      });
      t.shifts.start();
      await settle();
      await t.shifts.open(50_000);
      expect(t.shifts.current().status).toBe('open');

      gate.resolve(null);
      await settle();

      expect(t.shifts.current().status).toBe('open');
    });

    it('does not let a slow reading that fails late overwrite what a newer one already said', async () => {
      const gate = deferred<LocalShift | null>();
      const t = await createTestShifts({
        wrap: hookingShifts((storage, call) =>
          call === 1 ? over(storage, { readCurrentShift: () => gate.promise }) : storage,
        ),
      });
      t.shifts.start();
      await settle();
      await t.shifts.open(50_000);

      gate.reject(new Error('boom'));
      await settle();

      expect(t.shifts.current().status).toBe('open');
    });

    it('compares with the last time it looked: what does not move the queue is not news, also after what did', async () => {
      const t = await createTestShifts();
      await seedOpen(t);
      await started(t);
      t.sync.set({ pending: 1 });
      await settle();
      const read = vi.spyOn(t.local.workspace, 'shifts');

      t.sync.set({ phase: 'sending' });
      await settle();

      expect(read).not.toHaveBeenCalled();
    });

    it('ignores what the sending does that does not move the queue', async () => {
      const t = await createTestShifts();
      await seedOpen(t);
      await started(t);
      const read = vi.spyOn(t.local.workspace, 'shifts');

      t.sync.set({ phase: 'sending' });
      await settle();

      expect(read).not.toHaveBeenCalled();
    });

    it('listens once, however many times it is started, and no more after it stops', async () => {
      const t = await createTestShifts();

      t.shifts.start();
      t.shifts.start();
      expect(t.sync.subscribers).toBe(1);

      t.shifts.stop();
      expect(t.sync.subscribers).toBe(0);
    });
  });

  describe('opening', () => {
    it('keeps the shift and its operation with exactly what the server takes, and sends them', async () => {
      const t = await started(await createTestShifts());
      t.sync.offset = 1_500;
      const deviceId = t.local.workspace.current()?.deviceId;

      await t.shifts.open(50_000);

      const operation = t.local.stores.dataOf(ANA).queue[0];
      expect(operation).toEqual({
        operationId: shiftId(2),
        kind: 'shift-open',
        shiftId: null,
        body: {
          operationId: shiftId(2),
          shiftId: shiftId(1),
          deviceId,
          openingAmount: 50_000,
          deviceTime: OPENED_AT,
          clockOffsetMs: 1_500,
        },
        createdAt: OPENED_AT,
        state: 'pending',
        attempts: 0,
        attention: null,
      });
      expect(t.local.stores.dataOf(ANA).shift).toEqual({
        shiftId: shiftId(1),
        deviceId,
        openOperationId: shiftId(2),
        openedAt: OPENED_AT,
        openingAmount: 50_000,
        sales: NO_SALES,
        closing: null,
      });
      expect(t.sync.queuedCalls).toBe(1);
    });

    it('says what the shift is right after: open, with the cash it was opened with', async () => {
      const t = await started(await createTestShifts());

      await t.shifts.open(50_000);

      expect(t.shifts.current()).toMatchObject({
        status: 'open',
        summary: { openingAmount: 50_000, expectedAmount: 50_000 },
        opening: 'waiting',
      });
    });

    it('opens with an empty drawer', async () => {
      const t = await started(await createTestShifts());

      await t.shifts.open(0);

      expect(t.shifts.current()).toMatchObject({ status: 'open', summary: { openingAmount: 0 } });
    });

    it('does not open a second one while one is open: nothing is saved', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);
      t.sync.queuedCalls = 0;

      await expect(t.shifts.open(10_000)).rejects.toBeInstanceOf(ShiftAlreadyOpenError);

      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
      expect(t.local.stores.dataOf(ANA).shift?.openingAmount).toBe(50_000);
      expect(t.sync.queuedCalls).toBe(0);
    });

    it('opens only one when it is asked twice at once: the second tap finds the first one saved', async () => {
      const t = await started(await createTestShifts());

      const results = await Promise.allSettled([t.shifts.open(50_000), t.shifts.open(50_000)]);

      expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
    });

    it('opens another once the last one is closed, and the closing waits for its turn to be sent', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);
      await t.shifts.close(50_000);

      await t.shifts.open(20_000);

      expect(t.local.stores.dataOf(ANA).queue.map((operation) => operation.kind)).toEqual([
        'shift-open',
        'shift-close',
        'shift-open',
      ]);
      expect(t.local.stores.dataOf(ANA).shift).toMatchObject({
        shiftId: shiftId(4),
        openingAmount: 20_000,
        closing: null,
      });
      expect(t.shifts.current()).toMatchObject({ status: 'open' });
    });

    it('does not open when the server does not know this device yet: it would be sent for nothing', async () => {
      const t = await started(await createTestShifts({ registered: false }));

      await expect(t.shifts.open(50_000)).rejects.toBeInstanceOf(DeviceNotRegisteredError);

      expect(t.local.stores.dataOf(ANA).queue).toEqual([]);
      expect(t.local.stores.dataOf(ANA).shift).toBeNull();
    });

    it('needs someone working', async () => {
      const t = await started(await createTestShifts({ working: false }));

      await expect(t.shifts.open(50_000)).rejects.toBeInstanceOf(NoWorkspaceError);
    });

    it.each([-1, 1.5, Number.NaN, MAX_PESOS + 1])(
      'does not take %s as the cash of the drawer',
      async (amount) => {
        const t = await started(await createTestShifts());

        await expect(t.shifts.open(amount)).rejects.toBeInstanceOf(RangeError);

        expect(t.local.stores.dataOf(ANA).queue).toEqual([]);
      },
    );

    it('lets the failure of what is saved go up, and leaves nothing half done', async () => {
      const t = await started(await createTestShifts());
      t.local.stores.failShift = new Error('disco lleno');

      await expect(t.shifts.open(50_000)).rejects.toThrow('disco lleno');

      expect(t.local.stores.dataOf(ANA).shift).toBeNull();
      expect(t.local.stores.dataOf(ANA).queue).toEqual([]);
      expect(t.sync.queuedCalls).toBe(0);
      expect(t.shifts.current()).toEqual({ status: 'none' });
    });

    it('is opened even when the sending could not be told: it goes out the next time', async () => {
      const t = await started(await createTestShifts());
      t.sync.queued = () => Promise.reject(new Error('el motor se cayo'));

      await expect(t.shifts.open(50_000)).resolves.toBeUndefined();

      expect(t.shifts.current()).toMatchObject({ status: 'open' });
    });

    it('does not touch the shift of whoever arrives while it was saving', async () => {
      const hold = deferred<void>();
      const t = await started(await createTestShifts());
      t.local.stores.holdShift = hold.promise;

      const opening = t.shifts.open(50_000);
      await settle();
      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      hold.resolve();

      // La base de Ana ya se solto: lo que se guardo fue en la suya, y a Luis no le llega nada.
      await opening.catch(() => undefined);
      await settle();
      expect(t.local.stores.dataOf('luis').shift).toBeNull();
      expect(t.shifts.current()).toEqual({ status: 'none' });
    });
  });

  describe('closing', () => {
    it('keeps the closing and its operation with exactly what the server takes, the shift beside it', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);
      t.sync.offset = -800;
      t.clock.set(new Date('2026-10-19T23:15:00.000Z'));
      t.sync.queuedCalls = 0;

      await t.shifts.close(48_000);

      expect(t.local.stores.dataOf(ANA).queue[1]).toEqual({
        operationId: shiftId(3),
        kind: 'shift-close',
        shiftId: shiftId(1),
        body: {
          operationId: shiftId(3),
          countedAmount: 48_000,
          deviceTime: '2026-10-19T23:15:00.000Z',
          clockOffsetMs: -800,
        },
        createdAt: '2026-10-19T23:15:00.000Z',
        state: 'pending',
        attempts: 0,
        attention: null,
      });
      expect(t.local.stores.dataOf(ANA).shift?.closing).toEqual({
        operationId: shiftId(3),
        closedAt: '2026-10-19T23:15:00.000Z',
        countedAmount: 48_000,
      });
      expect(t.sync.queuedCalls).toBe(1);
    });

    it('says what the shift is right after: closed, with the difference of the drawer', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);

      await t.shifts.close(48_000);

      expect(t.shifts.current()).toMatchObject({
        status: 'closed',
        summary: { expectedAmount: 50_000, countedAmount: 48_000, difference: -2_000 },
        closing: 'waiting',
      });
    });

    it('keeps what was sold in the shift when it closes it', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);
      const sold = { cashCount: 2, cashAmount: 7_000, otherCount: 1, otherAmount: 3_000 };
      const shift = t.local.stores.dataOf(ANA).shift!;
      t.local.stores.dataOf(ANA).shift = { ...shift, sales: sold };
      await t.shifts.refresh();

      await t.shifts.close(57_000);

      expect(t.shifts.current()).toMatchObject({
        status: 'closed',
        shift: { sales: sold },
        summary: { expectedAmount: 57_000, difference: 0 },
      });
    });

    it('does not close what is not open: nothing was ever opened', async () => {
      const t = await started(await createTestShifts());

      await expect(t.shifts.close(0)).rejects.toBeInstanceOf(NoOpenShiftError);

      expect(t.local.stores.dataOf(ANA).queue).toEqual([]);
    });

    it('does not close twice: the second time there is no open shift', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);
      await t.shifts.close(50_000);

      await expect(t.shifts.close(50_000)).rejects.toBeInstanceOf(NoOpenShiftError);

      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(2);
    });

    it('closes only once when it is asked twice at once', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);

      const results = await Promise.allSettled([t.shifts.close(50_000), t.shifts.close(50_000)]);

      expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(2);
    });

    it('needs someone working', async () => {
      const t = await started(await createTestShifts({ working: false }));

      await expect(t.shifts.close(0)).rejects.toBeInstanceOf(NoWorkspaceError);
    });

    it.each([-1, 1.5, Number.NaN, MAX_PESOS + 1])(
      'does not take %s as the cash that was counted',
      async (amount) => {
        const t = await started(await createTestShifts());
        await t.shifts.open(50_000);

        await expect(t.shifts.close(amount)).rejects.toBeInstanceOf(RangeError);

        expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
        expect(t.shifts.current().status).toBe('open');
      },
    );

    it('leaves the shift open when the closing can not be saved', async () => {
      const t = await started(await createTestShifts());
      await t.shifts.open(50_000);
      t.local.stores.failShift = new Error('disco lleno');

      await expect(t.shifts.close(50_000)).rejects.toThrow('disco lleno');

      expect(t.local.stores.dataOf(ANA).shift?.closing).toBeNull();
      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
      expect(t.shifts.current().status).toBe('open');
    });
  });
});
