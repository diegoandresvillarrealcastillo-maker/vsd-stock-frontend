import { SellingUseCase } from '../../src/application/usecases/selling.usecase';
import type { Product } from '../../src/domain/model/catalog';
import type { IdGenerator } from '../../src/domain/ports/out/id-generator';
import { createTestShifts, type TestShifts } from './fake-shifts';
import { FakeReadCopy } from './read-copy';

/** Identificadores de las ventas, que se reconocen a simple vista: `b0000000-...-000000000001`. */
export class SaleIds implements IdGenerator {
  private counter = 0;

  newId(): string {
    this.counter += 1;
    return saleId(this.counter);
  }
}

export const saleId = (n: number): string =>
  `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Un producto de la copia, con precio y tarifa a gusto. */
export function item(n: number, change: Partial<Product> = {}): Product {
  return {
    id: `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `Producto ${String(n)}`,
    sku: `SKU-${String(n)}`,
    barcode: null,
    unit: 'unit',
    unitPrice: 3_200,
    taxRateBp: 0,
    taxKind: 'exempt',
    active: true,
    categoryId: null,
    minStockMilli: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...change,
  };
}

export interface TestSelling extends TestShifts {
  readonly selling: SellingUseCase;
  readonly copy: FakeReadCopy;
}

/**
 * El caso de uso real de la venta, sobre el espacio de trabajo local real (bases en memoria), el turno real, el motor de envio y la
 * copia de mentira. Por omision trabaja una persona con el dispositivo registrado y un turno abierto con 50.000 en la caja.
 */
export async function createTestSelling(
  options: { working?: boolean; registered?: boolean; shift?: 'open' | 'none' } = {},
): Promise<TestSelling> {
  const base = await createTestShifts({
    ...(options.working === undefined ? {} : { working: options.working }),
    ...(options.registered === undefined ? {} : { registered: options.registered }),
  });
  const copy = new FakeReadCopy();
  const selling = new SellingUseCase({
    workspace: base.local.workspace,
    clock: base.clock,
    ids: new SaleIds(),
    sync: base.sync,
    shifts: base.shifts,
    copy,
  });
  if (options.working !== false && options.registered !== false && options.shift !== 'none') {
    base.shifts.start();
    await base.shifts.open(50_000);
  }
  return { ...base, selling, copy };
}
