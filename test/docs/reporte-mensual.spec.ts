// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Un documento que dice una cosa y una pantalla que dice otra es peor que no tener documento. Estas pruebas vigilan que
// `docs/reporte-mensual.md` exista, que el README lo enlace, y que cada frase del aviso que el documento cita siga siendo la que la
// pantalla dice de verdad: si alguien cambia una de las dos y no la otra, esto falla.
const raiz = resolve(import.meta.dirname, '../..');

/** Lee un archivo con los saltos de linea de Unix. */
function leer(ruta: string): string {
  expect(existsSync(resolve(raiz, ruta)), `falta ${ruta}`).toBe(true);
  return readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
}

/** Un texto como se lee: una frase partida entre dos lineas (Prettier ajusta la prosa) sigue siendo la misma frase. */
const prosa = (ruta: string): string => leer(ruta).replaceAll(/\s+/g, ' ');

const documento = prosa('docs/reporte-mensual.md');
const pantalla = prosa('src/presentation/pages/MonthlyReportPage.tsx');

describe('docs/reporte-mensual.md', () => {
  it('queda enlazado desde el README, en el indice de documentos', () => {
    expect(leer('README.md')).toMatch(
      /^- .*\[`docs\/reporte-mensual\.md`\]\(docs\/reporte-mensual\.md\)/m,
    );
  });

  it('dice la ruta y el permiso, que son los del enrutador', () => {
    const rutas = leer('src/presentation/routes/AppRoutes.tsx');

    expect(documento).toContain('/reportes');
    expect(documento).toContain('report:sales');
    expect(rutas).toContain('path="reportes"');
    expect(rutas).toContain("guarded('report:sales'");
  });

  it.each([
    'Este reporte es de control interno, no es tu declaración de IVA',
    'No reemplaza la factura electrónica ni la declaración de impuestos.',
    'tus compras y gastos',
    'el IVA que puedes descontar',
    'las retenciones',
    'los períodos de tu declaración',
    'No copies el «Total vendido» como tus ingresos: lleva el IVA adentro.',
    'Si una venta hecha sin conexión llega después de cerrar el mes, ese mes cambia.',
    'conecta todos los equipos y espera a que digan «Todo enviado»',
    'Exento y excluido salen como los marcaste en cada producto',
    'Que un producto sea exento no significa que puedas descontar o pedir de vuelta el IVA de tus compras',
  ])('cita «%s» y la pantalla lo dice igual', (frase) => {
    expect(documento).toContain(frase);
    expect(pantalla).toContain(frase);
  });

  it('dice que el aviso va arriba, antes de cualquier cifra, y que se ve aunque no haya ventas o no cargue', () => {
    expect(documento).toMatch(/arriba, antes de cualquier cifra/);
    expect(documento).toMatch(/aunque el mes no tenga ventas o el reporte no cargue/);
  });

  it('dice que el reporte solo se entrega en pantalla: no hay PDF, CSV ni impresion que necesiten el aviso', () => {
    expect(documento).toMatch(/solo se entrega en pantalla/i);
  });

  it('dice por que un mes ya mirado puede cambiar: las ventas se cuentan en el mes en que ocurrieron', () => {
    expect(documento).toMatch(/cuenta cada venta en el mes en que ocurrió, no en el que llegó/);
  });
});
