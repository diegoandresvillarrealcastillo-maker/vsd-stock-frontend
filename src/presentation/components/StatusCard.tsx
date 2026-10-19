import type { ReactNode } from 'react';
import { AlertIcon, CheckIcon, RefreshIcon } from './icons';

/** Como se siente lo que se dice: todo en orden, algo avanza solo o alguien tiene que mirar o esperar. */
export type StatusTone = 'ok' | 'info' | 'warn';

// El color acompana, nunca es lo unico: cada tono tiene su icono y su texto.
export const TONE_RING: Record<StatusTone, string> = {
  ok: 'border-success text-success',
  info: 'border-fg-muted text-fg-muted',
  warn: 'border-accent-text text-accent-text',
};

export function ToneIcon({ tone }: { tone: StatusTone }) {
  if (tone === 'ok') return <CheckIcon />;
  if (tone === 'info') return <RefreshIcon />;
  return <AlertIcon />;
}

/**
 * Una tarjeta que dice como esta algo y, si hace falta, lo que se puede hacer ahi mismo (los botones son sus hijos). Es una region
 * `status`: un lector de pantalla anuncia cada cambio por su cuenta.
 */
export function StatusCard({
  tone,
  headline,
  detail,
  children,
}: {
  tone: StatusTone;
  headline: string;
  detail: string | null;
  children?: ReactNode;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-lg border border-border/45 bg-surface-raised p-4 shadow-sm"
    >
      <div className="flex w-full items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-surface ${TONE_RING[tone]}`}
        >
          <ToneIcon tone={tone} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-base font-semibold text-fg">{headline}</p>
          {detail !== null && <p className="text-sm text-fg-muted">{detail}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
