import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// ADR 0033: TODO el texto de la landing vive en `sitio/pagina/contenido.ts`. Es lo que permite que
// `test/sitio/afirmaciones.spec.ts` vigile que la pagina no afirme lo que el producto no hace: si un componente escribiera una
// frase suya, esa frase quedaria fuera de la vigilancia. Aqui se leen los componentes como codigo (no como texto) y se busca
// cualquier palabra escrita a mano: el texto entre etiquetas, los atributos que se leen o se oyen (`aria-label`, `alt`...) y las
// cadenas puestas entre llaves.
const PAGINA = join(import.meta.dirname, '..', '..', 'sitio', 'pagina');

const ATRIBUTOS_CON_TEXTO = new Set([
  'aria-label',
  'aria-description',
  'alt',
  'title',
  'placeholder',
]);
const TIENE_LETRAS = /\p{L}/u;

function conLetras(texto: string): boolean {
  return TIENE_LETRAS.test(texto);
}

function cadenaConLetras(nodo: ts.Node): boolean {
  if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) {
    return conLetras(nodo.text);
  }
  if (ts.isTemplateExpression(nodo)) {
    return conLetras(nodo.head.text) || nodo.templateSpans.some((s) => conLetras(s.literal.text));
  }
  return false;
}

/** Las palabras escritas a mano en un componente. Vacio si todo el texto llega de `contenido.ts`. */
export function textoEscritoAMano(codigo: string, nombre: string): string[] {
  const fuente = ts.createSourceFile(
    nombre,
    codigo,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const hallazgos: string[] = [];

  const visitar = (nodo: ts.Node): void => {
    if (ts.isJsxText(nodo) && !nodo.containsOnlyTriviaWhiteSpaces && conLetras(nodo.text)) {
      hallazgos.push(`texto entre etiquetas: «${nodo.text.trim()}»`);
    }
    if (ts.isJsxAttribute(nodo) && ATRIBUTOS_CON_TEXTO.has(nodo.name.getText(fuente))) {
      const valor = nodo.initializer;
      const literal = valor !== undefined && ts.isJsxExpression(valor) ? valor.expression : valor;
      if (literal !== undefined && cadenaConLetras(literal)) {
        hallazgos.push(`atributo ${nodo.name.getText(fuente)}: ${literal.getText(fuente)}`);
      }
    }
    if (
      ts.isJsxExpression(nodo) &&
      (ts.isJsxElement(nodo.parent) || ts.isJsxFragment(nodo.parent)) &&
      nodo.expression !== undefined &&
      cadenaConLetras(nodo.expression)
    ) {
      hallazgos.push(`cadena entre llaves: ${nodo.expression.getText(fuente)}`);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallazgos;
}

function componentes(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) return componentes(ruta);
    return entrada.name.endsWith('.tsx') && !entrada.name.endsWith('.spec.tsx') ? [ruta] : [];
  });
}

describe('the vigilance of the text', () => {
  it('finds a phrase written between tags', () => {
    expect(textoEscritoAMano('const a = <p>Hola mundo</p>;', 'a.tsx')).toHaveLength(1);
  });

  it('finds a phrase in the attributes that are read or heard', () => {
    expect(textoEscritoAMano('const a = <img alt="Un logo" />;', 'a.tsx')).toHaveLength(1);
    expect(textoEscritoAMano('const a = <a aria-label={`Ir a ${x}`} />;', 'a.tsx')).toHaveLength(1);
    expect(textoEscritoAMano("const a = <a title={'Ir'} />;", 'a.tsx')).toHaveLength(1);
  });

  it('finds a string put between braces, with or without parts that are filled in', () => {
    expect(textoEscritoAMano("const a = <p>{'Hola'}</p>;", 'a.tsx')).toHaveLength(1);
    expect(textoEscritoAMano('const a = <p>{`Hola ${x}`}</p>;', 'a.tsx')).toHaveLength(1);
    expect(textoEscritoAMano('const a = <p>{`${x} de ${y}`}</p>;', 'a.tsx')).toHaveLength(1);
  });

  it('lets through what is not a word: spaces, signs, numbers, class names and what comes from the content', () => {
    const permitido = `
      const a = (
        <p className="text-sm font-bold" aria-hidden="true" id="uno">
          {contenido.hero.subtitulo}
          {\`\${antes} \`}
          {\` (\${externo})\`}
          <span>·</span>
          <span>→</span>
          <span>12</span>
        </p>
      );`;
    expect(textoEscritoAMano(permitido, 'a.tsx')).toEqual([]);
  });

  it('finds none in the components of the page: every word comes from contenido.ts', () => {
    const archivos = componentes(PAGINA);
    expect(archivos.length).toBeGreaterThan(8);

    for (const archivo of archivos) {
      const hallazgos = textoEscritoAMano(readFileSync(archivo, 'utf8'), archivo);
      expect(hallazgos, relative(PAGINA, archivo)).toEqual([]);
    }
  });
});
