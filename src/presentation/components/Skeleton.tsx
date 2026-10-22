import { m } from 'framer-motion';
import { usePulse } from '../motion/use-motion';

/**
 * Bloque gris que ocupa el lugar de un dato mientras carga. Quien lo usa le da
 * el tamano con `className` para que el skeleton reproduzca el diseno real
 * (ADR 0008). Es decoracion: no lo leen los lectores de pantalla, el aviso de
 * "cargando" lo da el contenedor.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  const pulse = usePulse();
  return (
    <m.div
      aria-hidden="true"
      className={`rounded-md bg-skeleton ${className}`}
      animate={pulse ?? false}
    />
  );
}
