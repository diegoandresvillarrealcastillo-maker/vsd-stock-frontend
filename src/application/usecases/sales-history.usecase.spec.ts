import { describe, expect, it } from 'vitest';
import { createFakeApi, reply } from '../../../test/support/fake-api';
import { ApiError } from '../../domain/model/api-error';
import { SalesHistoryUseCase } from './sales-history.usecase';

const wireSale = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  operationId: `op-${id}`,
  shiftId: 'shift-1',
  deviceId: null,
  userId: 'user-1',
  folio: `AA-${id}`,
  folioReported: `AA-${id}`,
  folioConflict: false,
  total: 14_800,
  needsAdjustment: false,
  flags: [],
  timeFlags: [],
  occurredAt: '2026-10-19T15:10:00.000Z',
  receivedAt: '2026-10-19T15:10:20.000Z',
  review: null,
  voided: null,
  attention: false,
  ...overrides,
});

const wireDetail = (id: string, overrides: Record<string, unknown> = {}) => ({
  ...wireSale(id),
  lines: [
    {
      productId: 'p-1',
      quantityMilli: 1_000,
      unitPrice: 14_800,
      discount: 0,
      taxRateBp: 0,
      taxKind: 'exempt',
    },
  ],
  payments: [{ method: 'cash', amount: 14_800, reference: null }],
  summary: { total: 14_800, base: 14_800, tax: 0, byRate: [] },
  ...overrides,
});

const page = (items: object[], nextCursor: string | null = null) => ({ items, nextCursor });

const failedWith = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

function setup(...answers: unknown[]) {
  const { api, sent } = createFakeApi(...answers);
  return { sent, useCase: new SalesHistoryUseCase(api) };
}

describe('SalesHistoryUseCase', () => {
  describe('the list', () => {
    it('asks for the sales of a shift, thirty at a time, and gives them as they come', async () => {
      const { sent, useCase } = setup(page([wireSale('1'), wireSale('2')], 'p2'));

      const result = await useCase.list({ view: 'shift', shiftId: 'shift-1' });

      expect(sent).toEqual([
        { method: 'GET', path: '/v1/sales', query: { limit: 30, shiftId: 'shift-1' } },
      ]);
      expect(result.items.map((sale) => sale.folio)).toEqual(['AA-1', 'AA-2']);
      expect(result.nextCursor).toBe('p2');
    });

    it('asks for all of them when it is the whole business, and for the next page with the cursor', async () => {
      const { sent, useCase } = setup(page([wireSale('3')]));

      await useCase.list({ view: 'all', cursor: 'p2' });

      expect(sent[0]).toEqual({
        method: 'GET',
        path: '/v1/sales',
        query: { limit: 30, cursor: 'p2' },
      });
    });

    it('asks for the tray when it is the ones that ask for attention', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.list({ view: 'attention' });

      expect(sent[0]).toEqual({
        method: 'GET',
        path: '/v1/sales',
        query: { limit: 30, attention: true },
      });
    });

    it('does not ask for the sales of a shift without saying which', async () => {
      const { sent, useCase } = setup();

      await expect(useCase.list({ view: 'shift' })).rejects.toBeInstanceOf(RangeError);

      expect(sent).toEqual([]);
    });

    it('does not believe an answer that is not the contract: it is a passing failure', async () => {
      const { useCase } = setup(page([{ ...wireSale('1'), total: 'x' }]));

      const error = await failedWith(useCase.list({ view: 'all' }));

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).failure.class).toBe('transient');
    });

    it('lets the failures of the API go up as they are', async () => {
      const failure = new ApiError({
        class: 'permanent',
        status: 403,
        problem: null,
        retryAfterMs: null,
      });
      const { useCase } = setup(failure);

      expect(await failedWith(useCase.list({ view: 'attention' }))).toBe(failure);
    });
  });

  describe('one sale', () => {
    it('reads it with its lines, its payments and its totals', async () => {
      const { sent, useCase } = setup(wireDetail('7'));

      const sale = await useCase.get('7');

      expect(sent[0]).toEqual({ method: 'GET', path: '/v1/sales/7' });
      expect(sale.lines).toHaveLength(1);
      expect(sale.payments[0]?.method).toBe('cash');
    });

    it('writes the id so that it can not change the route', async () => {
      const { sent, useCase } = setup(wireDetail('a/b'));

      await useCase.get('a/b?x');

      expect(sent[0]?.path).toBe('/v1/sales/a%2Fb%3Fx');
    });

    it('does not believe an answer that is not a sale', async () => {
      const { useCase } = setup({ id: '7' });

      const error = await failedWith(useCase.get('7'));

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('voiding', () => {
    it('sends the key, the reason and the shift the cash comes out of, and gives the sale as it stayed', async () => {
      const voided = {
        voidedAt: '2026-10-19T21:20:00.000Z',
        voidedByUserId: 'user-2',
        operationId: 'op-void',
        reason: 'El cliente se arrepintió',
      };
      const { sent, useCase } = setup(reply(wireDetail('7', { voided }), 201));

      const result = await useCase.voidSale('7', {
        operationId: 'op-void',
        reason: 'El cliente se arrepintió',
        shiftId: 'shift-9',
      });

      expect(sent[0]).toEqual({
        method: 'POST',
        path: '/v1/sales/7/void',
        body: { operationId: 'op-void', reason: 'El cliente se arrepintió', shiftId: 'shift-9' },
      });
      expect(result.sale.voided?.reason).toBe('El cliente se arrepintió');
      expect(result.replayed).toBe(false);
    });

    it('leaves the shift out when there is none: a sale without cash does not need it', async () => {
      const { sent, useCase } = setup(wireDetail('7'), wireDetail('7'));

      await useCase.voidSale('7', { operationId: 'op-void', reason: 'Error', shiftId: null });
      await useCase.voidSale('7', { operationId: 'op-void', reason: 'Error' });

      expect(sent[0]?.body).toEqual({ operationId: 'op-void', reason: 'Error' });
      expect(sent[1]?.body).toEqual({ operationId: 'op-void', reason: 'Error' });
    });

    it('says when the server had already voided it with that key: nothing came out of the cash twice', async () => {
      const { useCase } = setup(reply(wireDetail('7'), 200, true));

      const result = await useCase.voidSale('7', { operationId: 'op-void', reason: 'Error' });

      expect(result.replayed).toBe(true);
    });

    it('does not believe an answer that is not the sale', async () => {
      const { useCase } = setup({ id: '7' });

      const error = await failedWith(
        useCase.voidSale('7', { operationId: 'op-void', reason: 'Error' }),
      );

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('reviewing', () => {
    const wireReview = (note: string | null) => ({
      saleId: '7',
      reviewedAt: '2026-10-19T16:00:00.000Z',
      reviewedByUserId: 'user-2',
      note,
    });

    it('sends the note and gives back who reviewed it', async () => {
      const { sent, useCase } = setup(reply(wireReview('Ajustado'), 201));

      const review = await useCase.review('7', 'Ajustado');

      expect(sent[0]).toEqual({
        method: 'POST',
        path: '/v1/sales/7/review',
        body: { note: 'Ajustado' },
      });
      expect(review).toEqual({
        reviewedAt: new Date('2026-10-19T16:00:00.000Z'),
        reviewedByUserId: 'user-2',
        note: 'Ajustado',
      });
    });

    it('sends nothing for the note when there is none', async () => {
      const { sent, useCase } = setup(wireReview(null));

      await useCase.review('7', null);

      expect(sent[0]?.body).toEqual({});
    });

    it('does not believe an answer that is not a review', async () => {
      const { useCase } = setup({ saleId: '7' });

      const error = await failedWith(useCase.review('7', null));

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('how many ask for attention', () => {
    it('counts the ones in the tray, up to fifty', async () => {
      const { sent, useCase } = setup(page([wireSale('1'), wireSale('2'), wireSale('3')]));

      const result = await useCase.attentionCount();

      expect(sent[0]).toEqual({
        method: 'GET',
        path: '/v1/sales',
        query: { limit: 50, attention: true },
      });
      expect(result).toEqual({ count: 3, more: false });
    });

    it('says there are more than that when the tray goes on', async () => {
      const items = Array.from({ length: 50 }, (_, n) => wireSale(String(n)));
      const { useCase } = setup(page(items, 'next'));

      expect(await useCase.attentionCount()).toEqual({ count: 50, more: true });
    });

    it('does not believe an answer that is not a page of sales', async () => {
      const { useCase } = setup({ items: 'x' });

      const error = await failedWith(useCase.attentionCount());

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });
});
