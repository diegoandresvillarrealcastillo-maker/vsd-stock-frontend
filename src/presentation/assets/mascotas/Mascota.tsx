import { imagenDeMascota } from './imagenes';
import { descripcionDeMascota, type Estado, type Personaje } from './mascotas';

interface MascotaProps {
  personaje: Personaje;
  estado: Estado;
  /** Lado en pixeles. El arte mide 256: 128 se ve nitido en pantallas de doble densidad; los multiplos de 64 tambien. */
  tamano?: number;
  /** Carga al instante, para la que es lo primero que se ve. Por defecto espera a estar cerca de la pantalla. */
  inmediata?: boolean;
  className?: string;
}

/**
 * Una mascota con la cara de un estado (C4-M1). Vive junto al arte, y no con los demas componentes, porque la landing
 * (ADR 0033) solo puede importar de la aplicacion esta carpeta y el dominio: asi los dos usan el mismo componente.
 *
 * El texto alternativo dice quien es y que hace, el CSS (`.mascota`) deja los pixeles nitidos y la mueve unos segundos solo
 * para quien no pidio menos movimiento. Una mascota va solo donde el producto ya hace lo que ella muestra
 * (`YA_CORRESPONDEN`, `docs/mascotas.md`).
 */
export function Mascota({
  personaje,
  estado,
  tamano = 128,
  inmediata = false,
  className,
}: MascotaProps) {
  return (
    <img
      src={imagenDeMascota(personaje, estado)}
      alt={descripcionDeMascota(personaje, estado)}
      width={tamano}
      height={tamano}
      loading={inmediata ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      data-estado={estado}
      className={className === undefined ? 'mascota' : `mascota ${className}`}
    />
  );
}
