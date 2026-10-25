import { describe, expect, it } from 'vitest';
import { imagenDeMascota } from './imagenes';
import { ESTADOS, nombreDeArchivo, PERSONAJES } from './mascotas';

const PARES = PERSONAJES.flatMap((personaje) =>
  ESTADOS.map((estado) => [personaje, estado] as const),
);

describe('imagenDeMascota', () => {
  it.each(PARES)('finds the sprite of %s, %s', (personaje, estado) => {
    const direccion = imagenDeMascota(personaje, estado);

    expect(direccion).toContain(nombreDeArchivo(personaje, estado).replace('.webp', ''));
    expect(direccion).toMatch(/\.webp(\?.*)?$/);
  });

  it('gives a different image to each of the 20 pairs: a state that shows another one is a lie', () => {
    const direcciones = PARES.map(([personaje, estado]) => imagenDeMascota(personaje, estado));

    expect(new Set(direcciones).size).toBe(20);
  });
});
