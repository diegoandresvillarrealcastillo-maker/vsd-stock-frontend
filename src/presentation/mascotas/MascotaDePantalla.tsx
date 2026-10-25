import { MascotaConImagen } from '../assets/mascotas/MascotaConImagen';
import { type EstadoEnPantalla, type PersonajeEnPantalla } from './en-pantalla';
import { imagenDePantalla } from './imagenes-de-pantalla';
import { useMascotas } from './MascotasProvider';

/**
 * Una mascota en una pantalla de la aplicacion (C4-M3). Es la unica puerta por la que las mascotas entran a la aplicacion:
 *
 * - No pinta nada si la persona las apago (`useMascotas`), y vuelve cuando las enciende.
 * - Solo acepta las caras que la aplicacion muestra (`EN_PANTALLA`): el compilador rechaza un personaje o un estado que ninguna
 *   pantalla usa, y con ellos, el dibujo que habria que bajar al instalar.
 * - Mide 64 px: la cuarta parte del arte, nitido en pantallas de doble densidad y chico para un telefono. Carga cuando esta
 *   cerca de la pantalla, y el CSS la mueve unos segundos solo para quien no pidio menos movimiento.
 *
 * Una mascota nunca es lo unico que dice algo: el texto de al lado dice lo mismo, con o sin el dibujo.
 */
export function MascotaDePantalla<P extends PersonajeEnPantalla>({
  personaje,
  estado,
  tamano = 64,
  className,
}: {
  personaje: P;
  estado: EstadoEnPantalla<P>;
  tamano?: number;
  className?: string;
}) {
  const { activas } = useMascotas();
  if (!activas) return null;
  return (
    <MascotaConImagen
      src={imagenDePantalla(personaje, estado)}
      personaje={personaje}
      estado={estado}
      tamano={tamano}
      {...(className === undefined ? {} : { className })}
    />
  );
}
