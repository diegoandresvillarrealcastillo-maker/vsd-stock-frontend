import { describe, expect, it } from 'vitest';
import {
  isReportMonth,
  monthLabel,
  monthOfBogota,
  parseMonthlyReport,
  rowLabel,
  shiftMonth,
} from './monthly-report';

const row = (taxKind: string, rateBp: number, total = 0, base = total, tax = 0) => ({
  taxKind,
  rateBp,
  total,
  base,
  tax,
});

const section = (change: Record<string, unknown> = {}) => ({
  count: 2,
  total: 14_650,
  base: 12_700,
  tax: 1_950,
  rows: [
    row('taxed', 1900, 11_900, 10_000, 1_900),
    row('taxed', 500, 1_050, 1_000, 50),
    row('exempt', 0, 700),
    row('excluded', 0, 1_000),
  ],
  payments: [
    { method: 'cash', amount: 1_050 },
    { method: 'card', amount: 12_600 },
    { method: 'transfer', amount: 1_000 },
  ],
  ...change,
});

const report = (change: Record<string, unknown> = {}) => ({
  month: '2026-10',
  from: '2026-10-01T05:00:00.000Z',
  to: '2026-11-01T05:00:00.000Z',
  sales: section(),
  voids: section({ count: 0, total: 0, base: 0, tax: 0 }),
  ...change,
});

describe('parseMonthlyReport', () => {
  it('reads the report the backend sends: the month, its limits, the sales and the voids', () => {
    const parsed = parseMonthlyReport(report());

    expect(parsed).not.toBeNull();
    expect(parsed?.month).toBe('2026-10');
    expect(parsed?.from).toEqual(new Date('2026-10-01T05:00:00.000Z'));
    expect(parsed?.to).toEqual(new Date('2026-11-01T05:00:00.000Z'));
    expect(parsed?.sales).toMatchObject({ count: 2, total: 14_650, base: 12_700, tax: 1_950 });
    expect(parsed?.sales.rows).toHaveLength(4);
    expect(parsed?.sales.rows[0]).toEqual(row('taxed', 1900, 11_900, 10_000, 1_900));
    expect(parsed?.sales.payments).toEqual([
      { method: 'cash', amount: 1_050 },
      { method: 'card', amount: 12_600 },
      { method: 'transfer', amount: 1_000 },
    ]);
    expect(parsed?.voids.count).toBe(0);
  });

  it('accepts a negative amount: nothing in the report promises it is positive', () => {
    const negative = section({ total: -5 });

    expect(parseMonthlyReport(report({ voids: negative }))?.voids.total).toBe(-5);
  });

  it.each([
    ['not an object', null],
    ['an array', []],
    ['a text', '2026-10'],
    ['a month that is not a month', report({ month: '2026-13' })],
    ['a month without its zero', report({ month: '2026-1' })],
    ['a date that is not a date', report({ from: 'ayer' })],
    ['a limit that is not a text', report({ to: 1 })],
    ['no sales', report({ sales: undefined })],
    ['no voids', report({ voids: null })],
    ['a count with decimals', report({ sales: section({ count: 1.5 }) })],
    ['a total that is a text', report({ sales: section({ total: '14650' }) })],
    ['a section with no rows', report({ sales: section({ rows: undefined }) })],
    ['a row of a kind that does not exist', report({ sales: section({ rows: [row('free', 0)] }) })],
    [
      'a row with an amount that is not a number',
      report({ sales: section({ rows: [row('exempt', 0, Number.NaN)] }) }),
    ],
    [
      'a row with a rate that is not a number',
      report({ sales: section({ rows: [{ ...row('exempt', 0), rateBp: '0' }] }) }),
    ],
    [
      'a payment of a method that does not exist',
      report({ sales: section({ payments: [{ method: 'barter', amount: 1 }] }) }),
    ],
    ['a payment without amount', report({ sales: section({ payments: [{ method: 'cash' }] }) })],
    ['a section whose rows are not a list', report({ sales: section({ rows: {} }) })],
    // Un campo roto a la vez: si el lector mirara solo uno de cada par, el otro se colaria.
    [
      'a row whose only broken amount is the total',
      report({ sales: section({ rows: [{ ...row('exempt', 0, 700), total: '700' }] }) }),
    ],
    [
      'a row whose only broken amount is the base',
      report({ sales: section({ rows: [{ ...row('exempt', 0, 700), base: 1.5 }] }) }),
    ],
    [
      'a row whose only broken amount is the tax',
      report({ sales: section({ rows: [{ ...row('exempt', 0, 700), tax: null }] }) }),
    ],
    ['a section whose only broken amount is the base', report({ sales: section({ base: 'x' }) })],
    ['a section whose only broken amount is the tax', report({ sales: section({ tax: 1.5 }) })],
    ['a section whose only broken amount is the total', report({ sales: section({ total: 1.5 }) })],
    ['a month that is a list that reads like one', report({ month: ['2026-10'] })],
    ['no month', report({ month: undefined })],
  ])('rejects %s', (_name, body) => {
    expect(parseMonthlyReport(body)).toBeNull();
  });

  it('does not trust a row that is not an object', () => {
    expect(parseMonthlyReport(report({ sales: section({ rows: [null] }) }))).toBeNull();
    expect(parseMonthlyReport(report({ sales: section({ payments: ['cash'] }) }))).toBeNull();
  });
});

describe('monthOfBogota', () => {
  it('says the month a Bogotá clock would say, not the UTC one', () => {
    // 31 de octubre, 23:30 en Bogota = 04:30 UTC del 1 de noviembre.
    expect(monthOfBogota(new Date('2026-11-01T04:30:00.000Z'))).toBe('2026-10');
    // 1 de noviembre, 00:30 en Bogota = 05:30 UTC.
    expect(monthOfBogota(new Date('2026-11-01T05:30:00.000Z'))).toBe('2026-11');
  });

  it('goes back to the previous year at New Year', () => {
    expect(monthOfBogota(new Date('2026-01-01T04:59:00.000Z'))).toBe('2025-12');
    expect(monthOfBogota(new Date('2026-01-01T05:00:00.000Z'))).toBe('2026-01');
  });

  it('writes the month with two digits', () => {
    expect(monthOfBogota(new Date('2026-03-15T12:00:00.000Z'))).toBe('2026-03');
  });
});

describe('isReportMonth', () => {
  it.each(['2026-10', '2026-01', '2026-12', '2000-01'])('accepts %s', (text) => {
    expect(isReportMonth(text)).toBe(true);
  });

  it.each(['', '2026-1', '2026-13', '2026-00', '1999-12', '2026-10-01', 'octubre', ' 2026-10'])(
    'rejects «%s»',
    (text) => {
      expect(isReportMonth(text)).toBe(false);
    },
  );
});

describe('shiftMonth', () => {
  it('goes back and forward one month at a time', () => {
    expect(shiftMonth('2026-10', -1)).toBe('2026-09');
    expect(shiftMonth('2026-10', 1)).toBe('2026-11');
  });

  it('crosses the year in both directions, keeping two digits', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-03', -2)).toBe('2026-01');
  });
});

describe('monthLabel', () => {
  it('writes the month as it is said', () => {
    expect(monthLabel('2026-10')).toBe('octubre de 2026');
    expect(monthLabel('2026-01')).toBe('enero de 2026');
    expect(monthLabel('2025-12')).toBe('diciembre de 2025');
  });
});

describe('rowLabel', () => {
  it('names the four rows of the declaration', () => {
    expect(rowLabel({ taxKind: 'taxed', rateBp: 1900 })).toBe('Gravado 19 %');
    expect(rowLabel({ taxKind: 'taxed', rateBp: 500 })).toBe('Gravado 5 %');
    expect(rowLabel({ taxKind: 'exempt', rateBp: 0 })).toBe('Exento');
    expect(rowLabel({ taxKind: 'excluded', rateBp: 0 })).toBe('Excluido');
  });
});
