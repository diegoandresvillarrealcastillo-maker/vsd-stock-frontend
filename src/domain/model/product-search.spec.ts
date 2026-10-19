import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import { DEFAULT_SEARCH_LIMIT, normalizeForSearch, searchProducts } from './product-search';

let counter = 0;
const product = (change: Partial<Product> = {}): Product => {
  counter += 1;
  return {
    id: `f0000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    name: `Producto ${String(counter)}`,
    sku: `SKU-${String(counter)}`,
    barcode: null,
    unit: 'unit',
    unitPrice: 1_000,
    taxRateBp: 0,
    active: true,
    categoryId: null,
    minStockMilli: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...change,
  };
};

const names = (found: readonly Product[]) => found.map((item) => item.name);

describe('how a search is written', () => {
  it.each([
    ['  Aceite   de OLIVA ', 'aceite de oliva'],
    ['Café Molído', 'cafe molido'],
    ['Ñame', 'name'],
    ['', ''],
    ['   ', ''],
  ])(
    'writes «%s» as «%s»: no capitals, no accents and one space between words',
    (text, written) => {
      expect(normalizeForSearch(text)).toBe(written);
    },
  );
});

describe('searching the copy of the catalog', () => {
  const rice = product({ name: 'Arroz 500 g', sku: 'ARR-500', barcode: '7701234567897' });
  const bigRice = product({ name: 'Arroz 1 kg', sku: 'ARR-1K' });
  const oil = product({ name: 'Aceite 1 L', sku: 'ACE-1L' });
  const coffee = product({ name: 'Café molido 250 g', sku: 'CAF-250' });
  const catalog = [rice, bigRice, oil, coffee];

  it('finds nothing when nothing is asked, so the counter shows no list until someone types', () => {
    expect(searchProducts(catalog, '')).toEqual([]);
    expect(searchProducts(catalog, '   ')).toEqual([]);
  });

  it('finds by name without caring for capitals or accents, in the way it is written or not', () => {
    expect(names(searchProducts(catalog, 'ACEITE'))).toEqual(['Aceite 1 L']);
    expect(names(searchProducts(catalog, 'cafe'))).toEqual(['Café molido 250 g']);
    expect(names(searchProducts(catalog, 'café'))).toEqual(['Café molido 250 g']);
  });

  it('wants every word that was typed, in any order', () => {
    expect(names(searchProducts(catalog, 'arroz 500'))).toEqual(['Arroz 500 g']);
    expect(names(searchProducts(catalog, '500 arroz'))).toEqual(['Arroz 500 g']);
    expect(searchProducts(catalog, 'arroz aceite')).toEqual([]);
  });

  it('finds in the middle of a word as well', () => {
    expect(names(searchProducts(catalog, 'olid'))).toEqual(['Café molido 250 g']);
  });

  it('finds by the code of the business, whatever its capitals', () => {
    expect(names(searchProducts(catalog, 'arr-1k'))).toEqual(['Arroz 1 kg']);
    expect(names(searchProducts(catalog, 'ACE-1L'))).toEqual(['Aceite 1 L']);
  });

  it('finds by the barcode as the reader types it, with or without the zero that turns a UPC into an EAN', () => {
    expect(names(searchProducts(catalog, '7701234567897'))).toEqual(['Arroz 500 g']);
    expect(names(searchProducts(catalog, '07701234567897'))).toEqual(['Arroz 500 g']);
    expect(
      names(searchProducts([product({ name: 'Galleta', barcode: '012345678905' })], '12345678905')),
    ).toEqual(['Galleta']);
  });

  it('puts what matches a code exactly before anything else, even if other names contain those digits', () => {
    const noisy = product({ name: 'Paquete 7701234567897 de regalo' });

    expect(names(searchProducts([noisy, rice], '7701234567897'))).toEqual([
      'Arroz 500 g',
      'Paquete 7701234567897 de regalo',
    ]);
  });

  it('does not offer what is archived, which can not be sold, unless it is asked for', () => {
    const old = product({ name: 'Arroz viejo', active: false });

    expect(names(searchProducts([old, rice], 'arroz'))).toEqual(['Arroz 500 g']);
    expect(names(searchProducts([old, rice], 'arroz', { includeArchived: true }))).toEqual([
      'Arroz 500 g',
      'Arroz viejo',
    ]);
  });

  it('puts what starts with what was typed before what only contains it, and the rest in alphabetical order', () => {
    const found = searchProducts(
      [
        product({ name: 'Sal de mesa' }),
        product({ name: 'Pan con sal' }),
        product({ name: 'Salsa de tomate' }),
        product({ name: 'Sal marina' }),
      ],
      'sal',
    );

    expect(names(found)).toEqual(['Sal de mesa', 'Sal marina', 'Salsa de tomate', 'Pan con sal']);
  });

  it('puts a word that starts with what was typed before one that contains it in the middle', () => {
    const found = searchProducts(
      [
        product({ name: 'Frijol salado' }),
        product({ name: 'Frijol y sal' }),
        product({ name: 'Pasalacio' }),
      ],
      'sal',
    );

    expect(names(found)).toEqual(['Frijol salado', 'Frijol y sal', 'Pasalacio']);
  });

  it('gives no more than twenty by default, or what is asked', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      product({ name: `Pan ${String(index).padStart(2, '0')}` }),
    );

    expect(DEFAULT_SEARCH_LIMIT).toBe(20);
    expect(searchProducts(many, 'pan')).toHaveLength(20);
    expect(searchProducts(many, 'pan', { limit: 5 })).toHaveLength(5);
    expect(names(searchProducts(many, 'pan', { limit: 2 }))).toEqual(['Pan 00', 'Pan 01']);
  });

  it('is the same order every time when two products have the same name', () => {
    const first = product({ name: 'Pan' });
    const second = product({ name: 'Pan' });

    expect(searchProducts([second, first], 'pan').map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);
  });
});
