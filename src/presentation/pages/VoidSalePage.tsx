import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatPesos } from '../../domain/model/quantity';
import { parseReason, type SaleDetail } from '../../domain/model/sales-history';
import { Callout } from '../components/Callout';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { focusField } from '../forms/focus-field';
import { useLoad } from '../forms/use-load';
import { useSubmit } from '../forms/use-submit';
import { useSales } from '../sales/SalesProvider';
import { useShift } from '../shift/ShiftProvider';
import { SummaryCard, type SummaryRow } from '../shift/SummaryCard';

function productsLabel(count: number): string {
  return count === 1 ? '1 producto' : `${String(count)} productos`;
}

function VoidForm({ sale }: { sale: SaleDetail }) {
  const { history, refreshAttention } = useSales();
  const { state: shift } = useShift();
  const navigate = useNavigate();
  const { pending, problem, submit, clear } = useSubmit();
  // La llave de idempotencia (ADR 0019): una por pantalla. Si el envio falla, se reintenta con la misma, y el servidor no anula
  // dos veces aunque la primera respuesta se haya perdido.
  const [operationId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  // El efectivo vuelve de la caja del turno ABIERTO de quien anula (ADR 0026): sin turno abierto no hay de donde sacarlo.
  const cash = sale.payments
    .filter((payment) => payment.method === 'cash')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const shiftId = shift.status === 'open' ? shift.shift.shiftId : null;
  const needsShift = cash > 0 && shiftId === null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseReason(reason, { required: true });
    if (!parsed.ok) {
      setInvalid(parsed.message);
      focusField('motivo');
      return;
    }
    if (parsed.value === null || needsShift) return;
    const written = parsed.value;
    void submit(async () => {
      const result = await history.voidSale(sale.id, { operationId, reason: written, shiftId });
      refreshAttention();
      void navigate(`/mostrador/ventas/${sale.id}`, {
        state: {
          notice: result.replayed
            ? 'Esa venta ya estaba anulada: el efectivo no salió otra vez.'
            : 'La venta quedó anulada.',
        },
      });
    });
  }

  const rows: SummaryRow[] = [
    { label: 'La existencia vuelve a las bodegas', value: productsLabel(sale.lines.length) },
    ...(cash > 0 ? [{ label: 'Sale de tu caja', value: formatPesos(cash) }] : []),
  ];

  return (
    <>
      <div className="flex flex-col gap-1">
        {/* El folio va entero: a 375 px el titulo se parte, y partido en el guion («AB-» / «000007») no se lee. */}
        <h1 className="text-3xl font-semibold text-fg">
          Anular la venta <span className="whitespace-nowrap">{sale.folio}</span>
        </h1>
        <p className="text-base text-fg-muted">La venta no se borra: queda escrita como anulada.</p>
      </div>
      <SummaryCard name="Qué pasa al anular" rows={rows} />
      {needsShift && (
        <>
          <Callout tone="warn" title="Primero abre un turno">
            La venta se pagó con efectivo y ese efectivo sale de la caja de tu turno abierto.
          </Callout>
          <LinkButton to="/mostrador/turno">Abrir turno</LinkButton>
        </>
      )}
      {problem !== null && (
        <FormAlert title="No pudimos anular la venta">{problem.message}</FormAlert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="motivo"
          label="Motivo (obligatorio)"
          autoComplete="off"
          value={reason}
          onChange={(value) => {
            setReason(value);
            setInvalid(null);
            clear();
          }}
          disabled={pending}
          required
          hint="Queda escrito con la anulación."
          {...(invalid === null ? {} : { error: invalid })}
        />
        <SubmitButton pending={pending} disabled={needsShift}>
          Anular venta
        </SubmitButton>
      </form>
    </>
  );
}

function VoidSaleLoader({ saleId }: { saleId: string }) {
  const { history } = useSales();
  const { state, reload } = useLoad(() => history.get(saleId), [saleId]);
  const salePath = `/mostrador/ventas/${saleId}`;

  return (
    <>
      <Link to={salePath} className="text-sm font-medium text-primary underline">
        Volver a la venta
      </Link>
      {state.status === 'loading' && <RowsSkeleton label="Cargando la venta…" rows={3} />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar la venta"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && state.data.voided !== null && (
        <>
          <Callout tone="info" title="Esa venta ya estaba anulada">
            No hay nada más que hacer con ella.
          </Callout>
          <LinkButton to={salePath}>Ver la venta</LinkButton>
        </>
      )}
      {state.status === 'ready' && state.data.voided === null && <VoidForm sale={state.data} />}
    </>
  );
}

/**
 * Anular una venta (C3-13, ADR 0027): la existencia vuelve a las bodegas y el efectivo sale de la caja del turno abierto de quien
 * anula. Pide un motivo, que queda escrito. Solo la gerencia llega aqui (la ruta lo guarda).
 */
export function VoidSalePage() {
  const { saleId = '' } = useParams();
  // Con otra venta, `useLoad` vuelve a «cargando» y el formulario se monta de nuevo: ni el motivo ni la llave de la anterior valen.
  return <VoidSaleLoader saleId={saleId} />;
}
