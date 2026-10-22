import { vi, type Mock } from 'vitest';
import type { Category, Product } from '../../src/domain/model/catalog';
import type { Page } from '../../src/domain/model/page';
import type { Catalog } from '../../src/domain/ports/in/catalog';

export function testProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    name: 'Arroz 500 g',
    sku: 'ARR-500',
    barcode: null,
    unit: 'unit',
    unitPrice: 3200,
    taxRateBp: 0,
    active: true,
    categoryId: 'c-1',
    minStockMilli: null,
    createdAt: new Date('2026-10-17T12:00:00.000Z'),
    updatedAt: new Date('2026-10-17T12:00:00.000Z'),
    ...overrides,
  };
}

export function testCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c-1',
    name: 'Granos',
    createdAt: new Date('2026-10-17T12:00:00.000Z'),
    ...overrides,
  };
}

/** Cada metodo es un doble de Vitest: la prueba prepara lo que contesta y mira con que se le llamo. */
export type FakeCatalog = { [K in keyof Catalog]: Mock<Catalog[K]> };

export const lastPage = <T>(items: T[]): Page<T> => ({ items, nextCursor: null });

/** Un catalogo de mentira que por omision contesta bien, con una categoria y dos productos. */
export function createFakeCatalog(
  products: Product[] = [
    testProduct(),
    testProduct({
      id: 'p-2',
      name: 'Aceite 1 L',
      sku: 'ACE-1L',
      unitPrice: 12_500,
      categoryId: null,
    }),
  ],
  categories: Category[] = [testCategory()],
): FakeCatalog {
  return {
    listProducts: vi
      .fn<Catalog['listProducts']>()
      .mockImplementation(() => Promise.resolve(lastPage(products))),
    getProduct: vi
      .fn<Catalog['getProduct']>()
      .mockImplementation((id) =>
        Promise.resolve(products.find((product) => product.id === id) ?? testProduct({ id })),
      ),
    createProduct: vi.fn<Catalog['createProduct']>().mockImplementation((input) =>
      Promise.resolve(
        testProduct({
          id: 'nuevo',
          name: input.name,
          sku: input.sku,
          barcode: input.barcode ?? null,
          unit: input.unit,
          unitPrice: input.unitPrice,
          taxRateBp: input.taxRateBp,
          categoryId: input.categoryId ?? null,
          minStockMilli: input.minStockMilli ?? null,
        }),
      ),
    ),
    updateProduct: vi.fn<Catalog['updateProduct']>().mockImplementation((id, change) =>
      Promise.resolve(
        testProduct({
          ...(products.find((product) => product.id === id) ?? { id }),
          ...(change.name === undefined ? {} : { name: change.name }),
          ...(change.sku === undefined ? {} : { sku: change.sku }),
          ...(change.barcode === undefined ? {} : { barcode: change.barcode }),
          ...(change.unit === undefined ? {} : { unit: change.unit }),
          ...(change.unitPrice === undefined ? {} : { unitPrice: change.unitPrice }),
          ...(change.taxRateBp === undefined ? {} : { taxRateBp: change.taxRateBp }),
          ...(change.categoryId === undefined ? {} : { categoryId: change.categoryId }),
          ...(change.minStockMilli === undefined ? {} : { minStockMilli: change.minStockMilli }),
          ...(change.active === undefined ? {} : { active: change.active }),
        }),
      ),
    ),
    findProductByCode: vi.fn<Catalog['findProductByCode']>().mockResolvedValue(null),
    listCategories: vi
      .fn<Catalog['listCategories']>()
      .mockImplementation(() => Promise.resolve(lastPage(categories))),
    listAllCategories: vi
      .fn<Catalog['listAllCategories']>()
      .mockImplementation(() => Promise.resolve([...categories])),
    createCategory: vi
      .fn<Catalog['createCategory']>()
      .mockImplementation((name) => Promise.resolve(testCategory({ id: 'c-nueva', name }))),
    renameCategory: vi
      .fn<Catalog['renameCategory']>()
      .mockImplementation((id, name) => Promise.resolve(testCategory({ id, name }))),
    deleteCategory: vi.fn<Catalog['deleteCategory']>().mockResolvedValue(undefined),
  };
}
