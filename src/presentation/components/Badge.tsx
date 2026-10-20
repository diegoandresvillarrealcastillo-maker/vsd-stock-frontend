import type { ReactNode } from 'react';

const TONES = {
  /** El rol de mas responsabilidad. */
  strong: 'border-primary bg-primary text-on-primary',
  neutral: 'border-border bg-surface-raised text-fg',
  /** Algo que pide atencion (una invitacion pendiente, existencia bajo el minimo). */
  warning: 'border-accent-text bg-surface-raised text-accent-text',
  /** Algo que ya no esta activo. */
  muted: 'border-border bg-surface-raised text-fg-muted',
  /** Algo que salio bien (una venta que el servidor ya tiene). */
  success: 'border-success bg-surface-raised text-success',
} as const;

/** Una etiqueta corta (un rol, un estado). El color acompana: lo que dice esta siempre escrito. */
export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
