import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ESTADOS,
  ETIQUETA_DEL_ESTADO,
  NOMBRES,
  PERSONAJES,
  YA_CORRESPONDEN,
  descripcionDeMascota,
  nombreDeArchivo,
  type Estado,
  type Personaje,
} from '../../src/presentation/assets/mascotas/mascotas';

// Las cinco mascotas son de Diego (22 de octubre de 2026) y sus historias prometen mas de lo que VSD Stock hace hoy: factura
// electronica, cuentas por cobrar, copias en la nube, varias sucursales. El Ciclo 4 las usa solo donde el producto ya hace lo
// que muestran (PLAN-CICLO-4, regla 3). Estas pruebas vigilan eso en tres lugares: la tabla de `docs/mascotas.md`, los textos
// que salen en pantalla (nombres y descripciones) y la lista de estados que ya son verdad.
const DOC = readFileSync(join(import.meta.dirname, '..', '..', 'docs', 'mascotas.md'), 'utf8');

/** Lo que decidimos el 22 de octubre de 2026, escrito aqui aparte para que cambiarlo en el codigo sin pensarlo falle. */
const ASI_LO_DECIDIMOS: Record<Personaje, readonly Estado[]> = {
  fungito: ['normal', 'feliz', 'dormida'],
  sparky: ['normal', 'dormida'],
  ori: ['normal', 'feliz', 'dormida'],
  gato: ['normal', 'feliz', 'dormida'],
  obsidian: ['normal', 'feliz', 'dormida'],
};

const PARES = PERSONAJES.flatMap((personaje) =>
  ESTADOS.map((estado) => [personaje, estado] as const),
);

// Lo que las historias prometen y el producto no hace. Aparece en el documento solo bajo el titulo que lo dice, y nunca en lo
// que se muestra en pantalla.
const PROMESAS: readonly RegExp[] = [
  /factura(s|ci[oó]n)? electr[oó]nic/i,
  /\bDIAN\b/,
  /cuentas? por cobrar/i,
  /copias? (autom[aá]ticas|de seguridad|en la nube)/i,
  /\bnube\b/i,
  /sucursal/i,
  /cifrad/i,
  /lectura Z/i,
  /r[eé]cord/i,
  /[oó]rdenes? de compra/i,
  /fraude/i,
  /recordatorio/i,
  /rotaci[oó]n/i,
  /contabilidad/i,
  /reportes?\b/i,
];

// Lo que VSD Health agrega encima de sus mascotas y que aqui no va: las frases de apoyo emocional, las lineas de ayuda y el
// vocabulario del bienestar. VSD Stock vende a un mostrador, no acompana a nadie en su salud.
const DE_HEALTH: readonly RegExp[] = [
  /un paso peque[ñn]o/i,
  /tu valor no depende/i,
  /mereces tratarte/i,
  /darte una pausa/i,
  /hacerlo perfecto/i,
  /pedir apoyo/i,
  /tus sue[ñn]os/i,
  /l[ií]neas? de (ayuda|apoyo)/i,
  /\b(192|123|106)\b/,
  /\b(ansiedad|estr[eé]s|burnout|meditaci[oó]n|salud mental)\b/i,
];

const TITULO_DE_LO_QUE_FALTA = 'Lo que las historias prometen y el producto todavía no hace';

/** El documento sin la seccion que habla de lo que falta: ahi si pueden nombrarse las promesas. */
function documentoSinLoQueFalta(): string {
  const partes = DOC.split(/^## /m);
  return partes.filter((parte) => !parte.startsWith(TITULO_DE_LO_QUE_FALTA)).join('## ');
}

/** Las filas de las tablas por personaje: `| estado | dibujo | cuando | ¿ya lo hace? |` bajo `## Nombre`. */
function filasDelDocumento(): Map<string, { cuando: string; yaLoHace: string }> {
  const filas = new Map<string, { cuando: string; yaLoHace: string }>();
  let nombre: string | null = null;
  for (const linea of DOC.split('\n')) {
    const titulo = /^## (.+)$/.exec(linea);
    if (titulo) nombre = titulo[1]?.trim() ?? null;
    const celdas = linea.split('|').map((celda) => celda.trim());
    const estado = celdas[1];
    if (
      nombre !== null &&
      celdas.length >= 6 &&
      estado !== undefined &&
      estado in ETIQUETA_DEL_ESTADO
    ) {
      filas.set(`${nombre}/${estado}`, {
        cuando: celdas[3] ?? '',
        yaLoHace: celdas[4] ?? '',
      });
    }
  }
  return filas;
}

describe('the five characters', () => {
  it('are Fungito, Sparky, Ori, Ojo de Gato and Obsidian, with four states each', () => {
    expect([...PERSONAJES].sort()).toEqual(['fungito', 'gato', 'obsidian', 'ori', 'sparky']);
    expect([...ESTADOS]).toEqual(['normal', 'feliz', 'celebrando', 'dormida']);
    expect(Object.values(NOMBRES).sort()).toEqual(
      ['Fungito', 'Obsidian', 'Ojo de Gato', 'Ori', 'Sparky'].sort(),
    );
  });

  it('name each sprite file as character, a dash and the state', () => {
    expect(nombreDeArchivo('gato', 'celebrando')).toBe('gato-celebrando.webp');
    expect(nombreDeArchivo('ori', 'dormida')).toBe('ori-dormida.webp');
  });

  it('are described by their name and by what they do, never by a bare "normal"', () => {
    expect(descripcionDeMascota('ori', 'dormida')).toBe('Ori, durmiendo');
    expect(descripcionDeMascota('gato', 'normal')).toBe('Ojo de Gato, con gesto tranquilo');
    expect(descripcionDeMascota('fungito', 'feliz')).toBe('Fungito, feliz');
    expect(descripcionDeMascota('sparky', 'celebrando')).toBe('Sparky, celebrando');
  });

  it.each(PARES)('%s, %s has a description of its own', (personaje, estado) => {
    const otras = PARES.filter(([p, e]) => p !== personaje || e !== estado).map(([p, e]) =>
      descripcionDeMascota(p, e),
    );

    expect(descripcionDeMascota(personaje, estado)).not.toBe('');
    expect(otras).not.toContain(descripcionDeMascota(personaje, estado));
  });
});

describe('which states are already true', () => {
  it('are the ones decided on 22 October 2026, and no more', () => {
    expect(YA_CORRESPONDEN).toEqual(ASI_LO_DECIDIMOS);
  });

  it('never include the celebrating state: nothing in the product detects a record, a block or a perfect count yet', () => {
    for (const personaje of PERSONAJES) {
      expect(YA_CORRESPONDEN[personaje]).not.toContain('celebrando');
    }
  });

  it('keep Ori asleep as the offline state and Sparky asleep as the demo waking up: the two that were already true', () => {
    expect(YA_CORRESPONDEN.ori).toContain('dormida');
    expect(YA_CORRESPONDEN.sparky).toContain('dormida');
  });
});

describe('docs/mascotas.md', () => {
  it('has a section for each character, with the name as its title', () => {
    for (const nombre of Object.values(NOMBRES)) {
      expect(DOC, nombre).toMatch(new RegExp(`^## ${nombre}$`, 'm'));
    }
  });

  it.each(PARES)(
    'says, for %s in state %s, when it shows up and whether the product already does it',
    (personaje, estado) => {
      const fila = filasDelDocumento().get(`${NOMBRES[personaje]}/${estado}`);

      expect(fila, 'falta la fila en la tabla del personaje').toBeDefined();
      expect(fila?.cuando.length ?? 0).toBeGreaterThan(10);
      expect(fila?.yaLoHace).toBe(YA_CORRESPONDEN[personaje].includes(estado) ? 'Sí' : 'No');
    },
  );

  it('has a section for what the stories promise and the product does not do yet, with the five promises Diego wrote', () => {
    expect(DOC).toContain(`## ${TITULO_DE_LO_QUE_FALTA}`);
    const seccion =
      DOC.split(/^## /m).find((parte) => parte.startsWith(TITULO_DE_LO_QUE_FALTA)) ?? '';

    for (const promesa of [
      /factura(ci[oó]n)? electr[oó]nica/i,
      /cuentas por cobrar/i,
      /nube/i,
      /sucursal/i,
    ]) {
      expect(seccion).toMatch(promesa);
    }
  });

  it.each(PROMESAS.map((promesa) => [String(promesa), promesa] as const))(
    'only names %s under the title of what is not done yet',
    (_nombre, promesa) => {
      expect(documentoSinLoQueFalta()).not.toMatch(promesa);
    },
  );

  it.each(DE_HEALTH.map((frase) => [String(frase), frase] as const))(
    'does not bring %s from VSD Health',
    (_nombre, frase) => {
      expect(DOC).not.toMatch(frase);
    },
  );
});

describe('what the characters say on screen', () => {
  const textos = [
    ...Object.values(NOMBRES),
    ...Object.values(ETIQUETA_DEL_ESTADO),
    ...PARES.map(([personaje, estado]) => descripcionDeMascota(personaje, estado)),
  ];

  it.each(PROMESAS.map((promesa) => [String(promesa), promesa] as const))(
    'never promises %s',
    (_nombre, promesa) => {
      for (const texto of textos) expect(texto).not.toMatch(promesa);
    },
  );

  it.each(DE_HEALTH.map((frase) => [String(frase), frase] as const))(
    'never says %s from VSD Health',
    (_nombre, frase) => {
      for (const texto of textos) expect(texto).not.toMatch(frase);
    },
  );
});
