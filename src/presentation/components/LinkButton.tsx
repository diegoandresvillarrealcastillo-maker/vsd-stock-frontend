import type { ReactNode } from 'react';
import { Link } from 'react-router';

const BASE =
  'inline-flex min-h-touch w-full items-center justify-center rounded-md px-5 text-base font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const VARIANTS = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover',
} as const;

/** Un enlace con la forma de un boton: lleva a otra pantalla. Mide al menos 44 px de alto (ADR 0008). */
export function LinkButton({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <Link to={to} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}
