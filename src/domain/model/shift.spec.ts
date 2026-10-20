import { describe, expect, it } from 'vitest';
import { MAX_PESOS } from './money';
import {
  NO_SALES,
  closingBody,
  describeDifference,
  formatDifference,
  openingBody,
  parseCash,
  parseLocalShift,
  summarizeShift,
  type LocalShift,
} from './shift';

const OPENED: LocalShift = {
  shiftId: '5b0c8a7e-0000-4000-8000-000000000001',
  deviceId: '5b0c8a7e-0000-4000-8000-0000000000d1',
  openOperationId: '5b0c8a7e-0000-4000-8000-0000000000a1',
  openedAt: '2026-10-19T13:02:00.000Z',
  openingAmount: 50_000,
  sales: NO_SALES,
  closing: null,
};

const CLOSED: LocalShift = {
  ...OPENED,
  sales: { cashCount: 3, cashAmount: 120_000, otherCount: 2, otherAmount: 48_500 },
  closing: {
    operationId: '5b0c8a7e-0000-4000-8000-0000000000a2',
    closedAt: '2026-10-19T23:15:00.000Z',
    countedAmount: 168_000,
  },
};

describe('parseCash', () => {
  it.each([
    ['50000', 50_000],
    ['0', 0],
    ['  1200  ', 1_200],
    ['007', 7],
  ])('reads the cash %j', (text, value) => {
    expect(parseCash(text)).toEqual({ ok: true, value });
  });

  it('asks for the cash, and says an empty drawer is a zero', () => {
    expect(parseCash('')).toEqual({
      ok: false,
      message: 'Escribe el efectivo que hay en la caja. Si está vacía, escribe 0.',
    });
    expect(parseCash('   ')).toMatchObject({ ok: false });
  });

  it.each(['5o.000', '50.000', '50,5', '-3', '$ 50000', '1e3'])(
    'does not guess what %j means: only digits',
    (text) => {
      expect(parseCash(text)).toEqual({
        ok: false,
        message: 'Escribe el efectivo en pesos, solo con números.',
      });
    },
  );

  it('accepts up to the largest amount the system takes, and not a peso more', () => {
    expect(parseCash(String(MAX_PESOS))).toEqual({ ok: true, value: MAX_PESOS });
    expect(parseCash(String(MAX_PESOS + 1))).toEqual({
      ok: false,
      message: 'Ese monto es demasiado alto.',
    });
  });
});

describe('summarizeShift', () => {
  it('expects the opening cash plus what was sold in cash, and nothing else', () => {
    const summary = summarizeShift(CLOSED);

    expect(summary).toEqual({
      openingAmount: 50_000,
      cashCount: 3,
      cashAmount: 120_000,
      otherCount: 2,
      otherAmount: 48_500,
      expectedAmount: 170_000,
      countedAmount: 168_000,
      difference: -2_000,
    });
  });

  it('has no count and no difference while the shift is open', () => {
    expect(summarizeShift(OPENED)).toMatchObject({
      expectedAmount: 50_000,
      countedAmount: null,
      difference: null,
    });
  });

  it('says what is over as positive and what is missing as negative', () => {
    const over = { ...CLOSED, closing: { ...CLOSED.closing!, countedAmount: 171_500 } };
    expect(summarizeShift(over).difference).toBe(1_500);
    expect(
      summarizeShift({ ...over, closing: { ...over.closing, countedAmount: 170_000 } }).difference,
    ).toBe(0);
  });
});

describe('describeDifference', () => {
  it('says the drawer balances', () => {
    expect(describeDifference(0)).toEqual({ kind: 'balanced', title: 'La caja cuadra' });
  });

  it('says how much is missing, in pesos', () => {
    expect(describeDifference(-2_000)).toEqual({ kind: 'short', title: 'Faltan $ 2.000' });
  });

  it('says the small differences too: a drawer that is fifty pesos off does not balance', () => {
    expect(describeDifference(-50)).toEqual({ kind: 'short', title: 'Faltan $ 50' });
    expect(describeDifference(50)).toEqual({ kind: 'over', title: 'Sobran $ 50' });
  });

  it('says how much is over, in pesos', () => {
    expect(describeDifference(1_250)).toEqual({ kind: 'over', title: 'Sobran $ 1.250' });
  });
});

describe('formatDifference', () => {
  it('writes what is missing with a minus sign, what is over with a plus sign, and nothing as zero', () => {
    expect(formatDifference(-2_000)).toBe('− $ 2.000');
    expect(formatDifference(1_500)).toBe('+ $ 1.500');
    expect(formatDifference(0)).toBe('$ 0');
  });
});

describe('the bodies of the operations', () => {
  const at = new Date('2026-10-19T13:02:00.000Z');

  it('opens a shift with exactly what the individual route takes', () => {
    expect(
      openingBody({
        operationId: OPENED.openOperationId,
        shiftId: OPENED.shiftId,
        deviceId: OPENED.deviceId,
        openingAmount: 50_000,
        at,
        clockOffsetMs: 1_500,
      }),
    ).toEqual({
      operationId: OPENED.openOperationId,
      shiftId: OPENED.shiftId,
      deviceId: OPENED.deviceId,
      openingAmount: 50_000,
      deviceTime: '2026-10-19T13:02:00.000Z',
      clockOffsetMs: 1_500,
    });
  });

  it('closes a shift with exactly what the individual route takes: the shift goes beside, not inside', () => {
    expect(
      closingBody({
        operationId: CLOSED.closing!.operationId,
        countedAmount: 168_000,
        at,
        clockOffsetMs: null,
      }),
    ).toEqual({
      operationId: CLOSED.closing!.operationId,
      countedAmount: 168_000,
      deviceTime: '2026-10-19T13:02:00.000Z',
      clockOffsetMs: null,
    });
  });
});

describe('parseLocalShift', () => {
  it('reads what was saved, open or closed', () => {
    expect(parseLocalShift(JSON.parse(JSON.stringify(OPENED)))).toEqual(OPENED);
    expect(parseLocalShift(JSON.parse(JSON.stringify(CLOSED)))).toEqual(CLOSED);
  });

  it.each([
    ['nothing', null],
    ['a list', []],
    ['a text', 'turno'],
    ['no shift id', { ...OPENED, shiftId: undefined }],
    ['an empty shift id', { ...OPENED, shiftId: '' }],
    ['no device', { ...OPENED, deviceId: 3 }],
    ['no opening operation', { ...OPENED, openOperationId: null }],
    ['an hour that is not one', { ...OPENED, openedAt: 'ayer' }],
    ['an opening amount with decimals', { ...OPENED, openingAmount: 10.5 }],
    ['a negative opening amount', { ...OPENED, openingAmount: -1 }],
    ['an opening amount above the maximum', { ...OPENED, openingAmount: MAX_PESOS + 1 }],
    [
      'a sale amount above the maximum',
      { ...OPENED, sales: { ...NO_SALES, cashAmount: MAX_PESOS + 1 } },
    ],
    ['no sales', { ...OPENED, sales: undefined }],
    ['a sale count that is not a number', { ...OPENED, sales: { ...NO_SALES, cashCount: '3' } }],
    ['a negative sale amount', { ...OPENED, sales: { ...NO_SALES, otherAmount: -5 } }],
    [
      'a closing without its operation',
      { ...CLOSED, closing: { ...CLOSED.closing, operationId: '' } },
    ],
    ['a closing with a bad hour', { ...CLOSED, closing: { ...CLOSED.closing, closedAt: 'nunca' } }],
    ['a negative count', { ...CLOSED, closing: { ...CLOSED.closing, countedAmount: -1 } }],
    ['a closing that is not an object', { ...CLOSED, closing: 'cerrado' }],
  ])('does not take %s', (_name, value) => {
    expect(parseLocalShift(value)).toBeNull();
  });

  it('does not take a record with no closing field at all: it is not one this code wrote', () => {
    const { closing: _closing, ...withoutClosing } = OPENED;
    expect(parseLocalShift(withoutClosing)).toBeNull();
  });
});
