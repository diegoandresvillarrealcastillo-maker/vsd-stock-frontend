import { summarizeSync, type SyncTone } from '../../domain/model/sync-summary';
import { useAccount } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { AlertIcon, CheckIcon, RefreshIcon } from '../components/icons';
import { useConnection } from '../connection/ConnectionProvider';
import { useSync } from './SyncProvider';

// El color acompana, nunca es lo unico: cada tono tiene su icono y su texto.
const RING: Record<SyncTone, string> = {
  ok: 'border-success text-success',
  info: 'border-fg-muted text-fg-muted',
  warn: 'border-accent-text text-accent-text',
};

function ToneIcon({ tone }: { tone: SyncTone }) {
  if (tone === 'ok') return <CheckIcon />;
  if (tone === 'info') return <RefreshIcon />;
  return <AlertIcon />;
}

/**
 * Dice, sin adornos, lo que el dispositivo ha enviado y lo que no (ADR 0009: nada se pierde en silencio): si todo esta enviado,
 * cuanto espera y por que, cuanto el servidor no acepto y si hay que entrar de nuevo. Es una region `status`: un lector de
 * pantalla anuncia cada cambio por su cuenta. Cuando todo esta en orden ocupa una linea; cuando algo pide atencion, una tarjeta
 * con lo que se puede hacer ahi mismo.
 */
export function SyncStatus() {
  const { state: connection } = useConnection();
  const { state, syncNow } = useSync();
  const { signOut } = useAccount();
  const summary = summarizeSync(connection.status, state);

  if (summary.tone === 'ok') {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-fg-muted">
        <span className={`flex ${RING.ok} border-0`}>
          <ToneIcon tone="ok" />
        </span>
        <p>
          <span className="font-medium text-fg">{summary.headline}</span>
          {summary.detail !== null && <> · {summary.detail}</>}
        </p>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-lg border border-border/45 bg-surface-raised p-4 shadow-sm"
    >
      <div className="flex w-full items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-surface ${RING[summary.tone]}`}
        >
          <ToneIcon tone={summary.tone} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-base font-semibold text-fg">{summary.headline}</p>
          {summary.detail !== null && <p className="text-sm text-fg-muted">{summary.detail}</p>}
        </div>
      </div>
      {summary.action === 'retry' && <Button onClick={syncNow}>Reintentar ahora</Button>}
      {summary.action === 'sign-in' && (
        <Button
          onClick={() => {
            void signOut();
          }}
        >
          Entrar de nuevo
        </Button>
      )}
    </div>
  );
}
