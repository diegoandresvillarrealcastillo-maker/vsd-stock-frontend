import { useState } from 'react';
import { formatTime } from '../../domain/model/moment';
import { formatPesos } from '../../domain/model/quantity';
import { formatDifference } from '../../domain/model/shift';
import type { Confirmation, ShiftState } from '../../domain/ports/in/shifts';
import { useOptionalAccount } from '../auth/AuthProvider';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
import { FormAlert } from '../components/FormAlert';
import { LinkButton } from '../components/LinkButton';
import { Skeleton } from '../components/Skeleton';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { OpenShiftForm } from '../shift/OpenShiftForm';
import { useShift } from '../shift/ShiftProvider';
import { SummaryCard } from '../shift/SummaryCard';

function Heading({ title, children }: { title: string; children: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold text-fg">{title}</h1>
      <p className="text-base text-fg-muted">{children}</p>
    </div>
  );
}

/** El servidor todavia no conoce este dispositivo: el turno que se abriera aqui se rechazaria al enviarlo, asi que no se abre. */
function NotRegistered() {
  const { device, registerDevice } = useLocal();
  const account = useOptionalAccount();
  const online = account?.state.status === 'ready';
  return (
    <div className="flex flex-col gap-3">
      <Callout tone="warn" title="Este equipo todavía no está registrado">
        Conéctate a internet una vez para registrarlo y poder abrir el turno.
      </Callout>
      {online && device !== 'registering' && <Button onClick={registerDevice}>Registrar</Button>}
    </div>
  );
}

/** Lo que el servidor sabe de una operacion del turno, dicho solo cuando hay algo que decir. */
function ServerNote({ closing, opening }: { closing?: Confirmation; opening?: Confirmation }) {
  if (opening === 'attention') {
    return (
      <Callout tone="warn" title="El servidor no aceptó la apertura de este turno">
        La gerencia puede revisarlo en «Requieren atención». Mientras tanto, lo que vendas se guarda
        en este equipo.
      </Callout>
    );
  }
  if (closing === 'attention') {
    return (
      <Callout tone="warn" title="El servidor no aceptó el cierre de este turno">
        La gerencia puede revisarlo en «Requieren atención». Lo que contaste queda guardado en este
        equipo.
      </Callout>
    );
  }
  if (closing === 'waiting') {
    return (
      <Callout tone="info" title="Falta confirmar con el servidor">
        El arqueo definitivo se calcula cuando el servidor reciba todas tus ventas. Mientras tanto,
        este es el de tu dispositivo.
      </Callout>
    );
  }
  if (closing === 'confirmed') {
    return <Callout tone="ok" title="El servidor ya tiene este turno" />;
  }
  return null;
}

function Loading() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="text-base text-fg-muted">Cargando el turno…</p>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function Failed() {
  const { refresh } = useShift();
  return (
    <div className="flex flex-col items-start gap-4">
      <FormAlert title="No pudimos leer el turno de este equipo">
        Lo que hay guardado no se pudo abrir. Inténtalo de nuevo; si sigue igual, avisa a quien
        administra el negocio.
      </FormAlert>
      <Button onClick={refresh}>Reintentar</Button>
    </div>
  );
}

function Open({ state }: { state: Extract<ShiftState, { status: 'open' }> }) {
  const { summary, shift } = state;
  return (
    <>
      <Heading title="Turno de caja">
        {`Abierto desde las ${formatTime(new Date(shift.openedAt))} Todo lo que vendas queda en este turno.`}
      </Heading>
      <SummaryCard
        name="Resumen del turno"
        rows={[
          { label: 'Efectivo inicial', value: formatPesos(summary.openingAmount) },
          {
            label: `Ventas en efectivo (${String(summary.cashCount)})`,
            value: formatPesos(summary.cashAmount),
          },
          {
            label: `Ventas con otro medio (${String(summary.otherCount)})`,
            value: formatPesos(summary.otherAmount),
          },
          {
            label: 'Efectivo esperado en la caja',
            value: formatPesos(summary.expectedAmount),
            strong: true,
          },
        ]}
      />
      <ServerNote opening={state.opening} />
      <div className="flex flex-col gap-3">
        <LinkButton to="/mostrador">Ir a vender</LinkButton>
        <LinkButton to="/mostrador/turno/cerrar" variant="accent">
          Cerrar turno
        </LinkButton>
      </div>
    </>
  );
}

function Closed({
  state,
  registered,
}: {
  state: Extract<ShiftState, { status: 'closed' }>;
  registered: boolean;
}) {
  const { summary, shift } = state;
  const [another, setAnother] = useState<string | null>(null);
  if (another === shift.shiftId) {
    return (
      <>
        <Heading title="Turno de caja">
          No tienes un turno abierto. Ábrelo con el efectivo que hay en la caja.
        </Heading>
        <OpenShiftForm />
      </>
    );
  }
  const closedAt = shift.closing === null ? null : new Date(shift.closing.closedAt);
  return (
    <>
      <Heading title="Turno cerrado">
        {`Abrió a las ${formatTime(new Date(shift.openedAt))} y cerró a las ${closedAt === null ? '' : formatTime(closedAt)}`}
      </Heading>
      <SummaryCard
        name="Resumen del cierre"
        rows={[
          { label: 'Esperado en la caja', value: formatPesos(summary.expectedAmount) },
          { label: 'Contado', value: formatPesos(summary.countedAmount ?? 0) },
          { label: 'Diferencia', value: formatDifference(summary.difference ?? 0), strong: true },
        ]}
      />
      <ServerNote closing={state.closing} />
      {registered ? (
        <Button
          onClick={() => {
            setAnother(shift.shiftId);
          }}
        >
          Abrir otro turno
        </Button>
      ) : (
        <NotRegistered />
      )}
    </>
  );
}

/**
 * El turno de caja de quien trabaja (C3-11, ADR 0026): abrirlo con el efectivo de la caja, ver como va y, cuando se cierra, el
 * arqueo. Todo sale de lo guardado en este equipo, asi que funciona sin conexion.
 */
export function ShiftPage() {
  const { active } = useLocal();
  const { state } = useShift();
  if (active === null) return null;
  const registered = active.deviceCode !== null;

  switch (state.status) {
    case 'loading':
      return <Loading />;
    case 'failed':
      return <Failed />;
    case 'open':
      return <Open state={state} />;
    case 'closed':
      return <Closed state={state} registered={registered} />;
    case 'none':
      return (
        <>
          <Heading title="Turno de caja">
            No tienes un turno abierto. Ábrelo con el efectivo que hay en la caja.
          </Heading>
          {registered ? <OpenShiftForm /> : <NotRegistered />}
        </>
      );
  }
}
