import { AnimatePresence, m } from 'framer-motion';
import type { ConnectionState, ConnectionStatus } from '../../domain/model/connection';
import type { StorageProtection } from '../../domain/model/storage-protection';
import { useConnection } from '../connection/ConnectionProvider';
import { useIconSwap, usePulse, useReveal } from '../motion/use-motion';
import { useStorageProtection } from '../pwa/PwaProvider';
import { Button } from './Button';
import { CheckIcon, CloudOffIcon } from './icons';

const CARD =
  'flex flex-col items-start gap-4 rounded-lg border border-border/45 bg-surface-raised p-4 shadow-sm';

// El color acompana, nunca es lo unico: cada estado tiene su icono y su texto.
// Los tres colores cumplen contraste sobre el fondo de la tarjeta (en
// test/design/tokens.spec.ts).
const RING: Record<ConnectionStatus, string> = {
  checking: 'border-fg-muted text-fg-muted',
  online: 'border-success text-success',
  offline: 'border-accent-text text-accent-text',
};

const LABEL: Record<ConnectionStatus, string> = {
  checking: 'Comprobando conexión…',
  online: 'En línea',
  offline: 'Sin conexión',
};

// Lo que se dice de lo guardado en el dispositivo (ADR 0018): si el navegador puede borrarlo, las ventas sin enviar corren
// riesgo y la persona merece saberlo. Mientras no se sabe, no se dice nada.
const STORAGE_NOTE: Record<StorageProtection, string> = {
  unknown: '',
  protected: 'Lo guardado en este dispositivo está protegido.',
  'not-protected':
    'El navegador podría borrar lo guardado si se queda sin espacio. Envía tus ventas pronto.',
  unsupported: 'Este navegador no puede proteger lo guardado en el dispositivo.',
};

const timeFormat = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

// La hora en espanol ya termina en punto ("3:30 p. m."): quien la usa en una
// frase no le agrega otro.
function Time({ at }: { at: Date }) {
  return (
    <time dateTime={at.toISOString()} className="whitespace-nowrap">
      {timeFormat.format(at)}
    </time>
  );
}

function Detail({ state }: { state: ConnectionState }) {
  const { status, confirmedAt } = state;
  if (status === 'checking') {
    return <>Preguntamos al servidor si está disponible.</>;
  }
  if (status === 'online') {
    return (
      <>
        Servidor disponible.
        {confirmedAt !== null && (
          <>
            {' '}
            Confirmado a las <Time at={confirmedAt} />
          </>
        )}
      </>
    );
  }
  return (
    <>
      No pudimos comunicarnos con el servidor.
      {confirmedAt !== null && (
        <>
          {' '}
          Última conexión: <Time at={confirmedAt} />
        </>
      )}
    </>
  );
}

/** El indicador de cada estado: un check, una nube tachada o un punto que pulsa. */
function Indicator({ status }: { status: ConnectionStatus }) {
  const pulse = usePulse();
  if (status === 'online') return <CheckIcon />;
  if (status === 'offline') return <CloudOffIcon />;
  return (
    <m.span
      aria-hidden="true"
      {...(pulse ? { animate: pulse } : {})}
      className="block size-2.5 rounded-full bg-fg-muted"
    />
  );
}

/**
 * Dice si la aplicacion puede hablar con el servidor, confirmado con `GET
 * /health` y no solo con lo que el navegador cree de la red. Es una region
 * `status`: un lector de pantalla anuncia cada cambio por su cuenta. El texto
 * cambia al instante (para que nadie espere una animacion para enterarse) y solo
 * el icono se anima, con transform y opacity.
 */
export function ConnectionPanel() {
  const { state, retry } = useConnection();
  const swap = useIconSwap();
  const reveal = useReveal();
  const { status } = state;
  const storage = useStorageProtection();

  return (
    <div role="status" className={CARD}>
      <div className="flex w-full items-center gap-4">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 bg-surface ${RING[status]}`}
        >
          {/* Sin `initial={false}`: con el, lo que ya esta montado al abrir la pagina (el
              punto de "Comprobando", el primer estado) se pinta directo y nunca pulsa. */}
          <AnimatePresence mode="wait">
            <m.span
              key={status}
              variants={swap}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex"
            >
              <Indicator status={status} />
            </m.span>
          </AnimatePresence>
        </span>
        {/* Reserva el alto de dos lineas de detalle: el panel no salta al cambiar de estado. */}
        <div className="flex min-h-17 min-w-0 flex-1 flex-col justify-center">
          <p className="text-lg font-semibold leading-7 text-fg">{LABEL[status]}</p>
          <p className="text-sm text-fg-muted">
            <Detail state={state} />
          </p>
        </div>
      </div>
      {/* Reserva su linea: el panel no salta cuando el navegador contesta. */}
      <p className="min-h-5 text-sm text-fg-muted">{STORAGE_NOTE[storage]}</p>
      {status === 'offline' && (
        <m.div variants={reveal} initial="hidden" animate="visible">
          <Button onClick={retry}>Reintentar</Button>
        </m.div>
      )}
    </div>
  );
}
