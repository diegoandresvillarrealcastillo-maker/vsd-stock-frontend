import { domAnimation, LazyMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Carga las funciones de animacion de Framer Motion una sola vez para toda la
 * interfaz. Los componentes usan `m` en lugar de `motion` (ADR 0008, mitigacion
 * de peso); `strict` lanza un error si alguien usa `motion` por descuido, que
 * es justo lo que haria volver a cargar todo el paquete.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
