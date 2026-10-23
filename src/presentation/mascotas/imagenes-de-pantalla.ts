import fungitoDormida from '../assets/mascotas/fungito-dormida.webp';
import gatoDormida from '../assets/mascotas/gato-dormida.webp';
import gatoFeliz from '../assets/mascotas/gato-feliz.webp';
import gatoNormal from '../assets/mascotas/gato-normal.webp';
import oriDormida from '../assets/mascotas/ori-dormida.webp';
import oriNormal from '../assets/mascotas/ori-normal.webp';
import type { EstadoEnPantalla, PersonajeEnPantalla } from './en-pantalla';

// Un import por dibujo, como en `assets/mascotas/imagenes.ts`, pero solo de las caras de `EN_PANTALLA`: lo que no se importa
// no entra a `dist/`, ni al service worker, ni se baja al instalar. TypeScript obliga a que cada cara de la lista tenga su
// dibujo, y la prueba `test/mascotas/en-la-aplicacion.spec.ts` obliga a lo contrario: que no haya un dibujo que la lista no pide.
const DIRECCIONES: {
  readonly [P in PersonajeEnPantalla]: Readonly<Record<EstadoEnPantalla<P>, string>>;
} = {
  ori: { normal: oriNormal, dormida: oriDormida },
  gato: { normal: gatoNormal, feliz: gatoFeliz, dormida: gatoDormida },
  fungito: { dormida: fungitoDormida },
};

/** La direccion del dibujo de una cara que la aplicacion muestra. El compilador no deja pedir una que no trae. */
export function imagenDePantalla<P extends PersonajeEnPantalla>(
  personaje: P,
  estado: EstadoEnPantalla<P>,
): string {
  return DIRECCIONES[personaje][estado];
}
