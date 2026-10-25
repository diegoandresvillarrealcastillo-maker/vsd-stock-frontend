// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Un documento que dice una cosa y un formulario que dice otra es peor que no tener documento. Estas pruebas vigilan que
// `docs/exento-y-excluido.md` exista, que el README lo enlace, y que cada frase que el documento cita del formulario siga siendo la
// que el formulario dice de verdad: si alguien cambia una de las dos y no la otra, esto falla.
const raiz = resolve(import.meta.dirname, '../..');

/** Lee un archivo con los saltos de linea de Unix. */
function leer(ruta: string): string {
  expect(existsSync(resolve(raiz, ruta)), `falta ${ruta}`).toBe(true);
  return readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
}

/** Un texto como se lee: una frase partida entre dos lineas (Prettier ajusta la prosa) sigue siendo la misma frase. */
const prosa = (ruta: string): string => leer(ruta).replaceAll(/\s+/g, ' ');

const documento = prosa('docs/exento-y-excluido.md');
const formulario = prosa('src/presentation/catalog/ProductForm.tsx');

describe('docs/exento-y-excluido.md', () => {
  it('queda enlazado desde el README, en el indice de documentos', () => {
    expect(leer('README.md')).toMatch(
      /^- .*\[`docs\/exento-y-excluido\.md`\]\(docs\/exento-y-excluido\.md\)/m,
    );
  });

  it.each([
    'Exento: está dentro del IVA, pero a tarifa 0 %, así que no se cobra.',
    'huevos frescos, leche de vaca sin azúcar añadida y queso fresco sin madurar',
    'Excluido: está fuera del IVA, así que no se cobra.',
    'papa, tomate y cebolla frescos',
    'fresco no es lo mismo que procesado',
    'Elige si el producto es gravado, exento o excluido.',
  ])('cita «%s» y el formulario lo dice igual', (frase) => {
    expect(documento).toContain(frase);
    expect(formulario).toContain(frase);
  });

  it('dice que ningun boton de IVA arranca marcado, y que el servidor tambien exige el tipo', () => {
    expect(documento).toMatch(/Ninguno de los cuatro botones de IVA .* arranca marcado/);
    expect(documento).toContain('El backend también lo exige.');
  });

  it('dice de donde viene el unico exento que nadie eligio: la migracion y el valor de arranque, que son datos viejos', () => {
    expect(documento).toContain('20261023120000_tipo_tributario');
    expect(documento).toContain('startingTaxKind');
    expect(leer('src/domain/model/tax.ts')).toContain('export function startingTaxKind');
    expect(documento).toMatch(/No hay base de datos de producción/);
  });

  it('dice que no hay una marca de «tipo confirmado» por producto', () => {
    expect(documento).toContain('No guarda una marca de «tipo confirmado» por producto.');
  });
});
