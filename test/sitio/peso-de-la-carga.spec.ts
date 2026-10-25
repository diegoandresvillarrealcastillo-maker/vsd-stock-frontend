// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { excesos, pesoEnLaRed, type Presupuesto, type Respuesta } from '../../e2e/support/peso';

// Lo que pesa la carga inicial de la landing (C4-L7), contado como lo cuenta la red: los archivos de texto comprimidos con gzip
// al nivel 9 (como `scripts/check-bundle-size.ts` cuenta los de la aplicacion) y los demas tal cual, porque las fuentes y las
// imagenes ya vienen comprimidas. Estas pruebas vigilan la cuenta; los numeros del presupuesto los vigila el navegador.
const ROOT = resolve(import.meta.dirname, '../..');

const texto = (contenido: string): Uint8Array => new TextEncoder().encode(contenido);
const bytes = (largo: number): Uint8Array =>
  Uint8Array.from({ length: largo }, (_, i) => (i * 37) % 251);
const respuesta = (
  tipo: string,
  cuerpo: Uint8Array,
  url = 'http://localhost/archivo',
): Respuesta => ({
  url,
  tipo,
  cuerpo,
});
const gzip = (cuerpo: Uint8Array): number => gzipSync(cuerpo, { level: 9 }).length;

describe('the weight of the first load, as the network counts it', () => {
  it('is zero when nothing was downloaded', () => {
    expect(pesoEnLaRed([])).toEqual({
      total: 0,
      documento: 0,
      javascript: 0,
      css: 0,
      fuentes: 0,
      imagenes: 0,
      otros: 0,
    });
  });

  it('counts the text files compressed with gzip at level 9, not as they are on disk', () => {
    const codigo = texto('const a = 1;\n'.repeat(2_000));
    const peso = pesoEnLaRed([respuesta('text/javascript', codigo)]);

    expect(codigo.length).toBeGreaterThan(20_000);
    expect(peso.javascript).toBe(gzip(codigo));
    expect(peso.javascript).toBeLessThan(500);
  });

  it('counts the fonts and the images as they are: they already come compressed', () => {
    const peso = pesoEnLaRed([
      respuesta('font/woff2', bytes(1_000)),
      respuesta('image/webp', bytes(2_000)),
    ]);

    expect(peso.fuentes).toBe(1_000);
    expect(peso.imagenes).toBe(2_000);
  });

  it('puts each file in its own kind, whatever the charset and the case of its type', () => {
    const cuerpo = texto('x'.repeat(3_000));
    const peso = pesoEnLaRed([
      respuesta('text/html; charset=utf-8', cuerpo),
      respuesta('Text/JavaScript', cuerpo),
      respuesta('application/javascript', cuerpo),
      respuesta('text/css; charset=utf-8', cuerpo),
    ]);
    const uno = gzip(cuerpo);

    expect(peso.documento).toBe(uno);
    expect(peso.javascript).toBe(2 * uno);
    expect(peso.css).toBe(uno);
    expect(peso.fuentes + peso.imagenes + peso.otros).toBe(0);
  });

  it('counts with level 9, the one of the budget of the app, and not with the default level of gzip', () => {
    const palabras = Array.from(
      { length: 4_000 },
      (_, i) => `palabra${String((i * 7919) % 1_000)}`,
    );
    const codigo = texto(palabras.join(' '));
    // Sin esto la prueba no distingue nada: hace falta un contenido en que el nivel 9 y el de siempre den numeros distintos.
    expect(gzipSync(codigo).length).not.toBe(gzip(codigo));

    expect(pesoEnLaRed([respuesta('text/javascript', codigo)]).javascript).toBe(gzip(codigo));
  });

  it('ignores spaces around the type', () => {
    const cuerpo = texto('x'.repeat(3_000));

    expect(pesoEnLaRed([respuesta('  text/css  ; charset=utf-8', cuerpo)]).css).toBe(gzip(cuerpo));
  });

  it('counts the fonts that come with the old application/font-* types as fonts', () => {
    expect(pesoEnLaRed([respuesta('application/font-woff', bytes(500))]).fuentes).toBe(500);
    expect(pesoEnLaRed([respuesta('font/woff', bytes(400))]).fuentes).toBe(400);
  });

  it('does not take for a font a type that only ends like one', () => {
    expect(pesoEnLaRed([respuesta('application/x-application/font', bytes(300))]).fuentes).toBe(0);
  });

  it('counts an SVG as text, compressed, but as an image', () => {
    const svg = texto('<svg>' + '<path d="M0 0"/>'.repeat(500) + '</svg>');
    const peso = pesoEnLaRed([respuesta('image/svg+xml', svg)]);

    expect(peso.imagenes).toBe(gzip(svg));
    expect(peso.imagenes).toBeLessThan(svg.length / 4);
  });

  it('leaves in «otros» what is none of the above, uncompressed (a JSON, a manifest)', () => {
    const peso = pesoEnLaRed([respuesta('application/json', bytes(700))]);

    expect(peso.otros).toBe(700);
  });

  it('makes the total the sum of every kind, so no file is left out or counted twice', () => {
    const peso = pesoEnLaRed([
      respuesta('text/html', texto('<p>hola</p>'.repeat(100))),
      respuesta('text/javascript', texto('let a;'.repeat(100))),
      respuesta('text/css', texto('a{}'.repeat(100))),
      respuesta('font/woff2', bytes(10)),
      respuesta('image/png', bytes(20)),
      respuesta('application/json', bytes(30)),
    ]);

    expect(peso.total).toBe(
      peso.documento + peso.javascript + peso.css + peso.fuentes + peso.imagenes + peso.otros,
    );
    expect(peso.total).toBeGreaterThan(60);
  });
});

describe('what goes over the budget', () => {
  const presupuesto: Presupuesto = {
    totalKB: 100,
    documentoKB: 10,
    javascriptKB: 50,
    cssKB: 10,
    fuentesKB: 30,
    imagenesKB: 20,
  };
  const KB = 1024;
  const peso = (cambios: Partial<ReturnType<typeof pesoEnLaRed>> = {}) => ({
    total: 0,
    documento: 0,
    javascript: 0,
    css: 0,
    fuentes: 0,
    imagenes: 0,
    otros: 0,
    ...cambios,
  });

  it('says nothing when everything fits, even right at the limit', () => {
    expect(
      excesos(
        peso({
          total: 100 * KB,
          documento: 10 * KB,
          javascript: 50 * KB,
          css: 10 * KB,
          fuentes: 30 * KB,
          imagenes: 20 * KB,
        }),
        presupuesto,
      ),
    ).toEqual([]);
  });

  it.each([
    ['total', { total: 100 * KB + 1 }, 'La carga inicial pesa'],
    ['documento', { documento: 10 * KB + 1 }, 'El documento pesa'],
    ['javascript', { javascript: 50 * KB + 1 }, 'JavaScript pesa'],
    ['css', { css: 10 * KB + 1 }, 'CSS pesa'],
    ['fuentes', { fuentes: 30 * KB + 1 }, 'Las fuentes pesan'],
    ['imagenes', { imagenes: 20 * KB + 1 }, 'Las imagenes pesan'],
  ])('says one thing when only the %s goes over by a byte', (_nombre, cambio, empieza) => {
    const frases = excesos(peso(cambio), presupuesto);

    expect(frases).toHaveLength(1);
    expect(frases[0]).toContain(empieza);
  });

  it('says how much it weighs and how much the budget is, in KB', () => {
    const [frase] = excesos(peso({ javascript: 96 * KB }), presupuesto);

    expect(frase).toBe('JavaScript pesa 96.0 KB comprimido y el presupuesto es 50 KB.');
  });

  it('says one sentence for each budget that is passed', () => {
    const frases = excesos(
      peso({ total: 200 * KB, javascript: 90 * KB, css: 20 * KB }),
      presupuesto,
    );

    expect(frases).toHaveLength(3);
  });
});

describe('the budget of the landing (scripts/presupuesto-sitio.json)', () => {
  const presupuesto = JSON.parse(
    readFileSync(join(ROOT, 'scripts', 'presupuesto-sitio.json'), 'utf8'),
  ) as Record<string, unknown>;

  it('has a limit, in positive KB, for the total and for each kind of file, and nothing else', () => {
    expect(Object.keys(presupuesto).sort()).toEqual(
      ['cssKB', 'documentoKB', 'fuentesKB', 'imagenesKB', 'javascriptKB', 'totalKB'].sort(),
    );
    for (const limite of Object.values(presupuesto)) {
      expect(typeof limite).toBe('number');
      expect(limite as number).toBeGreaterThan(0);
    }
  });

  it('leaves the total below the sum of the limits of each kind, so the total is the one that notices a general creep', () => {
    const { totalKB, documentoKB, javascriptKB, cssKB, fuentesKB, imagenesKB } =
      presupuesto as Record<string, number>;

    expect(totalKB).toBeLessThan(
      (documentoKB ?? 0) +
        (javascriptKB ?? 0) +
        (cssKB ?? 0) +
        (fuentesKB ?? 0) +
        (imagenesKB ?? 0),
    );
  });
});
