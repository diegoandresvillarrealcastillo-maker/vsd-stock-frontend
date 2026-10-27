import type { ReactNode } from 'react';

/** El id del titulo de una seccion: la seccion lo nombra con `aria-labelledby` y un lector de pantalla salta de titulo en titulo. */
export const idTitulo = (ancla: string): string => `titulo-${ancla}`;

interface SeccionProps {
  readonly ancla: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/** Una seccion de la pagina: su ancla, su nombre y el margen que deja la navegacion fija al saltar hasta ella. */
export function Seccion({ ancla, className, children }: SeccionProps) {
  return (
    <section
      id={ancla}
      aria-labelledby={idTitulo(ancla)}
      className={`scroll-mt-16 ${className ?? ''}`}
    >
      {children}
    </section>
  );
}

interface EncabezadoProps {
  readonly ancla: string;
  readonly titulo: string;
}

/** El titulo (h2) con que abre cada seccion. Sin etiqueta encima: el titulo ya dice de que trata. */
export function EncabezadoSeccion({ ancla, titulo }: EncabezadoProps) {
  return (
    <h2
      id={idTitulo(ancla)}
      className="max-w-3xl font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl"
    >
      {titulo}
    </h2>
  );
}
