import { vi, type Mock } from 'vitest';
import type { StockItem, StockMovement } from '../../src/domain/model/inventory';
import type { Inventory } from '../../src/domain/ports/in/inventory';
import { lastPage } from './catalog';

export function testStockItem(overrides: Partial<StockItem> = {}): StockItem {
  return {
    productId: 'p-1',
    name: 'Arroz 500 g',
    sku: 'ARR-500',
    unit: 'unit',
    active: true,
    quantityMilli: 6000,
    minStockMilli: null,
    belowMinimum: false,
    ...overrides,
  };
}

export function testMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'm-1',
    operationId: 'o-1',
    productId: 'p-1',
    kind: 'adjustment',
    deltaMilli: -2000,
    reason: 'Se cayeron dos paquetes',
    createdAt: new Date(2026, 9, 17, 15, 12),
    ...overrides,
  };
}

/** Cada metodo es un doble de Vitest: la prueba prepara lo que contesta y mira con que se le llamo. */
export type FakeInventory = { [K in keyof Inventory]: Mock<Inventory[K]> };

/** Existencias de mentira que por omision contestan bien: lo que se les da, un historial vacio y ajustes que salen bien. */
export function createFakeInventory(items: StockItem[] = [testStockItem()]): FakeInventory {
  return {
    listStock: vi
      .fn<Inventory['listStock']>()
      .mockImplementation(() => Promise.resolve(lastPage(items))),
    findStock: vi
      .fn<Inventory['findStock']>()
      .mockImplementation((productId) =>
        Promise.resolve(items.find((item) => item.productId === productId) ?? null),
      ),
    listMovements: vi
      .fn<Inventory['listMovements']>()
      .mockImplementation(() => Promise.resolve(lastPage([]))),
    adjust: vi.fn<Inventory['adjust']>().mockImplementation((input) =>
      Promise.resolve({
        movement: testMovement({
          operationId: input.operationId,
          productId: input.productId,
          deltaMilli: input.deltaMilli,
          reason: input.reason,
        }),
        replayed: false,
      }),
    ),
  };
}
