import { describe, expect, it, vi } from 'vitest';
import { MAX_PESOS, Money } from '../../../src/domain/model/money';
import { parsePesos } from '../../../src/domain/model/quantity';
import { splitTaxIncluded, TAX_RATES_BP } from '../../../src/domain/model/tax';
import { contenido } from '../contenido';
import { calcularIva } from './iva';

// La calculadora de IVA de la landing (C4-L5), sin React: lee el precio como lo lee la aplicacion y separa base e IVA con la misma
// funcion del dominio. Aqui se vigila que no haya una copia de la cuenta y que base mas IVA sume siempre el precio.

vi.mock('../../../src/domain/model/tax', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/domain/model/tax')>();
  return { ...real, splitTaxIncluded: vi.fn(real.splitTaxIncluded) };
});

function bien(texto: string, tarifaBp: number) {
  const resultado = calcularIva(texto, tarifaBp);
  if (!resultado.ok) throw new Error(`debia calcular «${texto}»: ${resultado.mensaje}`);
  return resultado;
}

describe('the VAT calculator', () => {
  it('takes the VAT out of a price that already has it: 11.900 at 19 % is 10.000 of base and 1.900 of VAT', () => {
    expect(bien('11900', 1900)).toEqual({
      ok: true,
      total: 11_900,
      tarifaBp: 1900,
      base: 10_000,
      iva: 1_900,
      suma: 11_900,
    });
  });

  it('gives, for each of the five examples the accountant recalculated, the base and the VAT that were written down', () => {
    for (const e of contenido.ejemplosIva) {
      const r = bien(String(e.total), e.tarifaBp);
      expect({ base: r.base, iva: r.iva }, `${String(e.total)} al ${String(e.tarifaBp)}`).toEqual({
        base: e.base,
        iva: e.iva,
      });
    }
  });

  it('uses the split of the domain, the same one as the app, and not a copy of it', () => {
    vi.mocked(splitTaxIncluded).mockClear();

    calcularIva('10000', 500);

    expect(splitTaxIncluded).toHaveBeenCalledTimes(1);
    expect(splitTaxIncluded).toHaveBeenCalledWith(Money.of(10_000), 500);
  });

  it('adds up to the price for every price and every rate: base plus VAT is always the total', () => {
    for (const tarifaBp of TAX_RATES_BP) {
      for (let total = 0; total <= 3_000; total += 1) {
        const r = bien(String(total), tarifaBp);
        expect(r.base + r.iva, `${String(total)} al ${String(tarifaBp)}`).toBe(total);
        expect(r.suma, `${String(total)} al ${String(tarifaBp)}`).toBe(total);
      }
    }
  });

  it('adds up at the edges too: the largest price the product takes, and primes and odd numbers around it', () => {
    for (const tarifaBp of TAX_RATES_BP) {
      for (const total of [MAX_PESOS, MAX_PESOS - 1, 999_999_999_989, 123_456_789_013, 7, 11, 13]) {
        const r = bien(String(total), tarifaBp);
        expect(r.base + r.iva, `${String(total)} al ${String(tarifaBp)}`).toBe(total);
        expect(r.suma).toBe(total);
      }
    }
  });

  it('charges nothing at 0 %', () => {
    expect(bien('3500', 0)).toMatchObject({ base: 3_500, iva: 0 });
  });

  it('takes a zero as a price like any other', () => {
    expect(bien('0', 1900)).toMatchObject({ total: 0, base: 0, iva: 0, suma: 0 });
  });

  it('reads the price the way the app does: spaces around it are fine', () => {
    expect(bien('  11900 ', 1900)).toMatchObject({ total: 11_900 });
  });

  it('says what the app says when the price is not a number, and does not guess', () => {
    for (const texto of [
      '',
      '   ',
      '11.900',
      '11,900',
      '$ 11900',
      '11900 pesos',
      '-5',
      '1e3',
      '12.5',
    ]) {
      const r = calcularIva(texto, 1900);
      const esperado = parsePesos(texto);
      expect(r.ok, `«${texto}»`).toBe(false);
      if (!r.ok && !esperado.ok) expect(r.mensaje, `«${texto}»`).toBe(esperado.message);
    }
    expect(calcularIva('', 1900)).toEqual({ ok: false, mensaje: 'Escribe el precio.' });
  });

  it('refuses a price above what the product takes, with the message of the app', () => {
    expect(calcularIva(String(MAX_PESOS + 1), 1900)).toEqual({
      ok: false,
      mensaje: 'Ese precio es demasiado alto.',
    });
  });

  it('does not touch the domain when the price does not read', () => {
    vi.mocked(splitTaxIncluded).mockClear();

    calcularIva('11.900', 1900);

    expect(splitTaxIncluded).not.toHaveBeenCalled();
  });
});
