// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Dos suites de la landing cuestan mas de lo que el limite por defecto de Vitest (5 s para una prueba, 1 s para un `findBy`) deja cuando la
// suite completa corre con la maquina cargada: la prueba de propiedades de la calculadora de IVA (unos 210 casos que escriben en el campo y
// buscan tres filas) y las que esperan la descarga perezosa de una demo (issue #82). El arreglo es alargar el limite, escrito con su razon en
// el mismo lugar, sin quitar ningun caso. Aqui se vigila que nadie lo quite sin darse cuenta.
const SECCIONES = resolve(import.meta.dirname, '../../sitio/pagina/secciones');
const leer = (nombre: string): string =>
  readFileSync(join(SECCIONES, nombre), 'utf8').replaceAll('\r\n', '\n');

const iva = leer('CalculadoraIva.spec.tsx');
const demo = leer('Pruebalo.spec.tsx');

/** El valor numerico de una constante del archivo, por ejemplo `const LIMITE_MS = 30_000;`. */
function constante(fuente: string, nombre: string): number {
  const m = new RegExp(`const ${nombre} = ([\\d_]+);`).exec(fuente);
  return m === null ? Number.NaN : Number((m[1] ?? '').replaceAll('_', ''));
}

describe('la prueba de propiedades de la calculadora de IVA', () => {
  const titulo = "'adds up, as the page shows it, for any price and any rate'";
  const cuerpo = iva.slice(iva.indexOf(titulo));
  const cierre = /\},\s*([A-Z0-9_]+),?\s*\);/.exec(cuerpo);

  it('tiene un limite de tiempo propio, de al menos 20 segundos', () => {
    expect(iva).toContain(titulo);
    expect(cierre, 'la prueba termina con `}, LIMITE);`').not.toBeNull();
    expect(constante(iva, cierre?.[1] ?? 'NO_HAY')).toBeGreaterThanOrEqual(20_000);
  });

  it('dice por que, en el mismo lugar, y cita el issue', () => {
    const lugar = iva.slice(0, iva.indexOf(titulo));
    expect(lugar).toMatch(/#82/);
    expect(lugar).toMatch(/210 casos/);
  });

  it('conserva todos los casos: las tres tarifas y los 60 precios seguidos', () => {
    expect(cuerpo).toContain('for (const bp of TAX_RATES_BP)');
    expect(cuerpo).toContain('Array.from({ length: 60 }, (_, i) => i)');
    expect(cuerpo).toContain('MAX_PESOS');
  });
});

describe('las pruebas de la demo que esperan la descarga de una calculadora o del arqueo', () => {
  const pruebas = demo.split(/\n {2}it\(/).slice(1);
  const lentas = pruebas.filter((p) => /findByLabelText(?:<[^>]*>)?\(/.test(p));

  it('son las cinco que se conocen: sin ellas esta vigilancia no vigila nada', () => {
    expect(lentas.length).toBeGreaterThanOrEqual(5);
  });

  it('esperan la descarga con un limite propio de al menos 10 segundos, no con el segundo por defecto', () => {
    const espera = constante(demo, 'ESPERA_DE_LA_DESCARGA_MS');
    expect(espera).toBeGreaterThanOrEqual(10_000);
    for (const p of lentas) {
      for (const llamada of p.matchAll(/findByLabelText(?:<[^>]*>)?\(([^)]*)\)/g)) {
        expect(llamada[1], p.slice(0, 60)).toContain('timeout: ESPERA_DE_LA_DESCARGA_MS');
      }
    }
  });

  it('y cada una tiene un limite de tiempo mayor que lo que espera', () => {
    const limite = constante(demo, 'LIMITE_DE_LA_PRUEBA_MS');
    expect(limite).toBeGreaterThan(constante(demo, 'ESPERA_DE_LA_DESCARGA_MS'));
    for (const p of lentas) {
      expect(p, p.slice(0, 60)).toMatch(/\},\s*LIMITE_DE_LA_PRUEBA_MS,?\s*\);/);
    }
  });

  it('dice por que, en el mismo lugar, y cita el issue', () => {
    expect(demo.slice(0, demo.indexOf('ESPERA_DE_LA_DESCARGA_MS = '))).toMatch(/#82/);
  });
});
