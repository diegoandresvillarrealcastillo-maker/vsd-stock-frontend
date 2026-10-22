// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// GitHub solo ofrece una plantilla de Issue si el archivo esta en
// .github/ISSUE_TEMPLATE y su encabezado (entre dos lineas `---`) trae `name` y
// `about`. Si el encabezado se rompe, la plantilla desaparece sin avisar y
// nadie lo nota hasta que alguien abre un Issue en blanco. Estas pruebas
// vigilan eso y que el esqueleto conserve lo que pide el flujo de trabajo
// (ADR 0010): objetivo, criterios, dependencias y definicion de terminado.
const ruta = resolve(import.meta.dirname, '../../.github/ISSUE_TEMPLATE/ticket.md');

function leerPlantilla(): string {
  expect(existsSync(ruta), 'falta .github/ISSUE_TEMPLATE/ticket.md').toBe(true);
  return readFileSync(ruta, 'utf8').replaceAll('\r\n', '\n');
}

interface Plantilla {
  encabezado: Map<string, string>;
  cuerpo: string;
}

/** Separa el encabezado (`clave: valor`, entre dos lineas `---`) del cuerpo. */
function separar(texto: string): Plantilla {
  const coincidencia = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(texto);
  const bloque = coincidencia?.[1];
  if (bloque === undefined) {
    throw new Error('la plantilla debe empezar con un encabezado entre dos lineas ---');
  }
  const encabezado = new Map<string, string>();
  for (const linea of bloque.split('\n')) {
    const separador = linea.indexOf(':');
    if (separador === -1) continue;
    const valor = linea.slice(separador + 1).trim();
    // Los valores entre comillas simples conservan sus espacios finales.
    const sinComillas = /^'(.*)'$/.exec(valor)?.[1] ?? valor;
    encabezado.set(linea.slice(0, separador).trim(), sinComillas);
  }
  return { encabezado, cuerpo: coincidencia?.[2] ?? '' };
}

describe('plantilla de Issue del frontend', () => {
  it('existe en .github/ISSUE_TEMPLATE/ticket.md', () => {
    expect(leerPlantilla().trim().length).toBeGreaterThan(0);
  });

  it('dice como se llama y para que sirve, que es lo que GitHub exige para ofrecerla', () => {
    const { encabezado } = separar(leerPlantilla());

    expect(encabezado.get('name')?.trim()).toBeTruthy();
    expect(encabezado.get('about')?.trim()).toBeTruthy();
  });

  it('propone un titulo con el prefijo del ciclo, [Cn-NN]', () => {
    const { encabezado } = separar(leerPlantilla());

    expect(encabezado.get('title')).toMatch(/^\[Cn-NN\] $/);
  });

  it.each(['Objetivo', 'Criterios de aceptación', 'Depende de', 'Definición de terminado'])(
    'conserva la seccion «%s»',
    (seccion) => {
      const { cuerpo } = separar(leerPlantilla());

      expect(cuerpo).toContain(`**${seccion}`);
    },
  );

  it.each([
    'Pruebas escritas antes y vistas fallar',
    'CI en verde',
    'Documentación actualizada en el mismo PR',
    'Revisado y fusionado por la otra persona',
  ])('la definicion de terminado exige: %s', (exigencia) => {
    const { cuerpo } = separar(leerPlantilla());

    expect(cuerpo).toContain(exigencia);
  });
});
