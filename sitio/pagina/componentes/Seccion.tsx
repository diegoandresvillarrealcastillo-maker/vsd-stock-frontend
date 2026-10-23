import type { ReactNode } from 'react';
import { etiqueta as claseEtiqueta } from '../clases';

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
  readonly etiqueta: string;
  readonly titulo: string;
  /** Sobre una banda oscura la etiqueta usa el naranja de la marca, que ahi si se lee. */
  readonly sobreBanda?: boolean;
}

/** La etiqueta y el titulo (h2) con que abre cada seccion. */
export function EncabezadoSeccion({ ancla, etiqueta, titulo, sobreBanda }: EncabezadoProps) {
  return (
    <div className="max-w-3xl">
      <p className={`${claseEtiqueta} ${sobreBanda === true ? 'text-accent' : 'text-accent-text'}`}>
        {etiqueta}
      </p>
      <h2
        id={idTitulo(ancla)}
        className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl"
      >
        {titulo}
      </h2>
    </div>
  );
}
