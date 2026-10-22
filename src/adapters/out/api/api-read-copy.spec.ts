import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../domain/model/api-error';
import { createFakeApi, reply } from '../../../../test/support/fake-api';
import { ApiReadCopy } from './api-read-copy';

const PRODUCT = {
  id: 'f0000000-0000-4000-8000-000000000001',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  barcode: null,
  unit: 'unit',
  unitPrice: 3200,
  taxRateBp: 0,
  active: true,
  categoryId: null,
  minStockMilli: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-18T10:00:00.000Z',
};
const AS_OF = '2026-10-19T15:00:00.123Z';
const SINCE = new Date('2026-10-19T14:59:00.123Z');

describe('ApiReadCopy', () => {
  describe('what it asks for', () => {
    it('asks for the products of the sync route with the instant, the cursor and the size of the page', async () => {
      const { api, sent } = createFakeApi({ asOf: AS_OF, items: [], nextCursor: null });

      await new ApiReadCopy(api).products({ since: SINCE, cursor: 'siguiente', limit: 200 });

      expect(sent).toEqual([
        {
          method: 'GET',
          path: '/v1/sync/products',
          query: { since: '2026-10-19T14:59:00.123Z', cursor: 'siguiente', limit: 200 },
        },
      ]);
    });

    it('asks for the stock of its own route, in the same way', async () => {
      const { api, sent } = createFakeApi({ asOf: AS_OF, items: [], nextCursor: null });

      await new ApiReadCopy(api).stock({ since: SINCE, cursor: 'siguiente', limit: 100 });

      expect(sent).toEqual([
        {
          method: 'GET',
          path: '/v1/sync/stock',
          query: { since: '2026-10-19T14:59:00.123Z', cursor: 'siguiente', limit: 100 },
        },
      ]);
    });

    it('leaves out what it has not got: no instant means everything, no cursor means the first page', async () => {
      const { api, sent } = createFakeApi({ asOf: AS_OF, items: [], nextCursor: null });

      await new ApiReadCopy(api).products({ since: null, cursor: null, limit: 200 });

      expect(sent[0]?.query).toEqual({ limit: 200 });
      expect(Object.keys(sent[0]?.query ?? {})).toEqual(['limit']);
    });
  });

  describe('what it reads', () => {
    it('gives the products of the page and its hour, and where the next one starts', async () => {
      const { api } = createFakeApi({ asOf: AS_OF, items: [PRODUCT], nextCursor: 'mas' });

      const page = await new ApiReadCopy(api).products({ since: null, cursor: null, limit: 200 });

      expect(page.asOf).toEqual(new Date(AS_OF));
      expect(page.items.map((product) => product.name)).toEqual(['Arroz 500 g']);
      expect(page.nextCursor).toBe('mas');
    });

    it('gives the stock levels of the page and its hour', async () => {
      const { api } = createFakeApi({
        asOf: AS_OF,
        items: [{ productId: PRODUCT.id, quantityMilli: -1_500 }],
        nextCursor: null,
      });

      const page = await new ApiReadCopy(api).stock({ since: null, cursor: null, limit: 200 });

      expect(page.items).toEqual([{ productId: PRODUCT.id, quantityMilli: -1_500 }]);
      expect(page.asOf).toEqual(new Date(AS_OF));
    });
  });

  describe('an answer that is not the contract is a failure that may pass', () => {
    const transient = async (body: unknown, ask: 'products' | 'stock') => {
      const { api } = createFakeApi(body);
      const failure = await new ApiReadCopy(api)
        [ask]({ since: null, cursor: null, limit: 200 })
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ApiError);
      expect((failure as ApiError).failure).toEqual({
        class: 'transient',
        status: 200,
        problem: null,
        retryAfterMs: null,
      });
    };

    it.each([
      ['nothing', undefined],
      ['text', 'hola'],
      ['no hour', { items: [], nextCursor: null }],
      ['a product that is not right', { asOf: AS_OF, items: [{ id: 5 }], nextCursor: null }],
    ])('when the products come with %s', async (_name, body) => {
      await transient(body, 'products');
    });

    it.each([
      ['nothing', undefined],
      ['no hour', { items: [], nextCursor: null }],
      ['a level that is not right', { asOf: AS_OF, items: [{ productId: 5 }], nextCursor: null }],
    ])('when the stock comes with %s', async (_name, body) => {
      await transient(body, 'stock');
    });

    it('also when the server answers with a status that is not a 200', async () => {
      const { api } = createFakeApi(reply({ asOf: AS_OF, items: [], nextCursor: null }, 204));

      await expect(
        new ApiReadCopy(api).products({ since: null, cursor: null, limit: 200 }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  it('lets the failure of the API go up as it came', async () => {
    const failure = new ApiError({
      class: 'session',
      status: 401,
      problem: null,
      retryAfterMs: null,
    });
    const { api } = createFakeApi(failure);

    await expect(
      new ApiReadCopy(api).stock({ since: null, cursor: null, limit: 200 }),
    ).rejects.toBe(failure);
  });
});
