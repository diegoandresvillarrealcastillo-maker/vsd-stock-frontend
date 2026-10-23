import { gzipSync } from 'node:zlib';

// Lo que pesa la carga inicial de la landing (C4-L7), contado como lo cuenta la red. Los archivos de texto se miden comprimidos con
// gzip al nivel 9, igual que `scripts/check-bundle-size.ts` mide los de la aplicacion (`vite preview` no comprime, pero Cloudflare
// Pages si, y con Brotli pesan aun menos: esta cuenta es la del peor caso). Las fuentes y las imagenes ya vienen comprimidas y se
// cuentan tal cual.

const KB = 1024;

/** Un archivo que bajo el navegador: su direccion, su tipo (la cabecera `content-type`) y lo que trajo. */
export interface Respuesta {
  readonly url: string;
  readonly tipo: string;
  readonly cuerpo: Uint8Array;
}

/** Lo que pesa cada clase de archivo, en bytes de red. */
export interface PesoDeLaCarga {
  readonly total: number;
  readonly documento: number;
  readonly javascript: number;
  readonly css: number;
  readonly fuentes: number;
  readonly imagenes: number;
  readonly otros: number;
}

/** Cuanto puede pesar, en KB, la carga inicial entera y cada clase de archivo. */
export interface Presupuesto {
  readonly totalKB: number;
  readonly documentoKB: number;
  readonly javascriptKB: number;
  readonly cssKB: number;
  readonly fuentesKB: number;
  readonly imagenesKB: number;
}

type Clase = Exclude<keyof PesoDeLaCarga, 'total'>;

/** La clase de un archivo y si su tipo es de texto (se comprime en la red) o ya viene comprimido. */
function clasificar(tipo: string): { clase: Clase; comprimible: boolean } {
  const base = (tipo.split(';')[0] ?? '').trim().toLowerCase();
  if (base === 'text/html') return { clase: 'documento', comprimible: true };
  if (base === 'text/javascript' || base === 'application/javascript') {
    return { clase: 'javascript', comprimible: true };
  }
  if (base === 'text/css') return { clase: 'css', comprimible: true };
  if (base === 'image/svg+xml') return { clase: 'imagenes', comprimible: true };
  if (base.startsWith('font/') || base.startsWith('application/font')) {
    return { clase: 'fuentes', comprimible: false };
  }
  if (base.startsWith('image/')) return { clase: 'imagenes', comprimible: false };
  return { clase: 'otros', comprimible: false };
}

/** Lo que pesa lo que bajo el navegador, en bytes de red y por clase de archivo. */
export function pesoEnLaRed(respuestas: readonly Respuesta[]): PesoDeLaCarga {
  const peso = { documento: 0, javascript: 0, css: 0, fuentes: 0, imagenes: 0, otros: 0 };
  for (const { tipo, cuerpo } of respuestas) {
    const { clase, comprimible } = clasificar(tipo);
    peso[clase] += comprimible ? gzipSync(cuerpo, { level: 9 }).length : cuerpo.length;
  }
  return { ...peso, total: Object.values(peso).reduce((suma, bytes) => suma + bytes, 0) };
}

/** Una frase por cada presupuesto que se pasa; vacio si todo cabe. Un peso igual al limite cabe. */
export function excesos(peso: PesoDeLaCarga, presupuesto: Presupuesto): string[] {
  const filas: readonly (readonly [string, string, number, number])[] = [
    ['La carga inicial', 'pesa', peso.total, presupuesto.totalKB],
    ['El documento', 'pesa', peso.documento, presupuesto.documentoKB],
    ['JavaScript', 'pesa', peso.javascript, presupuesto.javascriptKB],
    ['CSS', 'pesa', peso.css, presupuesto.cssKB],
    ['Las fuentes', 'pesan', peso.fuentes, presupuesto.fuentesKB],
    ['Las imagenes', 'pesan', peso.imagenes, presupuesto.imagenesKB],
  ];
  return filas
    .filter(([, , bytes, limite]) => bytes > limite * KB)
    .map(
      ([nombre, verbo, bytes, limite]) =>
        `${nombre} ${verbo} ${(bytes / KB).toFixed(1)} KB comprimido y el presupuesto es ${String(limite)} KB.`,
    );
}
