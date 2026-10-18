import {
  parseCategory,
  parseProduct,
  type Category,
  type Product,
} from '../../domain/model/catalog';
import { parsePage, type Page } from '../../domain/model/page';
import type {
  Catalog,
  NewProduct,
  ProductChange,
  ProductFilter,
} from '../../domain/ports/in/catalog';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';
import { unexpectedAnswer } from './unexpected-answer';

/** Cuantos se piden por pagina, y cuantas paginas se leen como maximo para «todas» (un negocio de barrio tiene pocas). */
const PAGE_SIZE = 50;
const ALL_PAGE_SIZE = 200;
const MAX_ALL_PAGES = 10;

/** El GTIN de 12 digitos y el de 13 que le antepone un cero son el mismo codigo: se comparan sin ceros a la izquierda. */
function withoutLeadingZeros(code: string): string {
  return code.replace(/^0+/, '');
}

/** Catalogo del negocio (ADR 0015) sobre la API. */
export class CatalogUseCase implements Catalog {
  constructor(private readonly api: ApiGateway) {}

  async listProducts(filter: ProductFilter, cursor?: string): Promise<Page<Product>> {
    const search = filter.search?.trim() ?? '';
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/products',
      query: {
        limit: PAGE_SIZE,
        ...(search === '' ? {} : { search }),
        ...(filter.active === undefined ? {} : { active: filter.active }),
        ...(filter.categoryId === undefined ? {} : { categoryId: filter.categoryId }),
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    const page = parsePage(response.body, parseProduct);
    if (page === null) throw unexpectedAnswer(response.status);
    return page;
  }

  async getProduct(productId: string): Promise<Product> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: `/v1/products/${encodeURIComponent(productId)}`,
    });
    return this.productOf(response.body, response.status);
  }

  async createProduct(input: NewProduct): Promise<Product> {
    const barcode = input.barcode?.trim() ?? '';
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/products',
      body: {
        name: input.name.trim(),
        sku: input.sku.trim(),
        ...(barcode === '' ? {} : { barcode }),
        unit: input.unit,
        unitPrice: input.unitPrice,
        taxRateBp: input.taxRateBp,
        ...(input.categoryId == null ? {} : { categoryId: input.categoryId }),
        ...(input.minStockMilli == null ? {} : { minStockMilli: input.minStockMilli }),
      },
    });
    return this.productOf(response.body, response.status);
  }

  async updateProduct(productId: string, change: ProductChange): Promise<Product> {
    const response = await this.api.send<unknown>({
      method: 'PATCH',
      path: `/v1/products/${encodeURIComponent(productId)}`,
      body: {
        ...(change.name === undefined ? {} : { name: change.name.trim() }),
        ...(change.sku === undefined ? {} : { sku: change.sku.trim() }),
        ...(change.barcode === undefined
          ? {}
          : { barcode: change.barcode === null ? null : change.barcode.trim() }),
        ...(change.unit === undefined ? {} : { unit: change.unit }),
        ...(change.unitPrice === undefined ? {} : { unitPrice: change.unitPrice }),
        ...(change.taxRateBp === undefined ? {} : { taxRateBp: change.taxRateBp }),
        ...(change.categoryId === undefined ? {} : { categoryId: change.categoryId }),
        ...(change.minStockMilli === undefined ? {} : { minStockMilli: change.minStockMilli }),
        ...(change.active === undefined ? {} : { active: change.active }),
      },
    });
    return this.productOf(response.body, response.status);
  }

  async findProductByCode(field: 'sku' | 'barcode', code: string): Promise<Product | null> {
    const wanted = code.trim();
    if (wanted === '') return null;
    const page = await this.listProducts({ search: wanted });
    const match = (product: Product): boolean => {
      if (field === 'sku') return product.sku.toLowerCase() === wanted.toLowerCase();
      return (
        product.barcode !== null &&
        withoutLeadingZeros(product.barcode) === withoutLeadingZeros(wanted)
      );
    };
    return page.items.find(match) ?? null;
  }

  async listCategories(cursor?: string): Promise<Page<Category>> {
    return this.readCategories(PAGE_SIZE, cursor);
  }

  async listAllCategories(): Promise<Category[]> {
    const all: Category[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < MAX_ALL_PAGES; pages += 1) {
      const page = await this.readCategories(ALL_PAGE_SIZE, cursor);
      all.push(...page.items);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    return all;
  }

  async createCategory(name: string): Promise<Category> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/categories',
      body: { name: name.trim() },
    });
    return this.categoryOf(response.body, response.status);
  }

  async renameCategory(categoryId: string, name: string): Promise<Category> {
    const response = await this.api.send<unknown>({
      method: 'PATCH',
      path: `/v1/categories/${encodeURIComponent(categoryId)}`,
      body: { name: name.trim() },
    });
    return this.categoryOf(response.body, response.status);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.api.send<unknown>({
      method: 'DELETE',
      path: `/v1/categories/${encodeURIComponent(categoryId)}`,
    });
  }

  private async readCategories(limit: number, cursor: string | undefined): Promise<Page<Category>> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/categories',
      query: { limit, ...(cursor === undefined ? {} : { cursor }) },
    });
    const page = parsePage(response.body, parseCategory);
    if (page === null) throw unexpectedAnswer(response.status);
    return page;
  }

  private productOf(body: unknown, status: number): Product {
    const product = parseProduct(body);
    if (product === null) throw unexpectedAnswer(status);
    return product;
  }

  private categoryOf(body: unknown, status: number): Category {
    const category = parseCategory(body);
    if (category === null) throw unexpectedAnswer(status);
    return category;
  }
}
