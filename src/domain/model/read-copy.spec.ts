import { describe, expect, it } from 'vitest';
import { parseProduct } from './catalog';
import { COPY_MARGIN_MS, parseCopyPage, parseStockLevel, sinceOf } from './read-copy';

const PRODUCT = {
  id: 'f0000000-0000-4000-8000-000000000001',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  barcode: '7701234567897',
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

describe('a stock level of the copy', () => {
  it('is the product and what is left of it, in thousandths of its unit', () => {
    expect(parseStockLevel({ productId: PRODUCT.id, quantityMilli: 12_500 })).toEqual({
      productId: PRODUCT.id,
      quantityMilli: 12_500,
    });
  });

  it('can be zero or negative: a sale made without stock is accepted and marked', () => {
    expect(parseStockLevel({ productId: PRODUCT.id, quantityMilli: 0 })?.quantityMilli).toBe(0);
    expect(parseStockLevel({ productId: PRODUCT.id, quantityMilli: -2_000 })?.quantityMilli).toBe(
      -2_000,
    );
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a list', []],
    ['a text', 'x'],
    ['no product', { quantityMilli: 1 }],
    ['a product that is not text', { productId: 5, quantityMilli: 1 }],
    ['no quantity', { productId: PRODUCT.id }],
    ['a quantity with decimals', { productId: PRODUCT.id, quantityMilli: 1.5 }],
    ['a quantity that is text', { productId: PRODUCT.id, quantityMilli: '1' }],
    ['a quantity that is too big to be exact', { productId: PRODUCT.id, quantityMilli: 2 ** 60 }],
  ])('is nothing when it brings %s', (_name, value) => {
    expect(parseStockLevel(value)).toBeNull();
  });
});

describe('a page of the copy', () => {
  it('has the hour of the server when it was read, what changed and where the next page starts', () => {
    const page = parseCopyPage(
      { asOf: AS_OF, items: [PRODUCT], nextCursor: 'siguiente' },
      parseProduct,
    );

    expect(page?.asOf).toEqual(new Date(AS_OF));
    expect(page?.items.map((product) => product.name)).toEqual(['Arroz 500 g']);
    expect(page?.nextCursor).toBe('siguiente');
  });

  it('says there is no next page with a null cursor, and can be empty', () => {
    expect(parseCopyPage({ asOf: AS_OF, items: [], nextCursor: null }, parseProduct)).toEqual({
      asOf: new Date(AS_OF),
      items: [],
      nextCursor: null,
    });
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a list', []],
    ['no hour', { items: [], nextCursor: null }],
    ['an hour that is not text', { asOf: 5, items: [], nextCursor: null }],
    ['an hour that is not an hour', { asOf: 'ayer', items: [], nextCursor: null }],
    ['no items', { asOf: AS_OF, nextCursor: null }],
    ['items that are not a list', { asOf: AS_OF, items: 'no', nextCursor: null }],
    ['no cursor', { asOf: AS_OF, items: [] }],
    ['a cursor that is not text', { asOf: AS_OF, items: [], nextCursor: 5 }],
    ['one item that is not right', { asOf: AS_OF, items: [PRODUCT, { id: 5 }], nextCursor: null }],
  ])('is nothing when it brings %s: the network is not to be trusted', (_name, value) => {
    expect(parseCopyPage(value, parseProduct)).toBeNull();
  });
});

describe('where the next download starts', () => {
  it('is one minute before the hour of the first page: what was still being written then comes again', () => {
    expect(COPY_MARGIN_MS).toBe(60_000);
    expect(sinceOf(new Date(AS_OF))).toEqual(new Date('2026-10-19T14:59:00.123Z'));
  });
});
