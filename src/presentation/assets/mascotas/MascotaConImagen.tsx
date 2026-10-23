import { descripcionDeMascota, type Estado, type Personaje } from './mascotas';

export interface MascotaProps {
  personaje: Personaje;
  estado: Estado;
  /** Lado en pixeles. El arte mide 256: 128 se ve nitido en pantallas de doble densidad; los multiplos de 64 tambien. */
  tamano?: number;
  /** Carga al instante, para la que es lo primero que se ve. Por defecto espera a estar cerca de la pantalla. */
  inmediata?: boolean;
  className?: string;
}

/**
 * La imagen de una mascota con la cara que le toca (C4-M1), ya con su direccion. Es lo que tienen en comun `Mascota` (la landing,
 * con los 20 dibujos) y `MascotaDePantalla` (la aplicacion, solo con los que usa): vive aparte de `imagenes.ts` para que quien
 * la use no traiga, sin quererlo, los dibujos que no necesita. Un dibujo de mas no es gratis en la aplicacion: el service
 * worker guarda todo `dist/` y cada dibujo se baja al instalar.
 *
 * El texto alternativo dice quien es y que hace, el CSS (`.mascota`) deja los pixeles nitidos y la mueve unos segundos solo
 * para quien no pidio menos movimiento.
 */
export function MascotaConImagen({
  src,
  personaje,
  estado,
  tamano = 128,
  inmediata = false,
  className,
}: MascotaProps & { src: string }) {
  return (
    <img
      src={src}
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
