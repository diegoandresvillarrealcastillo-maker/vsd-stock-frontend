import { describe, expect, it } from 'vitest';
import { MAX_PESOS } from '../../../src/domain/model/money';
import { describeCount, parseCash } from '../../../src/domain/model/shift';
import { contenido } from '../contenido';
import { contarLaCaja } from './arqueo';

// El arqueo de ejemplo de la landing (C4-L5), sin React: la persona escribe el efectivo que conto y la pagina le dice, con las
// palabras del producto, si la caja cuadra. Lo lee `parseCash` y lo dice `describeCount`, las mismas funciones de la aplicacion.

const ESPERADO = contenido.comoFunciona.arqueo.esperado;

function bien(texto: string) {
  const resultado = contarLaCaja(ESPERADO, texto);
  if (!resultado.ok) throw new Error(`debia contar «${texto}»: ${resultado.mensaje}`);
  return resultado;
}

describe('the cash count of the example', () => {
  it('says how much is missing: «Faltan $ 2.000 · Esperabas $ 170.000 y contaste $ 168.000.»', () => {
    const r = bien('168000');

    expect(r.contado).toBe(168_000);
    expect(`${r.nota.title} · ${r.nota.detail}`).toBe(
      'Faltan $ 2.000 · Esperabas $ 170.000 y contaste $ 168.000.',
    );
  });

  it('starts from the count the page shows: what is expected, less what is missing', () => {
    const { contado, esperado } = contenido.comoFunciona.arqueo;

    expect(bien(String(contado)).nota.kind).toBe('short');
    expect(contado - esperado).toBe(contenido.funciones.miniaturas.caja.diferencia);
  });

  it('says the drawer balances when the count is the expected one', () => {
    expect(bien('170000').nota).toEqual({
      kind: 'balanced',
      title: 'La caja cuadra',
      detail: 'Esperabas $ 170.000 y contaste $ 170.000.',
    });
  });

  it('says how much is over', () => {
    expect(bien('171500').nota).toMatchObject({ kind: 'over', title: 'Sobran $ 1.500' });
  });

  it('says exactly what the product says, for any count it takes', () => {
    for (const contado of [0, 1, 50, 169_999, 170_000, 170_001, 250_000, MAX_PESOS]) {
      expect(bien(String(contado)).nota, String(contado)).toEqual(describeCount(ESPERADO, contado));
    }
  });

  it('takes a zero as a count: an empty drawer is an amount, not an oversight', () => {
    expect(bien('0').nota).toMatchObject({ kind: 'short', title: 'Faltan $ 170.000' });
  });

  it('reads the cash the way the app does, and says what the app says when it does not read', () => {
    for (const texto of ['', '  ', '5o', '170.000', '170,000', '$170000', '-1', '1.5']) {
      const r = contarLaCaja(ESPERADO, texto);
      const esperado = parseCash(texto);
      expect(r.ok, `«${texto}»`).toBe(false);
      if (!r.ok && !esperado.ok) expect(r.mensaje, `«${texto}»`).toBe(esperado.message);
    }
  });

  it('refuses a count above what the product takes', () => {
    expect(contarLaCaja(ESPERADO, String(MAX_PESOS + 1))).toEqual({
      ok: false,
      mensaje: 'Ese monto es demasiado alto.',
    });
  });

  it('says nothing about the difference until there is a number', () => {
    expect(contarLaCaja(ESPERADO, '')).toMatchObject({ ok: false });
    expect(contarLaCaja(ESPERADO, '5o')).not.toHaveProperty('nota');
  });
});
