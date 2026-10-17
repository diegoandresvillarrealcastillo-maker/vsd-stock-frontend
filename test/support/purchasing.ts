import { vi, type Mock } from 'vitest';
import type { Purchase, PurchaseSummary, Supplier } from '../../src/domain/model/purchasing';
import type { Purchasing } from '../../src/domain/ports/in/purchasing';
import { lastPage } from './catalog';

export function testSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: 's-1',
    name: 'Distribuidora El Sol',
    contact: '300 123 4567',
    createdAt: new Date('2026-10-17T12:00:00.000Z'),
    ...overrides,
  };
}

export function testPurchaseSummary(overrides: Partial<PurchaseSummary> = {}): PurchaseSummary {
  return {
    id: 'c-1',
    operationId: 'o-1',
    warehouseId: 'w-1',
    supplierId: 's-1',
    note: 'Pedido de octubre',
    createdAt: new Date(2026, 9, 17, 11, 2),
    createdByUserId: 'u-1',
    lineCount: 3,
    ...overrides,
  };
}

export function testPurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: 'c-1',
    operationId: 'o-1',
    warehouseId: 'w-1',
    supplierId: 's-1',
    note: null,
    createdAt: new Date(2026, 9, 17, 11, 2),
    createdByUserId: 'u-1',
    lines: [{ productId: 'p-1', quantityMilli: 24_000, unitCost: 2500 }],
    ...overrides,
  };
}

/** Cada metodo es un doble de Vitest: la prueba prepara lo que contesta y mira con que se le llamo. */
export type FakePurchasing = { [K in keyof Purchasing]: Mock<Purchasing[K]> };

/** Proveedores y compras de mentira que por omision contestan bien. */
export function createFakePurchasing(
  suppliers: Supplier[] = [testSupplier()],
  purchases: PurchaseSummary[] = [testPurchaseSummary()],
): FakePurchasing {
  return {
    listAllSuppliers: vi
      .fn<Purchasing['listAllSuppliers']>()
      .mockImplementation(() => Promise.resolve([...suppliers])),
    createSupplier: vi
      .fn<Purchasing['createSupplier']>()
      .mockImplementation((input) =>
        Promise.resolve(
          testSupplier({ id: 's-nuevo', name: input.name, contact: input.contact ?? null }),
        ),
      ),
    updateSupplier: vi.fn<Purchasing['updateSupplier']>().mockImplementation((id, change) =>
      Promise.resolve(
        testSupplier({
          ...(suppliers.find((supplier) => supplier.id === id) ?? { id }),
          ...(change.name === undefined ? {} : { name: change.name }),
          ...(change.contact === undefined ? {} : { contact: change.contact }),
        }),
      ),
    ),
    deleteSupplier: vi.fn<Purchasing['deleteSupplier']>().mockResolvedValue(undefined),
    listPurchases: vi
      .fn<Purchasing['listPurchases']>()
      .mockImplementation(() => Promise.resolve(lastPage(purchases))),
    createPurchase: vi.fn<Purchasing['createPurchase']>().mockImplementation((input) =>
      Promise.resolve({
        purchase: testPurchase({
          operationId: input.operationId,
          supplierId: input.supplierId ?? null,
          note: input.note ?? null,
          lines: [...input.lines],
        }),
        replayed: false,
      }),
    ),
  };
}
