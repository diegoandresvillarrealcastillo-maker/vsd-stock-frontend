// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_REASON_LENGTH } from '../../src/domain/model/sales-history';

// Un documento que dice una cosa y una pantalla que dice otra es peor que no tener documento. Estas pruebas vigilan que
// `docs/ventas.md` exista, que el README lo enlace, y que cada frase de las pantallas que el documento cita siga siendo la que la
// pantalla dice de verdad: si alguien cambia una de las dos y no la otra, esto falla.
const raiz = resolve(import.meta.dirname, '../..');

/** Lee un archivo con los saltos de linea de Unix. */
function leer(ruta: string): string {
  expect(existsSync(resolve(raiz, ruta)), `falta ${ruta}`).toBe(true);
  return readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
}

/** Un documento como se lee: una frase partida entre dos lineas (Prettier ajusta la prosa) sigue siendo la misma frase. */
function prosa(ruta: string): string {
  return leer(ruta).replaceAll(/\s+/g, ' ');
}

const documento = prosa('docs/ventas.md');
const readme = leer('README.md');

describe('docs/ventas.md', () => {
  it('queda enlazado desde el README, en su seccion y en el indice de documentos', () => {
    expect(readme).toContain('(docs/ventas.md)');
    expect(readme).toMatch(/^### Ventas$/m);
    expect(readme).toMatch(/^- .*\[`docs\/ventas\.md`\]\(docs\/ventas\.md\)/m);
  });

  it.each([
    ['Mi turno', 'src/presentation/pages/SalesPage.tsx'],
    ['Todas', 'src/presentation/pages/SalesPage.tsx'],
    ['Atención', 'src/presentation/pages/SalesPage.tsx'],
    ['Por enviar', 'src/presentation/pages/SalesPage.tsx'],
    ['El servidor no la aceptó', 'src/presentation/pages/SalesPage.tsx'],
    ['No pudimos cargar las ventas', 'src/presentation/pages/SalesPage.tsx'],
    ['Enviada', 'src/domain/model/sales-history.ts'],
    ['Requiere atención', 'src/domain/model/sales-history.ts'],
    ['Revisada', 'src/domain/model/sales-history.ts'],
    ['Anulada', 'src/domain/model/sales-history.ts'],
    ['Otra persona', 'src/presentation/sales/use-seller-names.ts'],
    ['Qué pasó', 'src/presentation/pages/SaleDetailPage.tsx'],
    ['Anular venta', 'src/presentation/pages/SaleDetailPage.tsx'],
    ['Ajustar la existencia de', 'src/presentation/pages/SaleDetailPage.tsx'],
    ['Marcar como revisada', 'src/presentation/pages/SaleDetailPage.tsx'],
    ['La venta quedó revisada.', 'src/presentation/pages/SaleDetailPage.tsx'],
    ['La existencia vuelve a las bodegas', 'src/presentation/pages/VoidSalePage.tsx'],
    ['Sale de tu caja', 'src/presentation/pages/VoidSalePage.tsx'],
    ['Primero abre un turno', 'src/presentation/pages/VoidSalePage.tsx'],
    ['Abrir turno', 'src/presentation/pages/VoidSalePage.tsx'],
    [
      'Esa venta ya estaba anulada: el efectivo no salió otra vez.',
      'src/presentation/pages/VoidSalePage.tsx',
    ],
  ])('cita «%s» y la pantalla lo dice igual', (frase, pantalla) => {
    expect(documento).toContain(frase);
    expect(leer(pantalla)).toContain(frase);
  });

  it('dice lo mas largo que acepta el motivo y la nota, que es lo que el modelo acepta', () => {
    expect(documento).toContain(`hasta ${String(MAX_REASON_LENGTH)} letras`);
  });

  it('dice las tres rutas de las ventas, que son las del enrutador, y que anular tiene su permiso', () => {
    const rutas = leer('src/presentation/routes/AppRoutes.tsx');

    expect(documento).toContain('/mostrador/ventas');
    expect(documento).toContain('/mostrador/ventas/:saleId');
    expect(documento).toContain('/mostrador/ventas/:saleId/anular');
    expect(rutas).toContain('path="ventas"');
    expect(rutas).toContain('path=":saleId"');
    expect(rutas).toContain('path=":saleId/anular" element={guarded(\'sale:void\'');
  });

  it('dice el numero de ventas que piden atencion como lo dice el menu, con su tope', () => {
    expect(documento).toContain('Ventas 3');
    expect(documento).toContain('Ventas 50+');
    expect(leer('src/presentation/sales/attention-label.ts')).toContain("'+'");
  });
});

describe('el menu del mostrador, dicho en los documentos', () => {
  const menu = 'Mostrador · Turno · Ventas · Equipo';

  it('es el que tiene el marco, en ese orden', () => {
    const marco = leer('src/presentation/shell/CounterShell.tsx');
    const lugares = ['Mostrador', 'Turno', 'Ventas', 'Equipo'].map((nombre) =>
      marco.indexOf(`label: '${nombre}'`),
    );

    expect(lugares.every((lugar) => lugar !== -1)).toBe(true);
    expect([...lugares].sort((a, b) => a - b)).toEqual(lugares);
  });

  it.each(['README.md', 'docs/ventas.md', 'docs/turno.md'])('%s lo dice completo', (ruta) => {
    expect(prosa(ruta)).toContain(menu);
  });

  it.each(['README.md', 'docs/turno.md'])('%s ya no lo dice sin las ventas', (ruta) => {
    expect(prosa(ruta)).not.toContain('Mostrador · Turno · Equipo');
  });
});

describe('lo que el README dice que todavia no hay', () => {
  it('ya no promete para despues ver o anular las ventas hechas', () => {
    expect(prosa('README.md')).not.toContain('ver o anular las ventas hechas');
  });
});
