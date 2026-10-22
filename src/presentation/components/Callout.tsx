import type { ReactNode } from 'react';
import { TONE_RING, ToneIcon, type StatusTone } from './StatusCard';

/** El borde de la tarjeta: el del tono, para que lo que pide mirar se distinga sin leer, y el texto lo dice igual. */
const BORDER: Record<StatusTone, string> = {
  ok: 'border-success',
  info: 'border-border',
  warn: 'border-accent-text',
};

/**
 * Un aviso dentro de una pantalla: un titular y, debajo, lo que significa. No es una region viva: cambia mientras alguien escribe y
 * no debe leerse en cada tecla. El color acompana, nunca es lo unico: cada tono tiene su icono y su texto.
 */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: StatusTone;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-tone={tone}
      className={`flex items-start gap-3 rounded-lg border-2 bg-surface-raised p-4 ${BORDER[tone]}`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-surface ${TONE_RING[tone]}`}
      >
        <ToneIcon tone={tone} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base font-semibold text-fg">{title}</p>
        {children !== undefined && <div className="text-sm text-fg-muted">{children}</div>}
      </div>
    </div>
  );
}
