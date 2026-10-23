import { describe, expect, it } from 'vitest';
import {
  nombreDeArchivo,
  YA_CORRESPONDEN,
  type Estado,
  type Personaje,
} from '../assets/mascotas/mascotas';
import { EN_PANTALLA } from './en-pantalla';
import { imagenDePantalla } from './imagenes-de-pantalla';

const PARES = (Object.keys(EN_PANTALLA) as (keyof typeof EN_PANTALLA)[]).flatMap((personaje) =>
  EN_PANTALLA[personaje].map((estado) => [personaje, estado] as [Personaje, Estado]),
);

// La lista dice las caras como texto; el compilador ya revisa que `MascotaDePantalla` solo pida las que tienen dibujo.
const imagen = imagenDePantalla as (personaje: Personaje, estado: Estado) => string;

describe('the sprites the app ships', () => {
  it('lists the six faces the three screens use, and no more: every extra sprite is downloaded at install', () => {
    expect(PARES).toEqual([
      ['ori', 'normal'],
      ['ori', 'dormida'],
      ['gato', 'normal'],
      ['gato', 'feliz'],
      ['gato', 'dormida'],
      ['fungito', 'dormida'],
    ]);
  });

  it.each(PARES)(
    '%s, %s is a state the product already does (YA_CORRESPONDEN)',
    (personaje, estado) => {
      expect(YA_CORRESPONDEN[personaje]).toContain(estado);
    },
  );

  it.each(PARES)('finds the sprite of %s, %s', (personaje, estado) => {
    const direccion = imagen(personaje, estado);

    expect(direccion).toContain(nombreDeArchivo(personaje, estado).replace('.webp', ''));
    expect(direccion).toMatch(/\.webp(\?.*)?$/);
  });

  it('gives a different image to each face: a state that shows another one is a lie', () => {
    const direcciones = PARES.map(([personaje, estado]) => imagen(personaje, estado));

    expect(new Set(direcciones).size).toBe(PARES.length);
  });
});
