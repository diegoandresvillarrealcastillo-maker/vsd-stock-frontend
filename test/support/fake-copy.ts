import type { ApiError } from '../../src/domain/model/api-error';
import type { Product } from '../../src/domain/model/catalog';
import type { CopyPage, StockLevel } from '../../src/domain/model/read-copy';
import type { CopyRequest, ReadCopyApi } from '../../src/domain/ports/out/read-copy-api';
import { ReadCopyUseCase } from '../../src/application/usecases/read-copy.usecase';
import { testMe } from './auth';
import { FakeConnection, MutableClock } from './fake-sync';
import { createTestLocal, type TestLocal } from './local';
import { FakeSyncEngine } from './sync-engine';

// Dobles en memoria de lo que rodea a la copia de lectura: el servidor, la conexion y el reloj. El caso de uso y el espacio de
// trabajo local son los REALES; todo lo demas se controla a mano.

type Answer<T> = CopyPage<T> | ApiError | Error | Promise<CopyPage<T> | ApiError | Error>;
type Step<T> = (request: CopyRequest) => Answer<T>;

/** El servidor de mentira de la copia: responde lo que se programe, una pagina por peticion, y anota lo que se le pidio. */
export class FakeReadCopyApi implements ReadCopyApi {
  readonly productCalls: CopyRequest[] = [];
  readonly stockCalls: CopyRequest[] = [];
  private readonly productPlan: Step<Product>[] = [];
  private readonly stockPlan: Step<StockLevel>[] = [];

  constructor(private readonly clock: MutableClock) {}

  /** Programa las paginas de productos que contesta, una por peticion. */
  serveProducts(...pages: (CopyPage<Product> | Step<Product>)[]): this {
    for (const page of pages) this.productPlan.push(typeof page === 'function' ? page : () => page);
    return this;
  }

  /** Programa las paginas de existencias que contesta, una por peticion. */
  serveStock(...pages: (CopyPage<StockLevel> | Step<StockLevel>)[]): this {
    for (const page of pages) this.stockPlan.push(typeof page === 'function' ? page : () => page);
    return this;
  }

  async products(request: CopyRequest): Promise<CopyPage<Product>> {
    this.productCalls.push(request);
    return await this.answer(this.productPlan.shift(), request);
  }

  async stock(request: CopyRequest): Promise<CopyPage<StockLevel>> {
    this.stockCalls.push(request);
    return await this.answer(this.stockPlan.shift(), request);
  }

  private async answer<T>(step: Step<T> | undefined, request: CopyRequest): Promise<CopyPage<T>> {
    const answer = await step?.(request);
    if (answer === undefined) return { asOf: this.clock.now(), items: [], nextCursor: null };
    if (answer instanceof Error) throw answer;
    return answer;
  }
}

/** Un producto del catalogo, con un identificador y un nombre que dependen de `n`. */
export function copiedProduct(n: number, change: Partial<Product> = {}): Product {
  return {
    id: `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `Producto ${String(n)}`,
    sku: `SKU-${String(n)}`,
    barcode: null,
    unit: 'unit',
    unitPrice: 1_000,
    taxRateBp: 0,
    active: true,
    categoryId: null,
    minStockMilli: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-18T10:00:00.000Z'),
    ...change,
  };
}

export const page = <T>(items: T[], asOf: Date, nextCursor: string | null = null): CopyPage<T> => ({
  asOf,
  items,
  nextCursor,
});

export const stockOfProduct = (n: number, quantityMilli: number): StockLevel => ({
  productId: copiedProduct(n).id,
  quantityMilli,
});

export interface TestCopy {
  readonly copy: ReadCopyUseCase;
  readonly api: FakeReadCopyApi;
  readonly connection: FakeConnection;
  readonly sync: FakeSyncEngine;
  readonly clock: MutableClock;
  readonly local: TestLocal;
}

/** El caso de uso real de la copia, con su espacio de trabajo local real (bases en memoria) y una persona trabajando. */
export async function createTestCopy(
  options: { status?: 'online' | 'offline' | 'checking'; working?: boolean } = {},
): Promise<TestCopy> {
  const clock = new MutableClock(new Date('2026-10-19T12:00:00.000Z'));
  const local = createTestLocal(clock.now());
  if (options.working !== false) await local.workspace.begin(testMe('ana', 'cashier'));
  const api = new FakeReadCopyApi(clock);
  const connection = new FakeConnection(options.status ?? 'online');
  const sync = new FakeSyncEngine();
  const copy = new ReadCopyUseCase({ workspace: local.workspace, api, connection, sync });
  return { copy, api, connection, sync, clock, local };
}
