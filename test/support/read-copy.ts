import type { Product } from '../../src/domain/model/catalog';
import { searchProducts, type SearchOptions } from '../../src/domain/model/product-search';
import type { CopyState, ReadCopy } from '../../src/domain/ports/in/read-copy';

/** El estado de una copia que no tiene nada que decir: nada guardado, nada pasando. */
export const NO_COPY: CopyState = {
  status: 'empty',
  productCount: 0,
  productsAsOf: null,
  stockAsOf: null,
  downloading: false,
  fault: null,
};

/**
 * La copia de lectura de mentira para las pruebas de la interfaz: dice lo que la prueba le manda decir, busca en los productos
 * que se le den y cuenta lo que le piden. El caso de uso real se prueba aparte, con sus propios dobles (`fake-copy.ts`).
 */
export class FakeReadCopy implements ReadCopy {
  starts = 0;
  stops = 0;
  refreshes = 0;
  private state: CopyState;
  private readonly listeners = new Set<() => void>();
  private readonly levels = new Map<string, number>();

  constructor(
    state: Partial<CopyState> = {},
    private products: readonly Product[] = [],
  ) {
    this.state = { ...NO_COPY, ...state };
  }

  current(): CopyState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }

  refresh(): Promise<void> {
    this.refreshes += 1;
    return Promise.resolve();
  }

  search(query: string, options?: SearchOptions): readonly Product[] {
    return searchProducts(this.products, query, options);
  }

  product(productId: string): Product | undefined {
    return this.products.find((product) => product.id === productId);
  }

  stockOf(productId: string): number | null {
    return this.levels.get(productId) ?? null;
  }

  readonly soldItems: { productId: string; quantityMilli: number }[][] = [];

  sold(items: readonly { productId: string; quantityMilli: number }[]): Promise<void> {
    this.soldItems.push([...items]);
    for (const { productId, quantityMilli } of items) {
      const left = this.levels.get(productId);
      if (left !== undefined) this.levels.set(productId, left - quantityMilli);
    }
    return Promise.resolve();
  }

  /** La copia tiene estos productos y esta existencia. */
  hold(products: readonly Product[], levels: Record<string, number> = {}): void {
    this.products = products;
    this.levels.clear();
    for (const [productId, quantity] of Object.entries(levels))
      this.levels.set(productId, quantity);
  }

  /** La copia cambia: la interfaz se entera como se enteraria de la real. El estado nuevo es otro objeto. */
  set(change: Partial<CopyState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of [...this.listeners]) listener();
  }

  get subscribers(): number {
    return this.listeners.size;
  }
}
