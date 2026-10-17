import { useState } from 'react';
import { Link } from 'react-router';
import type { Invitation } from '../../domain/model/people';
import { Button } from './Button';

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });

const LINK =
  'inline-flex min-h-touch w-full items-center justify-center rounded-md px-5 text-base font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** El codigo recien hecho. Solo se ve aqui: el servidor guarda su huella y no puede volver a darlo (ADR 0023). */
export function InvitationCodePanel({
  title,
  invitation,
}: {
  title: string;
  invitation: Invitation;
}) {
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');

  async function copy() {
    try {
      await navigator.clipboard.writeText(invitation.code);
      setCopied('yes');
    } catch {
      // Sin permiso o sin portapapeles: se le dice a la persona que lo copie a mano.
      setCopied('failed');
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">{title}</h1>
        <p className="text-base text-fg-muted">
          Pásale este código a {invitation.person.fullName}. Sirve una sola vez y vence el{' '}
          {dateFormat.format(invitation.expiresAt)}.
        </p>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-primary bg-surface-raised p-5">
        <p className="text-sm text-fg-muted">Código de invitación</p>
        <p className="text-xl font-semibold tracking-wider text-fg">{invitation.code}</p>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-accent-text bg-surface-raised p-3">
        <p className="text-base font-medium text-accent-text">Cópialo ahora</p>
        <p className="text-sm text-fg-muted">
          Por seguridad no guardamos el código: después solo podrás crear uno nuevo.
        </p>
      </div>
      <Button onClick={() => void copy()}>Copiar código</Button>
      {copied !== 'no' && (
        <p role="status" className="text-sm text-fg-muted">
          {copied === 'yes'
            ? 'Código copiado.'
            : 'No pudimos copiarlo: selecciónalo y cópialo a mano.'}
        </p>
      )}
      <Link to="/personas" className={`${LINK} bg-accent text-on-accent hover:bg-accent-hover`}>
        Listo
      </Link>
    </section>
  );
}
