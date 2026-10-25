import { vi, type Mock } from 'vitest';
import type {
  MonthlyReport,
  ReportRow,
  ReportSection,
} from '../../src/domain/model/monthly-report';
import type { Reports } from '../../src/domain/ports/in/reports';

const NO_ROWS: ReportRow[] = [
  { taxKind: 'taxed', rateBp: 1900, total: 0, base: 0, tax: 0 },
  { taxKind: 'taxed', rateBp: 500, total: 0, base: 0, tax: 0 },
  { taxKind: 'exempt', rateBp: 0, total: 0, base: 0, tax: 0 },
  { taxKind: 'excluded', rateBp: 0, total: 0, base: 0, tax: 0 },
];

/** Una seccion sin ventas: los cuatro renglones y los tres medios, en cero. */
export function emptySection(): ReportSection {
  return {
    count: 0,
    total: 0,
    base: 0,
    tax: 0,
    rows: NO_ROWS,
    payments: [
      { method: 'cash', amount: 0 },
      { method: 'card', amount: 0 },
      { method: 'transfer', amount: 0 },
    ],
  };
}

/** Dos ventas de octubre: un gravado al 19 %, otro al 5 %, un exento y un excluido, pagados en efectivo, con tarjeta y por transferencia. */
export function testSection(overrides: Partial<ReportSection> = {}): ReportSection {
  return {
    count: 2,
    total: 14_650,
    base: 12_700,
    tax: 1_950,
    rows: [
      { taxKind: 'taxed', rateBp: 1900, total: 11_900, base: 10_000, tax: 1_900 },
      { taxKind: 'taxed', rateBp: 500, total: 1_050, base: 1_000, tax: 50 },
      { taxKind: 'exempt', rateBp: 0, total: 700, base: 700, tax: 0 },
      { taxKind: 'excluded', rateBp: 0, total: 1_000, base: 1_000, tax: 0 },
    ],
    payments: [
      { method: 'cash', amount: 1_050 },
      { method: 'card', amount: 12_600 },
      { method: 'transfer', amount: 1_000 },
    ],
    ...overrides,
  };
}

/** El reporte de un mes; por omision, el de octubre de 2026 con ventas y sin anulaciones. */
export function testReport(overrides: Partial<MonthlyReport> = {}): MonthlyReport {
  return {
    month: '2026-10',
    from: new Date('2026-10-01T05:00:00.000Z'),
    to: new Date('2026-11-01T05:00:00.000Z'),
    sales: testSection(),
    voids: emptySection(),
    ...overrides,
  };
}

/** Cada metodo es un doble de Vitest: la prueba prepara lo que contesta y mira con que se le llamo. */
export type FakeReports = { [K in keyof Reports]: Mock<Reports[K]> };

/** Un reporte de mentira que contesta el mes que se le pida, con las ventas de `testReport`. */
export function createFakeReports(report: Partial<MonthlyReport> = {}): FakeReports {
  return {
    monthly: vi
      .fn<Reports['monthly']>()
      .mockImplementation((month) => Promise.resolve(testReport({ ...report, month }))),
  };
}
