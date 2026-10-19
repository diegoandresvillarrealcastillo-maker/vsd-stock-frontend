import { describe, expect, it } from 'vitest';
import { MAX_PESOS } from './money';
import {
  MAX_REFERENCE_LENGTH,
  PAYMENT_METHODS,
  changeOf,
  methodLabel,
  parseReceived,
  parseReference,
  quickAmounts,
} from './sale-payment';

describe('the ways to pay', () => {
  it('are cash, card and transfer, in that order, with their names', () => {
    expect(PAYMENT_METHODS).toEqual([
      { method: 'cash', label: 'Efectivo' },
      { method: 'card', label: 'Tarjeta' },
      { method: 'transfer', label: 'Transferencia' },
    ]);
    expect(methodLabel('card')).toBe('Tarjeta');
  });
});

describe('the cash that a customer hands over', () => {
  it('gives back what is over the total, and nothing when it is exact or short', () => {
    expect(changeOf(26_800, 30_000)).toBe(3_200);
    expect(changeOf(26_800, 26_800)).toBe(0);
    expect(changeOf(26_800, 20_000)).toBe(0);
  });

  describe('as it is written', () => {
    it('is the pesos, when they cover the total', () => {
      expect(parseReceived('30000', 26_800)).toEqual({ ok: true, value: 30_000 });
      expect(parseReceived(' 26800 ', 26_800)).toEqual({ ok: true, value: 26_800 });
    });

    it('asks for it when it is empty', () => {
      expect(parseReceived('', 26_800)).toEqual({
        ok: false,
        message: 'Escribe el efectivo que te entregan.',
      });
    });

    it.each(['25.000', '25,5', '$ 30000', '-1', '3e4'])(
      'does not guess what %j means: only digits',
      (text) => {
        expect(parseReceived(text, 26_800)).toEqual({
          ok: false,
          message: 'Escribe el efectivo en pesos, solo con números.',
        });
      },
    );

    it('says how much is missing to reach the total', () => {
      expect(parseReceived('25000', 26_800)).toEqual({
        ok: false,
        message: 'Faltan $ 1.800 para completar el total.',
      });
      expect(parseReceived('0', 26_800)).toEqual({
        ok: false,
        message: 'Faltan $ 26.800 para completar el total.',
      });
    });

    it('takes zero for a sale that costs nothing', () => {
      expect(parseReceived('0', 0)).toEqual({ ok: true, value: 0 });
    });

    it('takes the most the system can hold, and not a peso more', () => {
      expect(parseReceived(String(MAX_PESOS), 26_800)).toEqual({ ok: true, value: MAX_PESOS });
    });

    it('does not take more than the system can hold', () => {
      expect(parseReceived(String(MAX_PESOS + 1), 26_800)).toEqual({
        ok: false,
        message: 'Ese monto es demasiado alto.',
      });
    });
  });

  describe('the amounts offered to touch', () => {
    it('are the next round amounts above the total, without repeating, as many as two', () => {
      expect(quickAmounts(26_800)).toEqual([30_000, 50_000]);
    });

    it('go up by what a bill is: five thousand, ten thousand, fifty thousand and a hundred thousand', () => {
      expect(quickAmounts(3_200)).toEqual([5_000, 10_000]);
      expect(quickAmounts(12_500)).toEqual([15_000, 20_000]);
      expect(quickAmounts(47_000)).toEqual([50_000, 100_000]);
    });

    it('do not offer the total itself: that is what «exact» is for', () => {
      expect(quickAmounts(30_000)).toEqual([35_000, 40_000]);
    });

    it('offer fewer when the round amounts are the same one, or for a sale of nothing', () => {
      expect(quickAmounts(95_000)).toEqual([100_000]);
      expect(quickAmounts(0)).toEqual([5_000, 10_000]);
    });
  });
});

describe('the reference of a payment that is not cash', () => {
  it('is nothing when it is left empty', () => {
    expect(parseReference('')).toEqual({ ok: true, value: null });
    expect(parseReference('   ')).toEqual({ ok: true, value: null });
  });

  it('is what was written, without the spaces around it', () => {
    expect(parseReference('  Nequi 3104455 ')).toEqual({ ok: true, value: 'Nequi 3104455' });
  });

  it('is not longer than the server accepts', () => {
    expect(parseReference('x'.repeat(MAX_REFERENCE_LENGTH))).toMatchObject({ ok: true });
    expect(parseReference('x'.repeat(MAX_REFERENCE_LENGTH + 1))).toEqual({
      ok: false,
      message: 'La referencia es muy larga: 100 letras como máximo.',
    });
  });
});
