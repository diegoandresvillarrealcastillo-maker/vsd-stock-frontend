import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import {
  DEFAULT_SEARCH_LIMIT,
  indexProducts,
  isExactCode,
  normalizeForSearch,
  searchIndex,
  searchProducts,
} from './product-search';

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
    taxKind: 'exempt',
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

  it('puts the barcode typed without the zero of its EAN before a name that starts with those digits', () => {
    const upc = product({ name: 'Galleta', barcode: '012345678905' });
    const noisy = product({ name: '12345678905 de regalo' });

    expect(names(searchProducts([noisy, upc], '12345678905'))).toEqual([
      'Galleta',
      '12345678905 de regalo',
    ]);
  });

  it('puts what matches a code exactly before a name that starts with those digits', () => {
    const noisy = product({ name: '7701234567897 de regalo' });

    expect(names(searchProducts([noisy, rice], '7701234567897'))).toEqual([
      'Arroz 500 g',
      '7701234567897 de regalo',
    ]);
  });

  it('puts the code of the business before a name that starts with it', () => {
    const named = product({ name: 'ARR-1K especial', sku: 'X-1' });

    expect(names(searchProducts([named, bigRice], 'arr-1k'))).toEqual([
      'Arroz 1 kg',
      'ARR-1K especial',
    ]);
  });

  it('finds by a part of the barcode, as a person types the last digits', () => {
    expect(names(searchProducts(catalog, '4567'))).toEqual(['Arroz 500 g']);
  });

  it('finds by a part of the code of the business, even when the name has nothing of it', () => {
    expect(names(searchProducts(catalog, 'arr-1'))).toEqual(['Arroz 1 kg']);
  });

  it('does not take a product without a barcode for the one that was typed as zeros', () => {
    expect(searchProducts([product({ name: 'Sal', sku: 'SAL', barcode: null })], '0')).toEqual([]);
    expect(searchProducts([product({ name: 'Sal', sku: 'SAL', barcode: null })], '000')).toEqual(
      [],
    );
  });

  it('puts a word that starts with what was typed before one that only has it inside, even against the alphabet', () => {
    const found = searchProducts(
      [product({ name: 'Pasalacio' }), product({ name: 'Zeta sal' })],
      'sal',
    );

    expect(names(found)).toEqual(['Zeta sal', 'Pasalacio']);
  });

  it('wants every word to start a word before a product counts as one that starts like it', () => {
    const found = searchProducts(
      [product({ name: 'Almacen sal minimarket' }), product({ name: 'Zeta mar sal' })],
      'sal mar',
    );

    expect(names(found)).toEqual(['Zeta mar sal', 'Almacen sal minimarket']);
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

/** La busqueda tal como se escribio primero, sin indice: es la referencia contra la que se compara la rapida. */
function referenceSearch(
  products: readonly Product[],
  query: string,
  options: { limit?: number; includeArchived?: boolean } = {},
): Product[] {
  const wanted = normalizeForSearch(query);
  if (wanted === '') return [];
  const tokens = wanted.split(' ');
  const bare = (code: string) => code.replace(/^0+/, '');
  const found: { product: Product; name: string; tier: number }[] = [];
  for (const item of products) {
    if (!item.active && options.includeArchived !== true) continue;
    const name = normalizeForSearch(item.name);
    const sku = normalizeForSearch(item.sku);
    const barcode = item.barcode ?? '';
    let tier: number | null;
    if (sku === wanted || (barcode !== '' && bare(barcode) === bare(wanted))) tier = 0;
    else if (!tokens.every((token) => `${name} ${sku} ${barcode}`.includes(token))) tier = null;
    else if (name.startsWith(wanted)) tier = 1;
    else if (tokens.every((token) => name.split(' ').some((word) => word.startsWith(token))))
      tier = 2;
    else tier = 3;
    if (tier !== null) found.push({ product: item, name, tier });
  }
  found.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.name.localeCompare(b.name, 'es') ||
      a.product.id.localeCompare(b.product.id),
  );
  return found.slice(0, options.limit ?? DEFAULT_SEARCH_LIMIT).map(({ product: item }) => item);
}

/** Azar con semilla: una falla se puede repetir. */
function randomFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe('searching with an index made once', () => {
  const WORDS = [
    'Arroz',
    'Aceite',
    'Café',
    'Azúcar',
    'Pan',
    'Leche',
    'Ñame',
    'Sal',
    'Jabón',
    'Atún',
  ];
  const SIZES = ['500 g', '1 L', 'x12', 'grande', '250 ml'];

  function catalog(seed: number, size: number): Product[] {
    const next = randomFrom(seed);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T;
    const items: Product[] = [];
    for (let i = 0; i < size; i += 1) {
      const code = next() < 0.5 ? String(Math.floor(next() * 1e9)).padStart(13, '0') : null;
      items.push(
        product({
          // Nombres repetidos a proposito: el desempate por identificador tiene que ser el mismo.
          name: `${pick(WORDS)} ${pick(WORDS)} ${pick(SIZES)}`,
          sku: `SKU-${String(Math.floor(next() * 400))}`,
          barcode: code,
          active: next() < 0.9,
        }),
      );
    }
    return items;
  }

  it('gives exactly what the search without an index gives, for any catalog and any query', () => {
    const items = catalog(7, 400);
    const index = indexProducts(items);
    const next = randomFrom(99);
    const queries: string[] = [
      '',
      '  ',
      'a',
      'ar',
      'arroz',
      'ARROZ  ACEITE',
      'cafe',
      'ñame',
      'x',
      'sku-1',
    ];
    for (let i = 0; i < 300; i += 1) {
      const base = items[Math.floor(next() * items.length)] as Product;
      const text = next() < 0.5 ? base.name : (base.barcode ?? base.sku);
      const from = Math.floor(next() * text.length);
      queries.push(text.slice(from, from + 1 + Math.floor(next() * 8)));
    }

    for (const query of queries) {
      for (const options of [
        {},
        { limit: 3 },
        { includeArchived: true },
        { limit: 500, includeArchived: true },
      ]) {
        expect(searchIndex(index, query, options).map((item) => item.id)).toEqual(
          referenceSearch(items, query, options).map((item) => item.id),
        );
      }
    }
  });

  it('is what searching the plain list does: one is the other', () => {
    const items = catalog(3, 60);

    expect(searchProducts(items, 'aceite').map((item) => item.id)).toEqual(
      searchIndex(indexProducts(items), 'aceite').map((item) => item.id),
    );
  });

  it('finds nothing in an empty catalog and nothing when nothing is written', () => {
    expect(searchIndex(indexProducts([]), 'arroz')).toEqual([]);
    expect(searchIndex(indexProducts(catalog(1, 10)), '   ')).toEqual([]);
  });

  it('does not ask for more than the limit: a limit of zero gives nothing', () => {
    expect(searchIndex(indexProducts(catalog(5, 50)), 'a', { limit: 0 })).toEqual([]);
  });
});

describe('a code that is exactly the one of a product', () => {
  const arroz = product({ sku: 'ARR-500', barcode: '7701234567897' });

  it('is the code of the business, whatever its capitals', () => {
    expect(isExactCode(arroz, 'arr-500')).toBe(true);
    expect(isExactCode(arroz, ' ARR-500 ')).toBe(true);
  });

  it('is the barcode as the reader types it, with or without the zero that turns a UPC into an EAN', () => {
    expect(isExactCode(arroz, '7701234567897')).toBe(true);
    const upc = product({ barcode: '0123456789012' });
    expect(isExactCode(upc, '123456789012')).toBe(true);
  });

  it('is not a part of a code, nor a name', () => {
    expect(isExactCode(arroz, 'ARR')).toBe(false);
    expect(isExactCode(arroz, '4567897')).toBe(false);
    expect(isExactCode(product({ name: 'ARR-500 especial', sku: 'X' }), 'arr-500')).toBe(false);
  });

  it('is not nothing: an empty text is not the code of anyone', () => {
    expect(isExactCode(arroz, '')).toBe(false);
    expect(isExactCode(arroz, '   ')).toBe(false);
    // Un codigo de barras de solo ceros quedaria igual a un texto vacio una vez quitados los ceros: no cuenta.
    expect(isExactCode(product({ sku: 'X', barcode: '0' }), '')).toBe(false);
  });

  it('is not the barcode of a product that has none', () => {
    expect(isExactCode(product({ barcode: null }), '0000')).toBe(false);
  });
});
