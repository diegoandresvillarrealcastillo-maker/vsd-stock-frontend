import type { ReactNode } from 'react';

const BASE =
  'inline-flex min-h-touch w-full items-center justify-center rounded-md px-5 text-base font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover',
} as const;

/**
 * El boton que manda un formulario. Mientras se envia dice «Enviando…» (o lo que se le pida) y no deja mandarlo dos veces; usa
 * `aria-busy` para que los lectores de pantalla sepan que algo esta en camino. Mide al menos 44 px de alto (ADR 0008).
 */
export function SubmitButton({
  pending,
  children,
  variant = 'primary',
  pendingLabel = 'Enviando…',
  onClick,
}: {
  pending: boolean;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  /** Lo que dice mientras la accion esta en camino. Lo que se guarda en este equipo no se «envia»: dice «Guardando…». */
  pendingLabel?: string;
  /** Si se da, es un boton comun que hace esto al pulsarlo (una accion que no es un formulario); si no, manda el formulario. */
  onClick?: () => void;
}) {
  return (
    <button
      type={onClick === undefined ? 'submit' : 'button'}
      {...(onClick === undefined ? {} : { onClick })}
      disabled={pending}
      aria-busy={pending}
      className={`${BASE} ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
