// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPTURAS } from '../../sitio/pagina/capturas';
import { contenido } from '../../sitio/pagina/contenido';

// Las capturas de la aplicación que la página muestra (rediseño comercial, LND-2). Son imágenes reales de la aplicación con datos de
// ejemplo («Minimercado La Esquina»), guardadas en `sitio/public/capturas/`. Esta prueba vigila lo que una captura puede perder sin
// que nadie lo note: que el archivo exista, que las medidas escritas sean las del archivo (el navegador reserva ese espacio y la página
// no salta al cargar), que pese poco y que tenga una descripción para quien no la ve.
const PUBLICO = resolve(import.meta.dirname, '../../sitio/public');

/** Las medidas de un WebP con pérdida (`VP8 `): lo que escribe `cwebp` y lo que escribe Pillow con `quality`. */
function medidasDeWebp(archivo: Buffer): { ancho: number; alto: number } {
  expect(archivo.subarray(0, 4).toString('latin1'), 'cabecera RIFF').toBe('RIFF');
  expect(archivo.subarray(8, 12).toString('latin1'), 'es un WebP').toBe('WEBP');
  expect(archivo.subarray(12, 16).toString('latin1'), 'WebP con pérdida').toBe('VP8 ');
  return { ancho: archivo.readUInt16LE(26) & 0x3fff, alto: archivo.readUInt16LE(28) & 0x3fff };
}

const KB = 1024;
const entradas = Object.entries(CAPTURAS);

describe('the screenshots of the app', () => {
  it('are the five the page shows: the sale and the stock on the hero, and the payment, the cash count and the monthly summary below', () => {
    expect(Object.keys(CAPTURAS).sort()).toEqual(
      ['cierre', 'cobrar', 'existencias', 'reporte', 'vender'].sort(),
    );
  });

  it.each(entradas)(
    '%s is a WebP in /capturas with the size that is written down',
    (_id, captura) => {
      expect(captura.src).toMatch(/^\/capturas\/[a-z-]+\.webp$/);
      const medidas = medidasDeWebp(readFileSync(join(PUBLICO, captura.src)));

      expect(medidas).toEqual({ ancho: captura.ancho, alto: captura.alto });
    },
  );

  it.each(entradas)(
    '%s weighs under 40 KB, so a phone does not pay for a photograph',
    (_id, captura) => {
      const peso = readFileSync(join(PUBLICO, captura.src)).byteLength;

      expect(peso).toBeLessThan(40 * KB);
    },
  );

  it('leaves no file in /capturas that the page does not use', () => {
    const archivos = readdirSync(join(PUBLICO, 'capturas')).map((nombre) => `/capturas/${nombre}`);

    expect(archivos.sort()).toEqual(entradas.map(([, captura]) => captura.src).sort());
  });

  it('has a description for each one, written for who cannot see it, and none for what is not shown', () => {
    expect(Object.keys(contenido.capturas).sort()).toEqual(Object.keys(CAPTURAS).sort());
    for (const [id, descripcion] of Object.entries(contenido.capturas)) {
      expect(descripcion.length, id).toBeGreaterThanOrEqual(40);
      expect(descripcion, id).toMatch(/^Pantalla d/);
    }
  });
});
