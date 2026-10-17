import { describe, expect, it } from 'vitest';
import {
  formatPesos,
  formatQuantity,
  parsePesos,
  parseQuantityMilli,
  quantityToInput,
} from './quantity';

describe('formatPesos', () => {
  it.each([
    [0, '$ 0'],
    [999, '$ 999'],
    [3200, '$ 3.200'],
    [12500, '$ 12.500'],
    [1_000_000, '$ 1.000.000'],
    [1_000_000_000_000, '$ 1.000.000.000.000'],
  ])('writes %i as «%s»', (amount, text) => {
    expect(formatPesos(amount)).toBe(text);
  });

  it('writes a negative amount with the sign before the symbol', () => {
    expect(formatPesos(-3200)).toBe('-$ 3.200');
  });
});

describe('formatQuantity', () => {
  it.each([
    [0, '0'],
    [10_000, '10'],
    [1_500, '1,5'],
    [250, '0,25'],
    [1, '0,001'],
    [1_234, '1,234'],
    [10_000_000, '10.000'],
    [12_345_678, '12.345,678'],
  ])('writes %i thousandths as «%s»', (milli, text) => {
    expect(formatQuantity(milli)).toBe(text);
  });

  it('writes a negative quantity with its sign', () => {
    expect(formatQuantity(-2_500)).toBe('-2,5');
  });
});

describe('quantityToInput', () => {
  it.each([
    [0, '0'],
    [10_000, '10'],
    [1_500, '1,5'],
    [10_000_000, '10000'],
    [12_345_678, '12345,678'],
  ])('writes %i thousandths as «%s», in a form parseQuantityMilli reads back', (milli, text) => {
    expect(quantityToInput(milli)).toBe(text);
    expect(parseQuantityMilli(text, { whole: false })).toEqual({ ok: true, value: milli });
  });
});

describe('parsePesos', () => {
  it.each([
    ['3200', 3200],
    ['0', 0],
    ['  450 ', 450],
    ['1000000000000', 1_000_000_000_000],
  ])('reads «%s» as %i pesos', (text, amount) => {
    expect(parsePesos(text)).toEqual({ ok: true, value: amount });
  });

  it('asks for a price when there is nothing written', () => {
    expect(parsePesos('   ')).toEqual({ ok: false, message: 'Escribe el precio.' });
  });

  it.each(['3.200', '3,200', '3200,50', '$3200', '3 200'])(
    'does not guess what «%s» means: only digits, no separators',
    (text) => {
      expect(parsePesos(text)).toEqual({
        ok: false,
        message: 'Escribe solo números, sin puntos, comas ni símbolos. Por ejemplo: 3200.',
      });
    },
  );

  it('rejects a price above what the system accepts', () => {
    expect(parsePesos('1000000000001')).toEqual({
      ok: false,
      message: 'Ese precio es demasiado alto.',
    });
  });
});

describe('parseQuantityMilli', () => {
  it.each([
    ['10', 10_000],
    ['0', 0],
    ['1,5', 1_500],
    ['0,25', 250],
    ['2,125', 2_125],
    ['  7 ', 7_000],
    ['1000000', 1_000_000_000],
  ])('reads «%s» as %i thousandths', (text, milli) => {
    expect(parseQuantityMilli(text, { whole: false })).toEqual({ ok: true, value: milli });
  });

  it('asks for a quantity when there is nothing written', () => {
    expect(parseQuantityMilli('', { whole: false })).toEqual({
      ok: false,
      message: 'Escribe la cantidad.',
    });
  });

  it('does not guess whether «1.500» is one and a half or one thousand five hundred', () => {
    expect(parseQuantityMilli('1.500', { whole: false })).toEqual({
      ok: false,
      message: 'Para los decimales usa coma y no escribas puntos de miles. Por ejemplo: 1,5.',
    });
  });

  it.each(['abc', '1,', ',5', '1,2,3', '-3', '1e3', '1 000'])('rejects «%s»', (text) => {
    expect(parseQuantityMilli(text, { whole: false })).toEqual({
      ok: false,
      message: 'Escribe solo números, con coma para los decimales. Por ejemplo: 1,5.',
    });
  });

  it('accepts at most three decimals', () => {
    expect(parseQuantityMilli('1,2345', { whole: false })).toEqual({
      ok: false,
      message: 'Se aceptan hasta tres decimales.',
    });
  });

  it('rejects a fraction for what is counted in whole units, but accepts an exact whole number written with decimals', () => {
    expect(parseQuantityMilli('2,5', { whole: true })).toEqual({
      ok: false,
      message: 'Este producto se cuenta por unidades enteras.',
    });
    expect(parseQuantityMilli('2,000', { whole: true })).toEqual({ ok: true, value: 2_000 });
  });

  it('rejects more than the system accepts', () => {
    expect(parseQuantityMilli('1000000,001', { whole: false })).toEqual({
      ok: false,
      message: 'Esa cantidad es demasiado alta.',
    });
  });
});
