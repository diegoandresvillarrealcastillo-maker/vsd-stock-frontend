import { summarizeSync } from '../../domain/model/sync-summary';
import { useAccount } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { StatusCard, TONE_RING, ToneIcon } from '../components/StatusCard';
import { useConnection } from '../connection/ConnectionProvider';
import { useSync } from './SyncProvider';

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
        <span className={`flex ${TONE_RING.ok} border-0`}>
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
    <StatusCard tone={summary.tone} headline={summary.headline} detail={summary.detail}>
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
    </StatusCard>
  );
}
