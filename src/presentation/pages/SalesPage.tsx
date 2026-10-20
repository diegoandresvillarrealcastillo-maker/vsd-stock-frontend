import { Link, useSearchParams } from 'react-router';
import { formatTime } from '../../domain/model/moment';
import { can } from '../../domain/model/permissions';
import { saleStatus, statusLabel } from '../../domain/model/sales-history';
import type { SalesView } from '../../domain/ports/in/sales-history';
import { Callout } from '../components/Callout';
import { FormAlert } from '../components/FormAlert';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { usePagedLoad } from '../forms/use-paged-load';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { attentionLabel } from '../sales/attention-label';
import { SaleRow } from '../sales/SaleRow';
import { useSales } from '../sales/SalesProvider';
import { STATUS_TONES } from '../sales/status-tone';
import { useLocalSales } from '../sales/use-local-sales';
import { useSellerNames } from '../sales/use-seller-names';
import { useShift } from '../shift/ShiftProvider';

const SUBTITLES: Record<SalesView, string> = {
  shift: 'Las de tu turno de hoy.',
  all: 'Todas las del negocio, la más nueva primero.',
  attention: 'Lo que el servidor aceptó marcado o no aceptó, para que alguien lo mire.',
};

const EMPTY: Record<SalesView, string> = {
  shift: 'Todavía no hay ventas en este turno.',
  all: 'Todavía no hay ventas.',
  attention: 'Todo en orden: ninguna venta pide atención.',
};

const TAB =
  'inline-flex min-h-touch flex-1 items-center justify-center gap-2 rounded-md border px-3 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Las ventas (C3-13, ADR 0027): las de este turno, todas las del negocio y la bandeja «Requiere atención», estas dos solo para quien
 * puede verlas. Lo que el servidor ya tiene viene de la red; lo que todavía está en este equipo (por enviar, o que el servidor no
 * aceptó) sale de la cola, así que se ve también sin conexión.
 */
export function SalesPage() {
  const { active } = useLocal();
  const { history, attention } = useSales();
  const { state: shift } = useShift();
  const [params] = useSearchParams();
  const local = useLocalSales();
  const manager = active !== null && can(active.profile.role, 'sale:view-all');
  const nameOf = useSellerNames(manager);
  const vista = params.get('vista');
  const view: SalesView =
    manager && vista === 'todas' ? 'all' : manager && vista === 'atencion' ? 'attention' : 'shift';
  const shiftId = shift.status === 'open' || shift.status === 'closed' ? shift.shift.shiftId : null;
  const { state, reload } = usePagedLoad(
    (cursor) =>
      view === 'shift' && shiftId === null
        ? Promise.resolve({ items: [], nextCursor: null })
        : history.list({
            view,
            ...(view === 'shift' && shiftId !== null ? { shiftId } : {}),
            ...(cursor === undefined ? {} : { cursor }),
          }),
    [view, shiftId],
  );

  if (active === null) return null;
  const { profile } = active;

  // Lo que está en este equipo y el servidor todavía no tiene: la bandeja solo muestra lo que el servidor no aceptó.
  const known = new Set(
    state.status === 'ready' ? state.items.map((sale) => sale.operationId) : [],
  );
  const here = (view === 'attention' ? local.rejected : [...local.rejected, ...local.waiting])
    .filter((sale) => !known.has(sale.operationId))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const waiting = view === 'shift' && shift.status === 'loading';
  const noShift = view === 'shift' && (shift.status === 'none' || shift.status === 'failed');
  const tabs: { label: string; to: string; view: SalesView }[] = [
    { label: 'Mi turno', to: '/mostrador/ventas', view: 'shift' },
    { label: 'Todas', to: '/mostrador/ventas?vista=todas', view: 'all' },
    { label: 'Atención', to: '/mostrador/ventas?vista=atencion', view: 'attention' },
  ];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-fg">Ventas</h1>
        <p className="text-base text-fg-muted">{SUBTITLES[view]}</p>
      </div>

      {manager && (
        <nav aria-label="Qué ventas ver" className="flex gap-2">
          {tabs.map((tab) => {
            const current = tab.view === view;
            return (
              <Link
                key={tab.view}
                to={tab.to}
                {...(current ? { 'aria-current': 'page' as const } : {})}
                className={`${TAB} ${current ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface-raised text-fg'}`}
              >
                {tab.label}
                {tab.view === 'attention' && attention !== null && attention.count > 0 && (
                  <span>{` ${attentionLabel(attention)}`}</span>
                )}
              </Link>
            );
          })}
        </nav>
      )}

      {here.length > 0 && (
        <ul aria-label="Ventas de este equipo" className="flex flex-col">
          {here.map((sale) => (
            <SaleRow
              key={sale.operationId}
              folio={sale.folio}
              status={
                sale.rejected
                  ? { tone: 'warning', label: 'El servidor no la aceptó' }
                  : { tone: 'neutral', label: 'Por enviar' }
              }
              when={`${formatTime(sale.at)} · ${profile.fullName}`}
              total={sale.total}
            />
          ))}
        </ul>
      )}

      {waiting && <RowsSkeleton label="Cargando el turno…" />}
      {!waiting && noShift && (
        <Callout
          tone="info"
          title={
            shift.status === 'failed'
              ? 'No pudimos leer el turno de este equipo'
              : 'Todavía no abriste un turno en este equipo'
          }
        >
          {shift.status === 'failed'
            ? 'Lo que hay guardado no se pudo abrir. Mira el turno para volver a intentarlo.'
            : 'Las ventas se ven por turno: abre uno para venderlas.'}
        </Callout>
      )}
      {!waiting && noShift && (
        <LinkButton to="/mostrador/turno">
          {shift.status === 'failed' ? 'Ver el turno' : 'Abrir turno'}
        </LinkButton>
      )}

      {!waiting && !noShift && state.status === 'loading' && (
        <RowsSkeleton label="Cargando ventas…" />
      )}
      {!waiting && !noShift && state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar las ventas"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {!waiting && !noShift && state.status === 'ready' && (
        <>
          {state.items.length === 0 && here.length === 0 && (
            <p className="text-base text-fg-muted">{EMPTY[view]}</p>
          )}
          {state.items.length > 0 && (
            <ul aria-label="Ventas" className="flex flex-col">
              {state.items.map((sale) => {
                const status = saleStatus(sale);
                return (
                  <SaleRow
                    key={sale.id}
                    folio={sale.folio}
                    status={{ tone: STATUS_TONES[status], label: statusLabel(status) }}
                    when={`${formatTime(sale.occurredAt)} · ${nameOf(sale.userId)}`}
                    total={sale.total}
                    to={`/mostrador/ventas/${sale.id}`}
                  />
                );
              })}
            </ul>
          )}
          {state.moreProblem !== null && (
            <FormAlert title="No pudimos cargar más">{state.moreProblem.message}</FormAlert>
          )}
          {state.hasMore && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                state.loadMore();
              }}
            >
              <SubmitButton pending={state.loadingMore} variant="accent">
                Cargar más
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </>
  );
}
