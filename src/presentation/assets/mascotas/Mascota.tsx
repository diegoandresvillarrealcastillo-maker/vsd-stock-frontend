import { imagenDeMascota } from './imagenes';
import { MascotaConImagen, type MascotaProps } from './MascotaConImagen';

/**
 * Una mascota con la cara de un estado (C4-M1). Vive junto al arte, y no con los demas componentes, porque la landing
 * (ADR 0033) solo puede importar de la aplicacion esta carpeta y el dominio: asi los dos usan el mismo componente.
 *
 * Trae los 20 dibujos. La aplicacion no la usa: pone sus mascotas con `MascotaDePantalla`, que solo trae las caras que
 * muestra. Una mascota va solo donde el producto ya hace lo que ella muestra (`YA_CORRESPONDEN`, `docs/mascotas.md`).
 */
export function Mascota(props: MascotaProps) {
  return <MascotaConImagen {...props} src={imagenDeMascota(props.personaje, props.estado)} />;
}
