import { describe, expect, it } from 'vitest';
import { createFakeApi, reply } from '../../../test/support/fake-api';
import { ApiError } from '../../domain/model/api-error';
import { CatalogUseCase } from './catalog.usecase';

const wireProduct = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Producto ${id}`,
  sku: `SKU-${id}`,
  barcode: null,
  unit: 'unit',
  unitPrice: 3200,
  taxRateBp: 0,
  taxKind: 'exempt',
  active: true,
  categoryId: null,
  minStockMilli: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  updatedAt: '2026-10-17T12:00:00.000Z',
  ...overrides,
});

const wireCategory = (id: string, name = `Categoría ${id}`) => ({
  id,
  name,
  createdAt: '2026-10-17T12:00:00.000Z',
});

const page = (items: object[], nextCursor: string | null = null) => ({ items, nextCursor });

const failedWith = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

function setup(...answers: unknown[]) {
  const { api, sent } = createFakeApi(...answers);
  return { sent, useCase: new CatalogUseCase(api) };
}

describe('CatalogUseCase', () => {
  describe('listing products', () => {
    it('asks for the first page, 50 at a time, with no filter', async () => {
      const { sent, useCase } = setup(page([wireProduct('a')]));

      const result = await useCase.listProducts({});

      expect(sent).toStrictEqual([{ method: 'GET', path: '/v1/products', query: { limit: 50 } }]);
      expect(result.items.map((product) => product.id)).toEqual(['a']);
      expect(result.nextCursor).toBeNull();
    });

    it('passes the search, the state and the category as they are', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.listProducts({ search: '  arroz ', active: false, categoryId: 'c1' });

      expect(sent[0]?.query).toEqual({
        limit: 50,
        search: 'arroz',
        active: false,
        categoryId: 'c1',
      });
    });

    it('does not send a search that is only spaces', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.listProducts({ search: '   ' });

      expect(sent[0]?.query).toStrictEqual({ limit: 50 });
    });

    it('asks for the next page with the cursor of the last one, as it came', async () => {
      const { sent, useCase } = setup(page([wireProduct('a')], 'cursor-1'), page([]));

      const first = await useCase.listProducts({});
      await useCase.listProducts({}, first.nextCursor ?? undefined);

      expect(first.nextCursor).toBe('cursor-1');
      expect(sent[1]?.query).toEqual({ limit: 50, cursor: 'cursor-1' });
    });

    it('does not believe a page that is not what the contract says', async () => {
      const { useCase } = setup({ items: [{ id: 3 }], nextCursor: null });

      const error = await failedWith(useCase.listProducts({}));

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('reading one product', () => {
    it('asks for it by its id, encoded', async () => {
      const { sent, useCase } = setup(wireProduct('a/b'));

      const product = await useCase.getProduct('a/b');

      expect(sent).toEqual([{ method: 'GET', path: '/v1/products/a%2Fb' }]);
      expect(product.id).toBe('a/b');
    });

    it('does not believe an answer that is not a product', async () => {
      const { useCase } = setup({ id: 'a' });

      expect(await failedWith(useCase.getProduct('a'))).toBeInstanceOf(ApiError);
    });
  });

  describe('creating a product', () => {
    it('sends the data trimmed and leaves out what was not given', async () => {
      const { sent, useCase } = setup(reply(wireProduct('a'), 201));

      const product = await useCase.createProduct({
        name: '  Arroz 500 g ',
        sku: ' ARR-500 ',
        unit: 'unit',
        unitPrice: 3200,
        taxRateBp: 0,
        taxKind: 'exempt',
      });

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/products',
          body: {
            name: 'Arroz 500 g',
            sku: 'ARR-500',
            unit: 'unit',
            unitPrice: 3200,
            taxRateBp: 0,
            taxKind: 'exempt',
          },
        },
      ]);
      expect(product.id).toBe('a');
    });

    it.each([
      ['taxed', 1900],
      ['taxed', 500],
      ['exempt', 0],
      ['excluded', 0],
    ] as const)(
      'sends the kind %s together with its rate of %i basis points',
      async (taxKind, taxRateBp) => {
        const { sent, useCase } = setup(reply(wireProduct('a', { taxKind, taxRateBp }), 201));

        await useCase.createProduct({
          name: 'Arroz',
          sku: 'ARR',
          unit: 'unit',
          unitPrice: 3200,
          taxRateBp,
          taxKind,
        });

        expect(sent[0]?.body).toMatchObject({ taxKind, taxRateBp });
      },
    );

    it('sends the barcode, the category and the minimum when they are given', async () => {
      const { sent, useCase } = setup(reply(wireProduct('a'), 201));

      await useCase.createProduct({
        name: 'Arroz',
        sku: 'ARR',
        barcode: ' 7701234567897 ',
        unit: 'kilogram',
        unitPrice: 5000,
        taxRateBp: 500,
        taxKind: 'taxed',
        categoryId: 'c1',
        minStockMilli: 2500,
      });

      expect(sent[0]?.body).toEqual({
        name: 'Arroz',
        sku: 'ARR',
        barcode: '7701234567897',
        unit: 'kilogram',
        unitPrice: 5000,
        taxRateBp: 500,
        taxKind: 'taxed',
        categoryId: 'c1',
        minStockMilli: 2500,
      });
    });

    it('leaves out a barcode, a category and a minimum that are null', async () => {
      const { sent, useCase } = setup(reply(wireProduct('a'), 201));

      await useCase.createProduct({
        name: 'Arroz',
        sku: 'ARR',
        barcode: null,
        unit: 'unit',
        unitPrice: 1,
        taxRateBp: 0,
        taxKind: 'excluded',
        categoryId: null,
        minStockMilli: null,
      });

      expect(sent[0]?.body).toEqual({
        name: 'Arroz',
        sku: 'ARR',
        unit: 'unit',
        unitPrice: 1,
        taxRateBp: 0,
        taxKind: 'excluded',
      });
    });

    it('does not believe an answer that is not a product', async () => {
      const { useCase } = setup(reply({}, 201));

      expect(
        await failedWith(
          useCase.createProduct({
            name: 'a',
            sku: 'b',
            unit: 'unit',
            unitPrice: 1,
            taxRateBp: 0,
            taxKind: 'exempt',
          }),
        ),
      ).toBeInstanceOf(ApiError);
    });
  });

  describe('changing a product', () => {
    it('sends only what changes, trimmed', async () => {
      const { sent, useCase } = setup(wireProduct('a'));

      await useCase.updateProduct('a', { name: ' Arroz Diana ', unitPrice: 3500 });

      expect(sent).toStrictEqual([
        {
          method: 'PATCH',
          path: '/v1/products/a',
          body: { name: 'Arroz Diana', unitPrice: 3500 },
        },
      ]);
    });

    it('sends null to clear the barcode, the category and the minimum', async () => {
      const { sent, useCase } = setup(wireProduct('a'));

      await useCase.updateProduct('a', { barcode: null, categoryId: null, minStockMilli: null });

      expect(sent[0]?.body).toStrictEqual({ barcode: null, categoryId: null, minStockMilli: null });
    });

    it('sends every field that can change', async () => {
      const { sent, useCase } = setup(wireProduct('a'));

      await useCase.updateProduct('a', {
        name: 'n',
        sku: ' s ',
        barcode: ' 123 ',
        unit: 'liter',
        unitPrice: 10,
        taxRateBp: 1900,
        taxKind: 'taxed',
        categoryId: 'c2',
        minStockMilli: 5,
        active: false,
      });

      expect(sent[0]?.body).toStrictEqual({
        name: 'n',
        sku: 's',
        barcode: '123',
        unit: 'liter',
        unitPrice: 10,
        taxRateBp: 1900,
        taxKind: 'taxed',
        categoryId: 'c2',
        minStockMilli: 5,
        active: false,
      });
    });

    it('sends the kind alone when only the kind changes', async () => {
      const { sent, useCase } = setup(wireProduct('a', { taxKind: 'excluded' }));

      await useCase.updateProduct('a', { taxKind: 'excluded' });

      expect(sent[0]?.body).toStrictEqual({ taxKind: 'excluded' });
    });

    it('archives and reactivates with the same call', async () => {
      const { sent, useCase } = setup(wireProduct('a', { active: false }), wireProduct('a'));

      const archived = await useCase.updateProduct('a', { active: false });
      const back = await useCase.updateProduct('a', { active: true });

      expect(archived.active).toBe(false);
      expect(back.active).toBe(true);
      expect(sent.map((request) => request.body)).toStrictEqual([
        { active: false },
        { active: true },
      ]);
    });

    it('encodes the id in the path', async () => {
      const { sent, useCase } = setup(wireProduct('a'));

      await useCase.updateProduct('a/b', { name: 'x' });

      expect(sent[0]?.path).toBe('/v1/products/a%2Fb');
    });

    it('does not believe an answer that is not a product', async () => {
      const { useCase } = setup({});

      expect(await failedWith(useCase.updateProduct('a', { name: 'x' }))).toBeInstanceOf(ApiError);
    });
  });

  describe('finding who has a SKU or a barcode', () => {
    it('finds the product whose SKU is exactly that one, whatever the case', async () => {
      const { sent, useCase } = setup(
        page([wireProduct('a', { sku: 'ARR-500-X' }), wireProduct('b', { sku: 'arr-500' })]),
      );

      const found = await useCase.findProductByCode('sku', ' ARR-500 ');

      expect(found?.id).toBe('b');
      expect(sent[0]?.query).toEqual({ limit: 50, search: 'ARR-500' });
    });

    it('finds the product whose barcode is that one, even if one writes it with a leading zero and the other does not', async () => {
      const { useCase } = setup(page([wireProduct('a', { barcode: '012345678905' })]));

      const found = await useCase.findProductByCode('barcode', '0012345678905');

      expect(found?.id).toBe('a');
    });

    it('says nobody has it when nothing matches exactly', async () => {
      const { useCase } = setup(page([wireProduct('a', { sku: 'ARR-500-X' })]));

      expect(await useCase.findProductByCode('sku', 'ARR-500')).toBeNull();
    });

    it('does not look for an empty code', async () => {
      const { sent, useCase } = setup();

      expect(await useCase.findProductByCode('sku', '  ')).toBeNull();
      expect(sent).toEqual([]);
    });

    it('does not take a product without a barcode for a match', async () => {
      const { useCase } = setup(page([wireProduct('a', { barcode: null })]));

      expect(await useCase.findProductByCode('barcode', '123')).toBeNull();
    });

    it.each(['0', '000', ' 0000 '])(
      'does not take a product without a barcode for the one that is «%s», which is nothing once the zeros go',
      async (code) => {
        const { useCase } = setup(page([wireProduct('a', { barcode: null })]));

        expect(await useCase.findProductByCode('barcode', code)).toBeNull();
      },
    );
  });

  describe('categories', () => {
    it('lists a page of categories, 50 at a time', async () => {
      const { sent, useCase } = setup(page([wireCategory('c1')], 'sig'));

      const result = await useCase.listCategories();

      expect(sent).toEqual([{ method: 'GET', path: '/v1/categories', query: { limit: 50 } }]);
      expect(result.items.map((category) => category.id)).toEqual(['c1']);
      expect(result.nextCursor).toBe('sig');
    });

    it('asks for the next page with its cursor', async () => {
      const { sent, useCase } = setup(page([]));

      await useCase.listCategories('sig');

      expect(sent[0]?.query).toEqual({ limit: 50, cursor: 'sig' });
    });

    it('reads every category, page after page, in the order they come', async () => {
      const { sent, useCase } = setup(
        page([wireCategory('c1')], 'p2'),
        page([wireCategory('c2')], 'p3'),
        page([wireCategory('c3')]),
      );

      const all = await useCase.listAllCategories();

      expect(all.map((category) => category.id)).toEqual(['c1', 'c2', 'c3']);
      expect(sent.map((request) => request.query)).toEqual([
        { limit: 200 },
        { limit: 200, cursor: 'p2' },
        { limit: 200, cursor: 'p3' },
      ]);
    });

    it('stops reading after ten pages, so a server that never ends does not hang the screen', async () => {
      const { sent, useCase } = setup(
        ...Array.from({ length: 12 }, (_, index) => page([wireCategory(`c${index}`)], 'mas')),
      );

      const all = await useCase.listAllCategories();

      expect(sent).toHaveLength(10);
      expect(all).toHaveLength(10);
    });

    it('creates one, with its name trimmed', async () => {
      const { sent, useCase } = setup(reply(wireCategory('c1', 'Granos'), 201));

      const created = await useCase.createCategory('  Granos ');

      expect(sent).toEqual([{ method: 'POST', path: '/v1/categories', body: { name: 'Granos' } }]);
      expect(created.name).toBe('Granos');
    });

    it('renames one by its id, encoded', async () => {
      const { sent, useCase } = setup(wireCategory('c/1', 'Cereales'));

      const renamed = await useCase.renameCategory('c/1', ' Cereales ');

      expect(sent).toEqual([
        { method: 'PATCH', path: '/v1/categories/c%2F1', body: { name: 'Cereales' } },
      ]);
      expect(renamed.name).toBe('Cereales');
    });

    it('deletes one by its id, encoded, and expects nothing back', async () => {
      const { sent, useCase } = setup(reply(undefined, 204));

      await useCase.deleteCategory('c/1');

      expect(sent).toEqual([{ method: 'DELETE', path: '/v1/categories/c%2F1' }]);
    });

    it('does not believe an answer that is not a category', async () => {
      const { useCase } = setup({}, {}, { items: 3 });

      expect(await failedWith(useCase.createCategory('a'))).toBeInstanceOf(ApiError);
      expect(await failedWith(useCase.renameCategory('c', 'a'))).toBeInstanceOf(ApiError);
      expect(await failedWith(useCase.listCategories())).toBeInstanceOf(ApiError);
    });
  });

  describe('what it says when the answer is not what the contract says', () => {
    it.each([
      [
        'a page',
        (useCase: CatalogUseCase) => useCase.listProducts({}),
        { items: [{ id: 3 }], nextCursor: null },
      ],
      ['a product', (useCase: CatalogUseCase) => useCase.getProduct('a'), { id: 'a' }],
      ['a category', (useCase: CatalogUseCase) => useCase.createCategory('X'), { id: 'a' }],
    ])(
      'keeps the status of the strange answer for %s, so the log can tell',
      async (_what, ask, body) => {
        const { useCase } = setup(reply(body, 203));

        const error = await failedWith(ask(useCase));

        expect((error as ApiError).failure.status).toBe(203);
      },
    );
  });
});
