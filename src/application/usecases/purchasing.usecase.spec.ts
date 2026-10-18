import { describe, expect, it } from 'vitest';
import { createFakeApi, reply } from '../../../test/support/fake-api';
import { ApiError } from '../../domain/model/api-error';
import { PurchasingUseCase } from './purchasing.usecase';

const wireSupplier = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Proveedor ${id}`,
  contact: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  ...overrides,
});

const wireSummary = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  operationId: `op-${id}`,
  warehouseId: 'w1',
  supplierId: null,
  note: null,
  createdAt: '2026-10-17T16:00:00.000Z',
  createdByUserId: 'u1',
  lineCount: 2,
  ...overrides,
});

const wirePurchase = (id: string) => ({
  id,
  operationId: `op-${id}`,
  warehouseId: 'w1',
  supplierId: 's1',
  note: null,
  createdAt: '2026-10-17T16:00:00.000Z',
  createdByUserId: 'u1',
  lines: [{ productId: 'p1', quantityMilli: 24_000, unitCost: 2500 }],
});

const page = (items: object[], nextCursor: string | null = null) => ({ items, nextCursor });

const failedWith = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

function setup(...answers: unknown[]) {
  const { api, sent } = createFakeApi(...answers);
  return { sent, useCase: new PurchasingUseCase(api) };
}

describe('PurchasingUseCase', () => {
  describe('suppliers', () => {
    it('reads every supplier, page after page, in the order they come', async () => {
      const { sent, useCase } = setup(
        page([wireSupplier('s1')], 'p2'),
        page([wireSupplier('s2')], 'p3'),
        page([wireSupplier('s3')]),
      );

      const all = await useCase.listAllSuppliers();

      expect(all.map((supplier) => supplier.id)).toEqual(['s1', 's2', 's3']);
      expect(sent.map((request) => request.query)).toEqual([
        { limit: 200 },
        { limit: 200, cursor: 'p2' },
        { limit: 200, cursor: 'p3' },
      ]);
      expect(sent[0]).toMatchObject({ method: 'GET', path: '/v1/suppliers' });
    });

    it('stops after ten pages, so a server that never ends does not hang the screen', async () => {
      const { sent, useCase } = setup(
        ...Array.from({ length: 12 }, (_, index) => page([wireSupplier(`s${index}`)], 'mas')),
      );

      const all = await useCase.listAllSuppliers();

      expect(sent).toHaveLength(10);
      expect(all).toHaveLength(10);
    });

    it('does not believe a page that is not what the contract says', async () => {
      const { useCase } = setup({ items: [{ id: 3 }], nextCursor: null });

      const error = await failedWith(useCase.listAllSuppliers());

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).failure.class).toBe('transient');
    });

    it('creates one with its name and contact trimmed', async () => {
      const { sent, useCase } = setup(reply(wireSupplier('s1'), 201));

      const created = await useCase.createSupplier({
        name: '  Distribuidora El Sol ',
        contact: ' 300 123 4567 ',
      });

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/suppliers',
          body: { name: 'Distribuidora El Sol', contact: '300 123 4567' },
        },
      ]);
      expect(created.id).toBe('s1');
    });

    it('leaves out a contact that was not written, or that is only spaces or null', async () => {
      const { sent, useCase } = setup(
        reply(wireSupplier('s1'), 201),
        reply(wireSupplier('s2'), 201),
        reply(wireSupplier('s3'), 201),
      );

      await useCase.createSupplier({ name: 'A' });
      await useCase.createSupplier({ name: 'B', contact: '   ' });
      await useCase.createSupplier({ name: 'C', contact: null });

      expect(sent.map((request) => request.body)).toEqual([
        { name: 'A' },
        { name: 'B' },
        { name: 'C' },
      ]);
    });

    it('changes only what changed, and clears a contact with null', async () => {
      const { sent, useCase } = setup(wireSupplier('s1'), wireSupplier('s1'), wireSupplier('s1'));

      await useCase.updateSupplier('s1', { name: ' Nuevo nombre ' });
      await useCase.updateSupplier('s1', { contact: ' 311 ' });
      await useCase.updateSupplier('s1', { contact: null });

      expect(sent.map((request) => request.body)).toStrictEqual([
        { name: 'Nuevo nombre' },
        { contact: '311' },
        { contact: null },
      ]);
      expect(sent[0]).toMatchObject({ method: 'PATCH', path: '/v1/suppliers/s1' });
    });

    it('clears the contact when it is left blank, as when it is cleared', async () => {
      const { sent, useCase } = setup(wireSupplier('s1'));

      await useCase.updateSupplier('s1', { contact: '   ' });

      expect(sent[0]?.body).toEqual({ contact: null });
    });

    it('encodes the id of the supplier in the path, to change it and to delete it', async () => {
      const { sent, useCase } = setup(wireSupplier('s/1'), reply(undefined, 204));

      await useCase.updateSupplier('s/1', { name: 'x' });
      await useCase.deleteSupplier('s/1');

      expect(sent).toEqual([
        { method: 'PATCH', path: '/v1/suppliers/s%2F1', body: { name: 'x' } },
        { method: 'DELETE', path: '/v1/suppliers/s%2F1' },
      ]);
    });

    it('does not believe an answer that is not a supplier', async () => {
      const { useCase } = setup({}, {});

      expect(await failedWith(useCase.createSupplier({ name: 'a' }))).toBeInstanceOf(ApiError);
      expect(await failedWith(useCase.updateSupplier('s1', { name: 'a' }))).toBeInstanceOf(
        ApiError,
      );
    });
  });

  describe('purchases', () => {
    it('lists a page of purchases, 50 at a time, and asks for the next with its cursor', async () => {
      const { sent, useCase } = setup(page([wireSummary('c1')], 'sig'), page([]));

      const first = await useCase.listPurchases();
      await useCase.listPurchases(first.nextCursor ?? undefined);

      expect(sent).toEqual([
        { method: 'GET', path: '/v1/purchases', query: { limit: 50 } },
        { method: 'GET', path: '/v1/purchases', query: { limit: 50, cursor: 'sig' } },
      ]);
      expect(first.items[0]).toMatchObject({ id: 'c1', lineCount: 2 });
      expect(first.nextCursor).toBe('sig');
    });

    it('does not believe a page that is not what the contract says', async () => {
      const { useCase } = setup({ items: [{ id: 'c1' }], nextCursor: null });

      expect(await failedWith(useCase.listPurchases())).toBeInstanceOf(ApiError);
    });

    const purchase = {
      operationId: '11111111-1111-4111-8111-111111111111',
      supplierId: 's1',
      note: ' Pedido de octubre ',
      lines: [
        { productId: 'p1', quantityMilli: 24_000, unitCost: 2500 },
        { productId: 'p2', quantityMilli: 12_500, unitCost: 4200 },
      ],
    };

    it('registers a purchase with its operation id, its lines and its note trimmed', async () => {
      const { sent, useCase } = setup(reply(wirePurchase('c1'), 201));

      const result = await useCase.createPurchase(purchase);

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/purchases',
          body: {
            operationId: '11111111-1111-4111-8111-111111111111',
            supplierId: 's1',
            note: 'Pedido de octubre',
            lines: purchase.lines,
          },
        },
      ]);
      expect(result.purchase.id).toBe('c1');
      expect(result.replayed).toBe(false);
    });

    it('leaves out a supplier and a note that were not given', async () => {
      const { sent, useCase } = setup(
        reply(wirePurchase('c1'), 201),
        reply(wirePurchase('c2'), 201),
      );

      await useCase.createPurchase({ operationId: 'op', lines: purchase.lines });
      await useCase.createPurchase({
        operationId: 'op',
        supplierId: null,
        note: '   ',
        lines: purchase.lines,
      });

      expect(sent.map((request) => request.body)).toEqual([
        { operationId: 'op', lines: purchase.lines },
        { operationId: 'op', lines: purchase.lines },
      ]);
    });

    it('says the server had already applied it when it answers it repeated', async () => {
      const { useCase } = setup(reply(wirePurchase('c1'), 200, true));

      const result = await useCase.createPurchase(purchase);

      expect(result.replayed).toBe(true);
    });

    it('does not believe an answer that is not a purchase', async () => {
      const { useCase } = setup(reply({}, 201));

      expect(await failedWith(useCase.createPurchase(purchase))).toBeInstanceOf(ApiError);
    });
  });
});
