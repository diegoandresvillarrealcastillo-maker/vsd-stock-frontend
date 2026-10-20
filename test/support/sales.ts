import { vi, type Mock } from 'vitest';
import type { SaleDetail, SaleRecord } from '../../src/domain/model/sales-history';
import type { SalesHistory } from '../../src/domain/ports/in/sales-history';
import { lastPage } from './catalog';

/** Una venta de la lista, la de Ana de las 3:10 p. m. (en la hora del equipo: las pruebas la dicen igual en cualquier zona). */
export function testSaleRecord(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    id: 'sale-1',
    operationId: 'op-1',
    shiftId: 'shift-1',
    deviceId: 'device-1',
    userId: 'u-ana',
    folio: 'AA-000141',
    folioReported: 'AA-000141',
    folioConflict: false,
    total: 14_800,
    needsAdjustment: false,
    flags: [],
    timeFlags: [],
    occurredAt: new Date(2026, 9, 19, 15, 10),
    receivedAt: new Date(2026, 9, 19, 15, 10, 20),
    review: null,
    voided: null,
    attention: false,
    ...overrides,
  };
}

/** Una venta completa: 2 arroz y 3 panes, pagados en efectivo, con el IVA del 19 % incluido. */
export function testSaleDetail(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    ...testSaleRecord(),
    lines: [
      {
        productId: 'p-arroz',
        quantityMilli: 2_000,
        unitPrice: 3_200,
        discount: 0,
        taxRateBp: 1_900,
      },
      { productId: 'p-pan', quantityMilli: 3_000, unitPrice: 2_800, discount: 0, taxRateBp: 1_900 },
    ],
    payments: [{ method: 'cash', amount: 14_800, reference: null }],
    summary: {
      total: 14_800,
      base: 12_437,
      tax: 2_363,
      byRate: [{ rateBp: 1_900, total: 14_800, base: 12_437, tax: 2_363 }],
    },
    ...overrides,
  };
}

/** Cada metodo es un doble de Vitest: la prueba prepara lo que contesta y mira con que se le llamo. */
export type FakeSalesHistory = { [K in keyof SalesHistory]: Mock<SalesHistory[K]> };

/** Las ventas de mentira, que por omision contestan bien: la lista da lo que se le pase, el detalle es el de siempre. */
export function createFakeSalesHistory(
  records: SaleRecord[] = [testSaleRecord()],
): FakeSalesHistory {
  return {
    list: vi
      .fn<SalesHistory['list']>()
      .mockImplementation(() => Promise.resolve(lastPage(records))),
    get: vi.fn<SalesHistory['get']>().mockImplementation((saleId) => {
      const record = records.find((sale) => sale.id === saleId) ?? testSaleRecord({ id: saleId });
      return Promise.resolve(testSaleDetail(record));
    }),
    voidSale: vi.fn<SalesHistory['voidSale']>().mockImplementation((saleId, input) =>
      Promise.resolve({
        sale: testSaleDetail({
          id: saleId,
          attention: false,
          voided: {
            voidedAt: new Date(2026, 9, 19, 16, 20),
            voidedByUserId: 'u-ana',
            operationId: input.operationId,
            reason: input.reason,
          },
        }),
        replayed: false,
      }),
    ),
    review: vi.fn<SalesHistory['review']>().mockImplementation((_saleId, note) =>
      Promise.resolve({
        reviewedAt: new Date(2026, 9, 19, 16, 0),
        reviewedByUserId: 'u-ana',
        note,
      }),
    ),
    attentionCount: vi
      .fn<SalesHistory['attentionCount']>()
      .mockResolvedValue({ count: 0, more: false }),
  };
}
