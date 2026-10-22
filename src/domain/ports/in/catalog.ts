import type { Category, Product, UnitCode } from '../../model/catalog';
import type { Page } from '../../model/page';

export interface ProductFilter {
  /** Nombre, SKU o codigo de barras. */
  search?: string;
  /** `true` solo los activos, `false` solo los archivados; sin esto, todos. */
  active?: boolean;
  categoryId?: string;
}

export interface NewProduct {
  name: string;
  sku: string;
  barcode?: string | null;
  unit: UnitCode;
  /** Pesos enteros, con el IVA incluido. */
  unitPrice: number;
  /** 0, 500 o 1900. */
  taxRateBp: number;
  categoryId?: string | null;
  minStockMilli?: number | null;
}

/** Solo se manda lo que cambia. `null` borra el codigo de barras, la categoria o el minimo. */
export interface ProductChange {
  name?: string;
  sku?: string;
  barcode?: string | null;
  unit?: UnitCode;
  unitPrice?: number;
  taxRateBp?: number;
  categoryId?: string | null;
  minStockMilli?: number | null;
  /** `false` archiva el producto; `true` lo reactiva. */
  active?: boolean;
}

/**
 * Puerto de entrada: el catalogo del negocio (ADR 0015). Todo fallo es un `ApiError` con su clase (ADR 0009); la interfaz decide
 * el mensaje por la clase y por el `code` (`sku-taken`, `barcode-taken`, `unit-locked`, `category-in-use`…).
 */
export interface Catalog {
  /** Una pagina de productos, por nombre. */
  listProducts(filter: ProductFilter, cursor?: string): Promise<Page<Product>>;
  getProduct(productId: string): Promise<Product>;
  createProduct(input: NewProduct): Promise<Product>;
  updateProduct(productId: string, change: ProductChange): Promise<Product>;
  /**
   * Quien tiene ese SKU o ese codigo de barras, para decirselo a la persona cuando el servidor dice que ya esta tomado. `null`
   * si nadie lo tiene exactamente igual (o no se puede saber).
   */
  findProductByCode(field: 'sku' | 'barcode', code: string): Promise<Product | null>;
  listCategories(cursor?: string): Promise<Page<Category>>;
  /** Todas las categorias (un negocio de barrio tiene pocas), con un tope de paginas. */
  listAllCategories(): Promise<Category[]>;
  createCategory(name: string): Promise<Category>;
  renameCategory(categoryId: string, name: string): Promise<Category>;
  /** Solo una categoria sin productos se borra; si no, `category-in-use`. */
  deleteCategory(categoryId: string): Promise<void>;
}
