import { describe, expect, it } from 'vitest';
import {
  UNITS,
  isUnit,
  parseCategory,
  parseProduct,
  parseStoredProduct,
  taxChoiceLabel,
  taxLabel,
  unitIsWhole,
  unitLabel,
  unitShort,
} from './catalog';

const PRODUCT = {
  id: 'p-1',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  barcode: '7701234567897',
  unit: 'unit',
  unitPrice: 3200,
  taxRateBp: 0,
  taxKind: 'exempt',
  active: true,
  categoryId: 'c-1',
  minStockMilli: 10_000,
  createdAt: '2026-10-17T12:00:00.000Z',
  updatedAt: '2026-10-17T13:00:00.000Z',
};

describe('parseProduct', () => {
  it('reads a product with every field', () => {
    expect(parseProduct(PRODUCT)).toEqual({
      ...PRODUCT,
      createdAt: new Date('2026-10-17T12:00:00.000Z'),
      updatedAt: new Date('2026-10-17T13:00:00.000Z'),
    });
  });

  it('reads a product with no barcode, no category and no minimum', () => {
    const product = parseProduct({
      ...PRODUCT,
      barcode: null,
      categoryId: null,
      minStockMilli: null,
    });

    expect(product?.barcode).toBeNull();
    expect(product?.categoryId).toBeNull();
    expect(product?.minStockMilli).toBeNull();
  });

  it('reads an archived product', () => {
    expect(parseProduct({ ...PRODUCT, active: false })?.active).toBe(false);
  });

  it.each([null, 'x', 3, [], {}])('does not believe a body that is not a product: %j', (body) => {
    expect(parseProduct(body)).toBeNull();
  });

  it.each([
    ['id', 3],
    ['name', null],
    ['sku', 4],
    ['barcode', 7701234567897],
    ['unit', 'box'],
    ['unitPrice', '3200'],
    ['unitPrice', 3200.5],
    ['unitPrice', -1],
    ['taxRateBp', 800],
    ['taxRateBp', '0'],
    ['taxKind', 'unclassified'],
    ['taxKind', 1],
    ['taxKind', null],
    ['active', 'true'],
    ['categoryId', 3],
    ['minStockMilli', '10'],
    ['minStockMilli', 1.5],
    ['createdAt', 'ayer'],
    ['createdAt', 5],
    ['updatedAt', 'ayer'],
  ])('does not believe a product whose %s is %j', (field, value) => {
    expect(parseProduct({ ...PRODUCT, [field]: value })).toBeNull();
  });

  it.each([
    'id',
    'name',
    'sku',
    'unit',
    'unitPrice',
    'taxRateBp',
    'taxKind',
    'active',
    'createdAt',
  ])('does not believe a product without %s', (field) => {
    const { [field]: _omitted, ...rest } = PRODUCT as Record<string, unknown>;
    expect(parseProduct(rest)).toBeNull();
  });

  it.each([
    ['taxed', 1900],
    ['taxed', 500],
    ['exempt', 0],
    ['excluded', 0],
  ])('reads the kind %s with %i basis points', (taxKind, taxRateBp) => {
    const product = parseProduct({ ...PRODUCT, taxKind, taxRateBp });

    expect(product?.taxKind).toBe(taxKind);
    expect(product?.taxRateBp).toBe(taxRateBp);
  });

  it.each([
    ['taxed', 0],
    ['exempt', 1900],
    ['exempt', 500],
    ['excluded', 500],
  ])('does not believe a product whose kind %s and rate %i do not fit', (taxKind, taxRateBp) => {
    expect(parseProduct({ ...PRODUCT, taxKind, taxRateBp })).toBeNull();
  });
});

describe('parseStoredProduct', () => {
  const { taxKind: _gone, ...LEGACY } = PRODUCT;

  it('reads what parseProduct reads, the same way', () => {
    expect(parseStoredProduct(PRODUCT)).toEqual(parseProduct(PRODUCT));
  });

  it.each([
    [0, 'exempt'],
    [500, 'taxed'],
    [1900, 'taxed'],
  ])(
    'starts the kind of a product kept without one, at %i basis points, as «%s»',
    (taxRateBp, kind) => {
      expect(parseStoredProduct({ ...LEGACY, taxRateBp })?.taxKind).toBe(kind);
    },
  );

  it('does not correct a kind that is there and is not one of the three', () => {
    expect(parseStoredProduct({ ...PRODUCT, taxKind: 'unclassified' })).toBeNull();
    expect(parseStoredProduct({ ...PRODUCT, taxKind: null })).toBeNull();
  });

  it('does not correct a kind that does not fit the rate', () => {
    expect(parseStoredProduct({ ...PRODUCT, taxKind: 'taxed', taxRateBp: 0 })).toBeNull();
  });

  it('still refuses a product without a rate, which is not something to start a kind from', () => {
    const { taxRateBp: _rate, ...withoutRate } = LEGACY;

    expect(parseStoredProduct(withoutRate)).toBeNull();
    expect(parseStoredProduct({ ...LEGACY, taxRateBp: '0' })).toBeNull();
  });

  it.each([null, 'x', 3, []])('does not believe %j', (body) => {
    expect(parseStoredProduct(body)).toBeNull();
  });
});

describe('parseCategory', () => {
  it('reads a category', () => {
    expect(
      parseCategory({ id: 'c-1', name: 'Granos', createdAt: '2026-10-17T12:00:00.000Z' }),
    ).toEqual({
      id: 'c-1',
      name: 'Granos',
      createdAt: new Date('2026-10-17T12:00:00.000Z'),
    });
  });

  it.each([
    null,
    'x',
    {},
    { id: 'c-1', name: 3, createdAt: '2026-10-17T12:00:00.000Z' },
    { id: 3, name: 'Granos', createdAt: '2026-10-17T12:00:00.000Z' },
    { id: 'c-1', name: 'Granos', createdAt: 'ayer' },
    { id: 'c-1', name: 'Granos' },
  ])('does not believe a body that is not a category: %j', (body) => {
    expect(parseCategory(body)).toBeNull();
  });
});

describe('units', () => {
  it('offers the six units of the contract, the unit first', () => {
    expect(UNITS.map((unit) => unit.code)).toEqual([
      'unit',
      'kilogram',
      'gram',
      'pound',
      'liter',
      'milliliter',
    ]);
  });

  it.each([
    ['unit', 'Unidad (und)', 'und'],
    ['kilogram', 'Kilogramo (kg)', 'kg'],
    ['gram', 'Gramo (g)', 'g'],
    ['pound', 'Libra (lb)', 'lb'],
    ['liter', 'Litro (L)', 'L'],
    ['milliliter', 'Mililitro (mL)', 'mL'],
  ] as const)('names %s «%s» and abbreviates it «%s»', (code, label, short) => {
    expect(unitLabel(code)).toBe(label);
    expect(unitShort(code)).toBe(short);
  });

  it('counts only the unit in whole numbers', () => {
    expect(unitIsWhole('unit')).toBe(true);
    for (const code of ['kilogram', 'gram', 'pound', 'liter', 'milliliter'] as const) {
      expect(unitIsWhole(code)).toBe(false);
    }
  });

  it('recognises a unit of the contract and nothing else', () => {
    expect(isUnit('gram')).toBe(true);
    expect(isUnit('box')).toBe(false);
    expect(isUnit('toString')).toBe(false);
    expect(isUnit(3)).toBe(false);
  });
});

describe('taxChoiceLabel', () => {
  it.each([
    ['taxed', 1900, 'Gravado 19 %'],
    ['taxed', 500, 'Gravado 5 %'],
    ['exempt', 0, 'Exento'],
    ['excluded', 0, 'Excluido'],
  ] as const)('says the kind %s with %i basis points «%s»', (kind, rateBp, label) => {
    expect(taxChoiceLabel(kind, rateBp)).toBe(label);
  });
});

describe('taxLabel', () => {
  it.each([
    [0, '0 %'],
    [500, '5 %'],
    [1900, '19 %'],
  ])('writes %i basis points as «%s»', (bp, label) => {
    expect(taxLabel(bp)).toBe(label);
  });

  it.each(['barcode', 'categoryId', 'minStockMilli', 'updatedAt'])(
    'does not believe a product that leaves out «%s», which the contract always sends (null when it is empty)',
    (field) => {
      const { [field]: _omitted, ...rest } = PRODUCT as Record<string, unknown>;

      expect(parseProduct(rest)).toBeNull();
    },
  );
});
