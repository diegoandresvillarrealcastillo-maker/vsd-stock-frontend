import { useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useLocal } from './LocalWorkspaceProvider';

const BOX =
  'flex flex-col items-start gap-3 rounded-md border border-accent-text bg-surface-raised p-4';

/**
 * Los avisos de lo que impide trabajar sin conexion en este equipo (ADR 0018 y 0016): que el navegador no pueda guardar datos
 * cifrados, que la clave de lo guardado se haya perdido y que el dispositivo no se haya registrado con el servidor. Ninguno
 * impide administrar el negocio con conexion; todos dicen que hacer. No muestra nada si todo esta bien.
 */
export function StorageNotice() {
  const { setup, device, registerDevice, discard } = useLocal();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmDiscard() {
    setBusy(true);
    try {
      await discard();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  if (setup.status === 'unavailable') {
    return (
      <div role="status" className={BOX}>
        <p className="text-base font-medium text-accent-text">
          Este navegador no puede guardar datos de forma segura
        </p>
        <p className="text-sm text-fg-muted">
          Puede ser una ventana privada, una página sin HTTPS o un navegador muy antiguo. Puedes
          seguir administrando tu negocio con conexión, pero el mostrador sin conexión no estará
          disponible aquí.
        </p>
      </div>
    );
  }

  if (setup.status === 'lost-key') {
    return (
      <div role="status" className={BOX}>
        <p className="text-base font-medium text-accent-text">
          No podemos leer lo guardado en este equipo
        </p>
        <p className="text-sm text-fg-muted">
          El navegador borró la clave con la que se protegía y quedaron {String(setup.pending)}{' '}
          {setup.pending === 1 ? 'registro' : 'registros'} sin enviar que ya no se pueden abrir.
          Para seguir trabajando hay que empezar de nuevo con lo guardado vacío.
        </p>
        <Button
          onClick={() => {
            setAsking(true);
          }}
        >
          Empezar de nuevo
        </Button>
        {asking && (
          <ConfirmDialog
            title="¿Empezar de nuevo?"
            cancelLabel="Cancelar"
            confirmLabel="Descartarlos y empezar de nuevo"
            busy={busy}
            onCancel={() => {
              setAsking(false);
            }}
            onConfirm={() => void confirmDiscard()}
          >
            <p>
              Se pierden {String(setup.pending)} {setup.pending === 1 ? 'registro' : 'registros'}{' '}
              que no llegaron al servidor. No se pueden recuperar.
            </p>
          </ConfirmDialog>
        )}
      </div>
    );
  }

  if (device === 'failed') {
    return (
      <div role="status" className={BOX}>
        <p className="text-base font-medium text-accent-text">
          Este equipo todavía no está registrado
        </p>
        <p className="text-sm text-fg-muted">
          El servidor no respondió al registrarlo. Sin ese registro el mostrador no puede numerar
          las ventas. Revisa tu conexión e inténtalo de nuevo.
        </p>
        <Button onClick={registerDevice}>Reintentar</Button>
      </div>
    );
  }

  return null;
}
