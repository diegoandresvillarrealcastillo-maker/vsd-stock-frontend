import { describe, expect, it, vi } from 'vitest';
import {
  DeviceNotRegisteredError,
  EmptySaleError,
  NoWorkspaceError,
  ShiftRequiredError,
} from '../../domain/model/local-errors';
import { NO_SALES } from '../../domain/model/shift';
import { testMe } from '../../../test/support/auth';
import { settle } from '../../../test/support/connection';
import {
  createTestSelling,
  item,
  saleId,
  type TestSelling,
} from '../../../test/support/fake-selling';
import { shiftId } from '../../../test/support/fake-shifts';

const arroz = item(1, {
  name: 'Arroz 500 g',
  unitPrice: 3_200,
  taxRateBp: 1_900,
  taxKind: 'taxed',
});
const aceite = item(2, {
  name: 'Aceite 1 L',
  unitPrice: 12_500,
  taxRateBp: 1_900,
  taxKind: 'taxed',
});

/** La venta de siempre: 2 arroz y 1 aceite con $ 500 de descuento = $ 18.400. */
function fill(t: TestSelling) {
  t.selling.add(arroz);
  t.selling.add(arroz);
  t.selling.add(aceite);
  t.selling.setDiscount(aceite.id, 500);
}

const ANA = 'ana';

describe('SellingUseCase', () => {
  describe('the cart', () => {
    it('starts empty, with a total of zero and no receipt', async () => {
      const t = await createTestSelling();

      expect(t.selling.current()).toMatchObject({ cart: { lines: [] }, receipt: null });
      expect(t.selling.current().summary.total.amount).toBe(0);
    });

    it('adds products, changes their quantity and discount, and says the total with the tax split', async () => {
      const t = await createTestSelling();

      fill(t);

      const { cart, summary } = t.selling.current();
      expect(cart.lines.map((line) => [line.name, line.quantityMilli, line.discount])).toEqual([
        ['Arroz 500 g', 2_000, 0],
        ['Aceite 1 L', 1_000, 500],
      ]);
      expect(summary.total.amount).toBe(18_400);
      expect(summary.base.amount + summary.tax.amount).toBe(18_400);
    });

    it('removes a line, and empties the cart', async () => {
      const t = await createTestSelling();
      fill(t);

      t.selling.remove(arroz.id);
      expect(t.selling.current().cart.lines).toHaveLength(1);

      t.selling.clear();
      expect(t.selling.current().cart.lines).toEqual([]);
      expect(t.selling.current().summary.total.amount).toBe(0);
    });

    it('tells those who listen of every change, and of nothing that did not change anything', async () => {
      const t = await createTestSelling();
      const listener = vi.fn();
      t.selling.subscribe(listener);

      t.selling.add(arroz);
      expect(listener).toHaveBeenCalledTimes(1);

      t.selling.add(item(9, { active: false }));
      t.selling.remove('no-esta');
      t.selling.clear();
      t.selling.clear();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('lets the failure of a quantity that is not one go up, and leaves the cart as it was', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      const before = t.selling.current();

      expect(() => {
        t.selling.setQuantity(arroz.id, 1_500);
      }).toThrow(RangeError);
      expect(() => {
        t.selling.setDiscount(arroz.id, 99_999);
      }).toThrow(RangeError);

      expect(t.selling.current()).toBe(before);
    });
  });

  describe('charging in cash', () => {
    it('saves the sale in the queue with exactly what the server takes, under the next folio', async () => {
      const t = await createTestSelling();
      t.sync.offset = 1_200;
      fill(t);
      t.clock.set(new Date('2026-10-19T20:42:00.000Z'));
      const deviceId = t.local.workspace.current()?.deviceId;

      await t.selling.confirm({ method: 'cash', received: 20_000 });

      const queue = t.local.stores.dataOf(ANA).queue;
      expect(queue.map((operation) => operation.kind)).toEqual(['shift-open', 'sale']);
      expect(queue[1]).toMatchObject({
        operationId: saleId(1),
        kind: 'sale',
        shiftId: null,
        createdAt: '2026-10-19T20:42:00.000Z',
        body: {
          operationId: saleId(1),
          shiftId: shiftId(1),
          folio: 'AA-000001',
          total: 18_400,
          lines: [
            {
              productId: arroz.id,
              quantityMilli: 2_000,
              unitPrice: 3_200,
              discount: 0,
              taxRateBp: 1_900,
              taxKind: 'taxed',
            },
            {
              productId: aceite.id,
              quantityMilli: 1_000,
              unitPrice: 12_500,
              discount: 500,
              taxRateBp: 1_900,
              taxKind: 'taxed',
            },
          ],
          payments: [{ method: 'cash', amount: 18_400, reference: null }],
          deviceTime: '2026-10-19T20:42:00.000Z',
          clockOffsetMs: 1_200,
        },
      });
      expect(deviceId).toBeDefined();
    });

    it('adds the sale to the shift in the same save: the cash goes into what the drawer is expected to hold', async () => {
      const t = await createTestSelling();
      fill(t);

      await t.selling.confirm({ method: 'cash', received: 20_000 });

      expect(t.local.stores.dataOf(ANA).shift?.sales).toEqual({
        cashCount: 1,
        cashAmount: 18_400,
        otherCount: 0,
        otherAmount: 0,
      });
      expect(t.shifts.current()).toMatchObject({
        status: 'open',
        summary: { cashCount: 1, cashAmount: 18_400, expectedAmount: 68_400 },
      });
    });

    it('gives back the receipt, with the change, and keeps it until another sale starts', async () => {
      const t = await createTestSelling();
      fill(t);
      t.clock.set(new Date('2026-10-19T15:30:00.000Z'));

      const receipt = await t.selling.confirm({ method: 'cash', received: 20_000 });

      expect(receipt).toMatchObject({
        folio: 'AA-000001',
        operationId: saleId(1),
        cashier: 'Ana Gómez',
        occurredAt: '2026-10-19T15:30:00.000Z',
        shiftOpenedAt: '2026-10-19T13:02:00.000Z',
        summary: { total: 18_400 },
        payment: { method: 'cash', received: 20_000, change: 1_600 },
      });
      expect(t.selling.current().receipt).toEqual(receipt);
    });

    it('empties the cart once the sale is saved', async () => {
      const t = await createTestSelling();
      fill(t);

      await t.selling.confirm({ method: 'cash', received: 18_400 });

      expect(t.selling.current().cart.lines).toEqual([]);
    });

    it('tells the sending, so the sale goes out as soon as it can', async () => {
      const t = await createTestSelling();
      t.sync.queuedCalls = 0;
      fill(t);

      await t.selling.confirm({ method: 'cash', received: 18_400 });

      expect(t.sync.queuedCalls).toBe(1);
    });

    it('takes what was sold out of the stock the screen shows', async () => {
      const t = await createTestSelling();
      fill(t);

      await t.selling.confirm({ method: 'cash', received: 18_400 });

      expect(t.copy.soldItems).toEqual([
        [
          { productId: arroz.id, quantityMilli: 2_000 },
          { productId: aceite.id, quantityMilli: 1_000 },
        ],
      ]);
    });

    it('gives each sale its own folio, in order', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      await t.selling.confirm({ method: 'cash', received: 3_200 });
      t.selling.newSale();
      t.selling.add(aceite);

      const second = await t.selling.confirm({ method: 'cash', received: 12_500 });

      expect(second.folio).toBe('AA-000002');
      expect(t.local.stores.dataOf(ANA).shift?.sales).toMatchObject({
        cashCount: 2,
        cashAmount: 15_700,
      });
    });

    it('is sent even when the sending could not be told: it goes out the next time', async () => {
      const t = await createTestSelling();
      t.sync.queued = () => Promise.reject(new Error('el motor se cayo'));
      t.selling.add(arroz);

      await expect(t.selling.confirm({ method: 'cash', received: 3_200 })).resolves.toMatchObject({
        folio: 'AA-000001',
      });
    });
  });

  describe('charging with a card or a transfer', () => {
    it('counts it apart from the cash, with its reference, and no change', async () => {
      const t = await createTestSelling();
      fill(t);

      const receipt = await t.selling.confirm({ method: 'card', reference: 'Visa 4455' });

      expect(receipt.payment).toEqual({
        method: 'card',
        received: null,
        change: 0,
        reference: 'Visa 4455',
      });
      expect(t.local.stores.dataOf(ANA).queue[1]?.body['payments']).toEqual([
        { method: 'card', amount: 18_400, reference: 'Visa 4455' },
      ]);
      expect(t.local.stores.dataOf(ANA).shift?.sales).toEqual({
        ...NO_SALES,
        otherCount: 1,
        otherAmount: 18_400,
      });
      expect(t.shifts.current()).toMatchObject({ summary: { expectedAmount: 50_000 } });
    });
  });

  describe('what does not let a sale be charged', () => {
    it('is an empty cart: there is nothing to charge', async () => {
      const t = await createTestSelling();

      await expect(t.selling.confirm({ method: 'cash', received: 0 })).rejects.toBeInstanceOf(
        EmptySaleError,
      );

      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
    });

    it('is the lack of an open shift: nothing is saved, no folio is used and the cart stays', async () => {
      const t = await createTestSelling({ shift: 'none' });
      t.selling.add(arroz);

      await expect(t.selling.confirm({ method: 'cash', received: 3_200 })).rejects.toBeInstanceOf(
        ShiftRequiredError,
      );

      expect(t.local.stores.dataOf(ANA).queue).toEqual([]);
      expect(t.local.stores.dataOf(ANA).serial).toBe(0);
      expect(t.selling.current().cart.lines).toHaveLength(1);
    });

    it('is a shift that was closed', async () => {
      const t = await createTestSelling();
      await t.shifts.close(50_000);
      t.selling.add(arroz);

      await expect(t.selling.confirm({ method: 'cash', received: 3_200 })).rejects.toBeInstanceOf(
        ShiftRequiredError,
      );
    });

    it('is a device the server does not know: there is no folio', async () => {
      const t = await createTestSelling({ registered: false });
      await t.local.stores.lastStore.saveShift(
        {
          shiftId: shiftId(901),
          deviceId: 'dev-sin-registrar',
          openOperationId: shiftId(902),
          openedAt: '2026-10-19T13:02:00.000Z',
          openingAmount: 0,
          sales: NO_SALES,
          closing: null,
        },
        {
          operationId: shiftId(902),
          kind: 'shift-open',
          body: {},
          createdAt: new Date('2026-10-19T13:02:00.000Z'),
        },
      );
      t.selling.add(arroz);

      await expect(t.selling.confirm({ method: 'cash', received: 3_200 })).rejects.toBeInstanceOf(
        DeviceNotRegisteredError,
      );

      expect(t.selling.current().cart.lines).toHaveLength(1);
    });

    it('is cash that does not cover the total', async () => {
      const t = await createTestSelling();
      fill(t);

      await expect(t.selling.confirm({ method: 'cash', received: 18_399 })).rejects.toBeInstanceOf(
        RangeError,
      );

      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
      expect(t.selling.current().cart.lines).toHaveLength(2);
    });

    it('is nobody working', async () => {
      const t = await createTestSelling({ working: false });
      t.selling.add(arroz);

      await expect(t.selling.confirm({ method: 'cash', received: 3_200 })).rejects.toBeInstanceOf(
        NoWorkspaceError,
      );
    });

    it('is a failure of what is saved: nothing is left half done, the cart stays and no receipt is given', async () => {
      const t = await createTestSelling();
      fill(t);
      t.local.stores.failShift = new Error('disco lleno');

      await expect(t.selling.confirm({ method: 'cash', received: 18_400 })).rejects.toThrow(
        'disco lleno',
      );

      expect(t.local.stores.dataOf(ANA).queue).toHaveLength(1);
      expect(t.local.stores.dataOf(ANA).shift?.sales).toEqual(NO_SALES);
      expect(t.selling.current().cart.lines).toHaveLength(2);
      expect(t.selling.current().receipt).toBeNull();
      expect(t.copy.soldItems).toEqual([]);
    });

    it('charges the next one after a charge that failed: one failure does not stop the sales that come after', async () => {
      const t = await createTestSelling();
      fill(t);
      t.local.stores.failShift = new Error('disco lleno');
      await expect(t.selling.confirm({ method: 'cash', received: 18_400 })).rejects.toThrow(
        'disco lleno',
      );

      t.local.stores.failShift = null;
      const receipt = await t.selling.confirm({ method: 'cash', received: 18_400 });

      expect(receipt.folio).toMatch(/^AA-/);
      expect(t.local.stores.dataOf(ANA).queue.map((operation) => operation.kind)).toEqual([
        'shift-open',
        'sale',
      ]);
    });

    it('charges only once when it is asked twice at once: the second tap finds the cart empty', async () => {
      const t = await createTestSelling();
      fill(t);

      const results = await Promise.allSettled([
        t.selling.confirm({ method: 'cash', received: 18_400 }),
        t.selling.confirm({ method: 'cash', received: 18_400 }),
      ]);

      expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
      expect(t.local.stores.dataOf(ANA).queue.map((operation) => operation.kind)).toEqual([
        'shift-open',
        'sale',
      ]);
    });
  });

  describe('after the sale', () => {
    it('closes the receipt as soon as a product is added: another sale has started', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      await t.selling.confirm({ method: 'cash', received: 3_200 });

      t.selling.add(aceite);

      expect(t.selling.current().receipt).toBeNull();
    });

    it('keeps the receipt through what changes nothing, and does not tell anyone about it', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      const receipt = await t.selling.confirm({ method: 'cash', received: 3_200 });
      const listener = vi.fn();
      t.selling.subscribe(listener);

      t.selling.add(item(9, { active: false }));
      t.selling.remove('no-esta');
      t.selling.clear();

      expect(t.selling.current().receipt).toEqual(receipt);
      expect(listener).not.toHaveBeenCalled();
    });

    it('does not tell anyone that a new sale started when the sale was already new', async () => {
      const t = await createTestSelling();
      const listener = vi.fn();
      t.selling.subscribe(listener);

      t.selling.newSale();

      expect(listener).not.toHaveBeenCalled();
    });

    it('throws away what was being sold when a new sale is asked for', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);

      t.selling.newSale();

      expect(t.selling.current().cart.lines).toEqual([]);
    });

    it('closes the receipt when another sale starts', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      await t.selling.confirm({ method: 'cash', received: 3_200 });

      t.selling.newSale();

      expect(t.selling.current().receipt).toBeNull();
    });

    it('starts with an empty cart', async () => {
      const t = await createTestSelling();
      t.selling.add(arroz);
      await t.selling.confirm({ method: 'cash', received: 3_200 });

      t.selling.newSale();
      t.selling.add(aceite);

      expect(t.selling.current().cart.lines.map((line) => line.name)).toEqual(['Aceite 1 L']);
    });
  });

  describe('when the person changes', () => {
    it('drops the sale being made and the receipt: they are not for whoever arrives', async () => {
      const t = await createTestSelling();
      t.selling.start();
      t.selling.add(arroz);
      await t.local.workspace.leave();
      await t.local.workspace.begin(testMe('luis', 'cashier'));
      await settle();

      expect(t.selling.current().cart.lines).toEqual([]);
      expect(t.selling.current().receipt).toBeNull();
    });

    it('keeps the sale when what changes is not the person, only that the device learned its code', async () => {
      const t = await createTestSelling({ registered: false, shift: 'none' });
      t.selling.start();
      t.selling.add(arroz);

      await t.local.workspace.registerDevice();
      await settle();

      expect(t.selling.current().cart.lines).toHaveLength(1);
    });

    it('listens once, however many times it is started, and no more after it stops', async () => {
      const t = await createTestSelling();

      const watch = vi.spyOn(t.local.workspace, 'subscribe');

      t.selling.start();
      t.selling.start();
      expect(watch).toHaveBeenCalledTimes(1);
      t.selling.stop();
      t.selling.add(arroz);
      await t.local.workspace.leave();
      await settle();

      expect(t.selling.current().cart.lines).toHaveLength(1);
    });
  });
});
