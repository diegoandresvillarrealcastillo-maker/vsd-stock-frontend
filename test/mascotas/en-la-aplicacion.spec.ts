import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOMBRES, type Personaje } from '../../src/presentation/assets/mascotas/mascotas';
import { EN_PANTALLA } from '../../src/presentation/mascotas/en-pantalla';

// C4-M3: las mascotas entran a la aplicacion en TRES pantallas con sentido y en ningun otro lado. Lo que esta prueba vigila es
// la decision, no el dibujo: que una pantalla nueva (o un cambio de prisa) no meta una mascota donde no debe, y que el documento
// diga lo mismo que el codigo. Lee el codigo como texto, igual que `test/pwa/arranque.spec.ts`.
const RAIZ = join(import.meta.dirname, '..', '..');
const PRESENTACION = join(RAIZ, 'src', 'presentation');

/** Todos los archivos de codigo de una carpeta (sin las pruebas), con su ruta desde `src/presentation`. */
function codigoDe(carpeta: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...codigoDe(ruta));
    else if (/\.tsx?$/.test(entrada.name) && !/\.spec\.tsx?$/.test(entrada.name)) {
      encontrados.push(relative(PRESENTACION, ruta).split('\\').join('/'));
    }
  }
  return encontrados.sort();
}

const leer = (ruta: string) => readFileSync(join(PRESENTACION, ruta), 'utf8');
const CODIGO = codigoDe(PRESENTACION);

/** Lo que cada pantalla le pide a la mascota, con el personaje que es y como la llama el documento: asi no se cambia de lugar sin que alguien lo decida. */
const PANTALLAS: Readonly<Record<string, { personaje: Personaje; nombre: string }>> = {
  'components/ConnectionPanel.tsx': { personaje: 'ori', nombre: 'Panel de la conexión' },
  'pages/CloseShiftPage.tsx': { personaje: 'gato', nombre: 'Cerrar turno' },
  'pages/CatalogPage.tsx': { personaje: 'fungito', nombre: 'Catálogo' },
};

describe('where the mascots show up in the app (C4-M3)', () => {
  it('are in three screens only: the connection panel, closing the shift and the empty catalog', () => {
    const conMascota = CODIGO.filter((ruta) => leer(ruta).includes('<MascotaDePantalla'));

    expect(conMascota).toEqual(Object.keys(PANTALLAS).sort());
  });

  it.each(Object.entries(PANTALLAS).map(([ruta, { personaje }]) => [ruta, personaje] as const))(
    '%s asks for %s and for no other character',
    (ruta, personaje) => {
      const personajes = [...leer(ruta).matchAll(/personaje="(\w+)"/g)].map((m) => m[1]);

      expect(personajes.length).toBeGreaterThan(0);
      expect(new Set(personajes)).toEqual(new Set([personaje]));
    },
  );

  it('are never in the flow of charging: not in selling, not in paying, not in the receipt, not at the counter', () => {
    const cobrar = CODIGO.filter(
      (ruta) =>
        [
          'pages/SellPage.tsx',
          'pages/PayPage.tsx',
          'pages/ReceiptPage.tsx',
          'pages/CounterPage.tsx',
        ].includes(ruta) || ruta.startsWith('selling/'),
    );

    expect(cobrar.length).toBeGreaterThanOrEqual(7);
    for (const ruta of cobrar) {
      expect(leer(ruta), ruta).not.toMatch(/Mascota|assets\/mascotas/);
    }
  });

  it('go through MascotaDePantalla: nobody in the app imports the component with the 20 sprites', () => {
    // `Mascota` e `imagenes` traen los 20 dibujos: el service worker guarda todo `dist/`, y cada dibujo de mas se baja al instalar.
    const importaTodo = /from\s+'[^']*assets\/mascotas\/(Mascota|imagenes)'/;
    const fuera = CODIGO.filter((ruta) => !ruta.startsWith('assets/mascotas/'));

    for (const ruta of fuera) {
      expect(leer(ruta), ruta).not.toMatch(importaTodo);
    }
  });

  it('can be turned off from both frames, the administration and the counter', () => {
    for (const marco of ['shell/AppShell.tsx', 'shell/CounterShell.tsx']) {
      expect(leer(marco), marco).toContain('<MascotasToggle />');
    }
  });

  it('ship only the faces the three screens use, so the installed app does not download the rest', () => {
    const caras = Object.entries(EN_PANTALLA).flatMap(([personaje, estados]) =>
      estados.map((estado) => `${personaje}-${estado}`),
    );
    const imagenes = leer('mascotas/imagenes-de-pantalla.ts');
    const importados = [
      ...imagenes.matchAll(/from\s+'\.\.\/assets\/mascotas\/([\w-]+)\.webp'/g),
    ].map((m) => m[1]);

    expect(importados.sort()).toEqual(caras.sort());
  });
});

describe('docs/mascotas.md on the app', () => {
  const DOC = readFileSync(join(RAIZ, 'docs', 'mascotas.md'), 'utf8');
  const SECCION = 'Dónde aparecen en la aplicación';
  const seccion = DOC.split(/^## /m).find((parte) => parte.startsWith(SECCION)) ?? '';
  const PERSONAJE_DE: ReadonlyMap<string, Personaje> = new Map(
    (Object.entries(NOMBRES) as [Personaje, string][]).map(([personaje, nombre]) => [
      nombre,
      personaje,
    ]),
  );

  const PANTALLA_DE = new Map(Object.values(PANTALLAS).map((p) => [p.personaje, p.nombre]));

  /** Las filas `| Mascota | Pantalla | Estado | Cuándo |` de la tabla de la seccion, como `personaje/estado/pantalla`. */
  function filas(): string[] {
    return seccion
      .split('\n')
      .map((linea) => linea.split('|').map((celda) => celda.trim()))
      .filter((celdas) => celdas.length >= 6 && PERSONAJE_DE.has(celdas[1] ?? ''))
      .map((celdas) => `${PERSONAJE_DE.get(celdas[1] ?? '')}/${celdas[3]}/${celdas[2]}`);
  }

  it('has a section that says where they show up', () => {
    expect(seccion).not.toBe('');
  });

  it('lists the same faces as the code, one row each, and names the screen that shows them', () => {
    const delCodigo = (Object.entries(EN_PANTALLA) as [Personaje, readonly string[]][]).flatMap(
      ([personaje, estados]) =>
        estados.map((estado) => `${personaje}/${estado}/${PANTALLA_DE.get(personaje)}`),
    );

    expect(filas().sort()).toEqual(delCodigo.sort());
  });

  it('says they can be turned off, that they are not in the flow of charging and that they stay still for who asked for less motion', () => {
    expect(seccion).toMatch(/apagar|apaga/i);
    expect(seccion).toMatch(/cobrar/i);
    expect(seccion).toMatch(/menos movimiento/i);
  });
});
