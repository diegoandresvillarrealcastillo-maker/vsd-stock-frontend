import { describeCount, parseCash, type CountNote } from '../../../src/domain/model/shift';

// La cuenta del arqueo de ejemplo de la landing (C4-L5), sin React. El efectivo lo lee `parseCash` y lo que se le dice a quien cuenta
// lo escribe `describeCount`: son las mismas funciones que usa la pantalla de cerrar turno de la aplicacion, asi que la pagina dice
// «Faltan $ 2.000» o «La caja cuadra» con las mismas palabras del producto y no puede decir otra cosa.

export type ResultadoArqueo =
  | { readonly ok: true; readonly contado: number; readonly nota: CountNote }
  | { readonly ok: false; readonly mensaje: string };

/** Dice si la caja cuadra. `esperado` es el efectivo que debe haber, en pesos; `texto`, lo que la persona escribio como contado. */
export function contarLaCaja(esperado: number, texto: string): ResultadoArqueo {
  const contado = parseCash(texto);
  if (!contado.ok) return { ok: false, mensaje: contado.message };
  return { ok: true, contado: contado.value, nota: describeCount(esperado, contado.value) };
}
