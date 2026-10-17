import { m } from 'framer-motion';
import type { ReactNode } from 'react';
import { useTap } from '../motion/use-motion';

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
}

/**
 * Boton principal. Mide al menos 44 px por lado (objetivo tactil, ADR 0008),
 * muestra el foco del teclado con el color del tema y se hunde un poco al
 * presionar, salvo que la persona haya pedido menos movimiento. El color no se
 * anima: solo transform y opacity.
 */
export function Button({ children, onClick }: ButtonProps) {
  const tap = useTap();
  return (
    <m.button
      type="button"
      onClick={onClick}
      {...(tap ? { whileTap: tap } : {})}
      className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-md bg-primary px-5 text-base font-medium text-on-primary shadow-sm hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {children}
    </m.button>
  );
}
