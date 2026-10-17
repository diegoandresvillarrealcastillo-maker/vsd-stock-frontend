import { describe, expect, it } from 'vitest';
import { createFakeApi, reply } from '../../../test/support/fake-api';
import { ApiError } from '../../domain/model/api-error';
import { InventoryUseCase } from './inventory.usecase';

const wireStock = (productId: string, overrides: Record<string, unknown> = {}) => ({
  productId,
  name: `Producto ${productId}`,
  sku: `SKU-${productId}`,
  unit: 'unit',
  active: true,
  quantityMilli: 6000,
  minStockMilli: null,
  belowMinimum: false,
  ...overrides,
});

const wireProduct = (id: string, sku = `SKU-${id}`) => ({
  id,
  name: `Producto ${id}`,
  sku,
  barcode: null,
  unit: 'unit',
  unitPrice: 3200,
  taxRateBp: 0,
  active: true,
  categoryId: null,
  minStockMilli: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  updatedAt: '2026-10-17T12:00:00.000Z',
});

const wireMovement = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  operationId: `op-${id}`,
  productId: 'p1',
  kind: 'adjustment',
  deltaMilli: -2000,
  reason: 'Se cayeron dos paquetes',
  createdAt: '2026-10-17T20:12:00.000Z',
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
  return { sent, useCase: new InventoryUseCase(api) };
}

describe('InventoryUseCase', () => {
  describe('listing the stock', () => {
    it('asks for the first page, 50 at a time, with no filter', async () => {
      const { sent, useCase } = setup(page([wireStock('a')]));

      const result = await useCase.listStock({});

      expect(sent).toEqual([{ method: 'GET', path: '/v1/stock', query: { limit: 50 } }]);
      expect(result.items.map((item) => item.productId)).toEqual(['a']);
    });

    it('passes the search, the state and the minimum filter', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.listStock({ search: '  arroz ', active: true, belowMinimum: true });

      expect(sent[0]?.query).toEqual({
        limit: 50,
        search: 'arroz',
        active: true,
        belowMinimum: true,
      });
    });

    it('does not send a search that is only spaces, nor a filter that is off', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.listStock({ search: '  ', belowMinimum: false });

      expect(sent[0]?.query).toEqual({ limit: 50, belowMinimum: false });
    });

    it('asks for the next page with the cursor as it came', async () => {
      const { sent, useCase } = setup(page([wireStock('a')], 'c1'), page([]));

      const first = await useCase.listStock({});
      await useCase.listStock({}, first.nextCursor ?? undefined);

      expect(sent[1]?.query).toEqual({ limit: 50, cursor: 'c1' });
    });

    it('does not believe a page that is not what the contract says', async () => {
      const { useCase } = setup({ items: [{ productId: 3 }], nextCursor: null });

      const error = await failedWith(useCase.listStock({}));

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('finding the stock of one product', () => {
    it('asks for the product to learn its SKU and then looks for it in the stock', async () => {
      const { sent, useCase } = setup(
        wireProduct('p1', 'ARR-500'),
        page([wireStock('otro', { sku: 'ARR-500-X' }), wireStock('p1', { sku: 'ARR-500' })]),
      );

      const found = await useCase.findStock('p1');

      expect(found?.productId).toBe('p1');
      expect(sent).toEqual([
        { method: 'GET', path: '/v1/products/p1' },
        { method: 'GET', path: '/v1/stock', query: { limit: 200, search: 'ARR-500' } },
      ]);
    });

    it('encodes the id of the product in the path', async () => {
      const { sent, useCase } = setup(wireProduct('a/b'), page([]));

      await useCase.findStock('a/b');

      expect(sent[0]?.path).toBe('/v1/products/a%2Fb');
    });

    it('says nothing is known when the stock does not list that product', async () => {
      const { useCase } = setup(wireProduct('p1'), page([wireStock('otro')]));

      expect(await useCase.findStock('p1')).toBeNull();
    });

    it('does not believe an answer that is not a product', async () => {
      const { useCase } = setup({ id: 'p1' });

      expect(await failedWith(useCase.findStock('p1'))).toBeInstanceOf(ApiError);
    });
  });

  describe('the history of a product', () => {
    it('asks for the movements of that product, 50 at a time', async () => {
      const { sent, useCase } = setup(page([wireMovement('m1')], 'c1'));

      const result = await useCase.listMovements('p1');

      expect(sent).toEqual([
        { method: 'GET', path: '/v1/stock-movements', query: { productId: 'p1', limit: 50 } },
      ]);
      expect(result.items.map((movement) => movement.id)).toEqual(['m1']);
      expect(result.nextCursor).toBe('c1');
    });

    it('asks for the next page with its cursor', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.listMovements('p1', 'c1');

      expect(sent[0]?.query).toEqual({ productId: 'p1', limit: 50, cursor: 'c1' });
    });

    it('does not believe a page that is not what the contract says', async () => {
      const { useCase } = setup({ items: 'x', nextCursor: null });

      expect(await failedWith(useCase.listMovements('p1'))).toBeInstanceOf(ApiError);
    });
  });

  describe('adjusting the stock', () => {
    const input = {
      operationId: '11111111-1111-4111-8111-111111111111',
      productId: 'p1',
      deltaMilli: -2000,
      reason: '  Se cayeron dos paquetes ',
    };

    it('sends the adjustment with its operation id and the reason trimmed', async () => {
      const { sent, useCase } = setup(reply(wireMovement('m1'), 201));

      const result = await useCase.adjust(input);

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/stock-adjustments',
          body: {
            operationId: '11111111-1111-4111-8111-111111111111',
            productId: 'p1',
            deltaMilli: -2000,
            reason: 'Se cayeron dos paquetes',
          },
        },
      ]);
      expect(result.movement.id).toBe('m1');
      expect(result.replayed).toBe(false);
    });

    it('says the server had already applied it when it answers it repeated', async () => {
      const { useCase } = setup(reply(wireMovement('m1'), 200, true));

      const result = await useCase.adjust(input);

      expect(result.replayed).toBe(true);
    });

    it('does not believe an answer that is not a movement', async () => {
      const { useCase } = setup(reply({}, 201));

      expect(await failedWith(useCase.adjust(input))).toBeInstanceOf(ApiError);
    });
  });
});
