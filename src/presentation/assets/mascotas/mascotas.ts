/**
 * Las cinco mascotas de VSD Stock (C4-M1, PLAN-CICLO-4) y lo que dice cada una de sus cuatro caras.
 *
 * Son de Diego, adaptadas a partir de las de VSD Health (Trama, la sexta, se queda alla). El arte vive solo en esta carpeta:
 * la aplicacion y la landing lo toman de aqui y no hay dos copias. Este archivo es datos puros, sin React ni imagenes, para
 * que las pruebas de Node lo lean sin arrastrar el empaquetador; las direcciones de las imagenes estan en `imagenes.ts`.
 */

export const PERSONAJES = ['fungito', 'sparky', 'ori', 'gato', 'obsidian'] as const;
export const ESTADOS = ['normal', 'feliz', 'celebrando', 'dormida'] as const;

export type Personaje = (typeof PERSONAJES)[number];
export type Estado = (typeof ESTADOS)[number];

export const NOMBRES: Readonly<Record<Personaje, string>> = {
  fungito: 'Fungito',
  sparky: 'Sparky',
  ori: 'Ori',
  gato: 'Ojo de Gato',
  obsidian: 'Obsidian',
};

/**
 * Lo que hace cada cara, dicho sin genero (Ori es una grulla, Fungito un hongo) para que valga para los cinco. Es el texto
 * alternativo de la imagen: el estado no puede vivir solo en el dibujo.
 */
export const ETIQUETA_DEL_ESTADO: Readonly<Record<Estado, string>> = {
  normal: 'con gesto tranquilo',
  feliz: 'feliz',
  celebrando: 'celebrando',
  dormida: 'durmiendo',
};

/**
 * Los estados que ya corresponden a algo que el producto hace hoy (PLAN-CICLO-4, regla 3: una mascota solo aparece donde
 * muestra algo cierto). Los demas existen como dibujo, pero ninguna pantalla ni texto los usa hasta que el producto los
 * detecte. Cada fila se explica en `docs/mascotas.md`, y `test/mascotas/historias.spec.ts` comprueba que el documento y esta
 * lista digan lo mismo.
 */
export const YA_CORRESPONDEN: Readonly<Record<Personaje, readonly Estado[]>> = {
  fungito: ['normal', 'feliz', 'dormida'],
  sparky: ['normal', 'dormida'],
  ori: ['normal', 'feliz', 'dormida'],
  gato: ['normal', 'feliz', 'dormida'],
  obsidian: ['normal', 'feliz', 'dormida'],
};

/** El archivo de un dibujo: `ori-dormida.webp`. */
export function nombreDeArchivo(personaje: Personaje, estado: Estado): string {
  return `${personaje}-${estado}.webp`;
}

/** Quien es y que hace, para el texto alternativo: `Ori, durmiendo`. */
export function descripcionDeMascota(personaje: Personaje, estado: Estado): string {
  return `${NOMBRES[personaje]}, ${ETIQUETA_DEL_ESTADO[estado]}`;
}
