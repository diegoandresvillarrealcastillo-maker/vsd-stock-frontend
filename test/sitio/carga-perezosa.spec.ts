import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Lo que baja al abrir la landing (C4-L6): la calculadora de IVA y el arqueo viven en pestanas de la banda de la demo y solo se
// descargan cuando alguien las abre. Esta prueba lee el codigo y no lo ejecuta: si alguien las importa de la forma normal en
// cualquier otro archivo de la pagina, Vite las mete en el paquete de la entrada y la pestana ya no ahorra nada.

const RAIZ = 'sitio/pagina';

function archivos(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    return entrada.isDirectory() ? archivos(ruta) : [ruta];
  });
}

const codigo = archivos(RAIZ).filter((ruta) => /\.tsx?$/.test(ruta) && !/\.spec\.tsx?$/.test(ruta));

/** Los archivos que importan `modulo` de la forma normal (`import … from './Modulo'`), la que lo mete en el paquete de la entrada. */
function importanDeFormaNormal(modulo: string): string[] {
  const patron = new RegExp(`from\\s+['"][^'"]*/${modulo}['"]`);
  return codigo.filter((ruta) => patron.test(readFileSync(ruta, 'utf8')));
}

describe('lo que la landing descarga solo cuando se pide', () => {
  it.each(['CalculadoraIva', 'ArqueoDeEjemplo'])(
    'no importa %s de la forma normal en ningun archivo: solo con import() desde la banda de la demo',
    (modulo) => {
      expect(importanDeFormaNormal(modulo)).toEqual([]);
      const banda = readFileSync(join(RAIZ, 'secciones/Pruebalo.tsx'), 'utf8');
      expect(banda).toMatch(new RegExp(`import\\(\\s*['"]\\./${modulo}['"]\\s*\\)`));
    },
  );

  it('el diagrama si va en el paquete de la entrada: es la primera pestana de la banda y se ve sin pedir nada', () => {
    expect(importanDeFormaNormal('DiagramaVenta')).toEqual([join(RAIZ, 'secciones/Pruebalo.tsx')]);
  });

  it('la prueba sabe distinguir: ve las importaciones normales que de verdad existen', () => {
    expect(importanDeFormaNormal('Seccion')).not.toEqual([]);
  });
});
