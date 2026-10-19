import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { formatMoment, formatTime } from '../../domain/model/moment';
import { can } from '../../domain/model/permissions';
import { formatPesos } from '../../domain/model/quantity';
import { methodLabel } from '../../domain/model/sale-payment';
import { receiptLineLabel } from '../../domain/model/sale-receipt';
import {
  attentionNotes,
  parseReason,
  saleLineAmount,
  saleStatus,
  statusLabel,
  type SaleDetail,
} from '../../domain/model/sales-history';
import { Badge } from '../components/Badge';
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
import { useReadCopy } from '../copy/ReadCopyProvider';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { useSales } from '../sales/SalesProvider';
import { STATUS_TONES } from '../sales/status-tone';
import { useSellerNames } from '../sales/use-seller-names';
import { useShift } from '../shift/ShiftProvider';
import { SummaryCard, type SummaryRow } from '../shift/SummaryCard';

/** Marca la venta como revisada, con una nota si se quiere. La venta no cambia: solo sale de la bandeja. */
function ReviewForm({ saleId, onReviewed }: { saleId: string; onReviewed: () => void }) {
  const { history } = useSales();
  const { pending, problem, submit, clear } = useSubmit();
  const [note, setNote] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseReason(note, { required: false });
    if (!parsed.ok) {
      setInvalid(parsed.message);
      focusField('nota');
      return;
    }
    setInvalid(null);
    void submit(async () => {
      await history.review(saleId, parsed.value);
      onReviewed();
    });
  }

  return (
    <>
      {problem !== null && (
        <FormAlert title="No pudimos marcar la venta como revisada">{problem.message}</FormAlert>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="nota"
          label="Nota (opcional)"
          autoComplete="off"
          value={note}
          onChange={(value) => {
            setNote(value);
            setInvalid(null);
            clear();
          }}
          disabled={pending}
          hint="Queda escrita con la revisión."
          {...(invalid === null ? {} : { error: invalid })}
        />
        <SubmitButton pending={pending}>Marcar como revisada</SubmitButton>
      </form>
    </>
  );
}

/** Lo que se hizo con la venta, dicho en una frase: quien, cuando y, si lo escribio, por que. */
function done(
  what: string,
  at: Date,
  who: string,
  extra: { readonly label: string; readonly text: string | null },
): string {
  // Lo escrito puede ya traer su punto: la frase no lo repite.
  const text =
    extra.text === null
      ? ''
      : ` ${extra.label}: ${extra.text}${/[.!?…]$/.test(extra.text) ? '' : '.'}`;
  return `${what} el ${formatMoment(at)} por ${who}.${text}`;
}

function SaleView({ sale, onReviewed }: { sale: SaleDetail; onReviewed: () => void }) {
  const { active } = useLocal();
  const { state: shift } = useShift();
  const copy = useReadCopy();
  const role = active?.profile.role ?? null;
  const manager = role !== null && can(role, 'sale:view-all');
  const nameOf = useSellerNames(manager);

  if (role === null) return null;

  const status = saleStatus(sale);
  const notes = attentionNotes(sale);
  const here =
    (shift.status === 'open' || shift.status === 'closed') && shift.shift.shiftId === sale.shiftId
      ? shift.shift
      : null;
  const when = `${formatTime(sale.occurredAt)} · ${nameOf(sale.userId)}${here === null ? '' : ` · Turno de las ${formatTime(new Date(here.openedAt))}`}`;

  const rows: SummaryRow[] = [
    ...sale.lines.map((line) => {
      const product = copy.product(line.productId);
      return {
        label: receiptLineLabel({
          name: product?.name ?? 'Producto',
          quantityMilli: line.quantityMilli,
          unit: product?.unit ?? 'unit',
          unitPrice: line.unitPrice,
          discount: line.discount,
          total: saleLineAmount(line),
        }),
        value: formatPesos(saleLineAmount(line)),
      };
    }),
    { label: 'Base sin IVA', value: formatPesos(sale.summary.base), divider: true },
    ...sale.summary.byRate
      .filter((rate) => rate.tax > 0)
      .map((rate) => ({
        label: `IVA ${String(rate.rateBp / 100)} % incluido`,
        value: formatPesos(rate.tax),
      })),
    { label: 'Total', value: formatPesos(sale.summary.total), strong: true },
    ...sale.payments.map((payment) => ({
      label: `${methodLabel(payment.method)}${payment.reference === null ? '' : ` · ${payment.reference}`}`,
      value: formatPesos(payment.amount),
    })),
  ];

  // La existencia que falta ajustar: la de lo que quedo en cero o menos. Si la copia no sabe de ninguno, se ofrecen los que no conoce.
  const products = [...new Set(sale.lines.map((line) => line.productId))];
  const levels = products.map((id) => ({ id, left: copy.stockOf(id) }));
  const empty = levels.filter(({ left }) => left !== null && left <= 0).map(({ id }) => id);
  const unknown = levels.filter(({ left }) => left === null).map(({ id }) => id);
  const mayAdjust = sale.needsAdjustment && can(role, 'stock:adjust');
  const toAdjust = !mayAdjust ? [] : empty.length > 0 ? empty : unknown;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">{`Venta ${sale.folio}`}</h1>
        <div>
          <Badge tone={STATUS_TONES[status]}>{statusLabel(status)}</Badge>
        </div>
        <p className="text-base text-fg-muted">{when}</p>
      </div>

      <SummaryCard name="Comprobante" rows={rows} />

      {notes.length > 0 && (
        <Callout tone={sale.attention ? 'warn' : 'info'} title="Qué pasó">
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Callout>
      )}
      {sale.review !== null && (
        <p className="text-sm text-fg-muted">
          {done('Revisada', sale.review.reviewedAt, nameOf(sale.review.reviewedByUserId), {
            label: 'Nota',
            text: sale.review.note,
          })}
        </p>
      )}
      {sale.voided !== null && (
        <p className="text-sm text-fg-muted">
          {done('Anulada', sale.voided.voidedAt, nameOf(sale.voided.voidedByUserId), {
            label: 'Motivo',
            text: sale.voided.reason,
          })}
        </p>
      )}

      {toAdjust.map((productId) => {
        const name = copy.product(productId)?.name ?? 'Producto';
        return (
          <LinkButton
            key={productId}
            to={`/inventario/${encodeURIComponent(productId)}/ajustar`}
            variant="accent"
          >
            {`Ajustar la existencia de ${name}`}
          </LinkButton>
        );
      })}
      {sale.attention && manager && <ReviewForm saleId={sale.id} onReviewed={onReviewed} />}
      {sale.voided === null && can(role, 'sale:void') && (
        <LinkButton to={`/mostrador/ventas/${sale.id}/anular`}>Anular venta</LinkButton>
      )}
    </>
  );
}

/** Carga la venta de la direccion y la muestra. El aviso de «revisada» vive aqui para que sobreviva a la recarga que lo sigue. */
function SaleDetailLoader({ saleId }: { saleId: string }) {
  const { history, refreshAttention } = useSales();
  const { state, reload } = useLoad(() => history.get(saleId), [saleId]);
  const [reviewed, setReviewed] = useState(false);
  const left = (useLocation().state as { notice?: unknown } | null)?.notice;
  const notice = reviewed ? 'La venta quedó revisada.' : typeof left === 'string' ? left : null;

  return (
    <>
      <Link to="/mostrador/ventas" className="text-sm font-medium text-primary underline">
        Volver a las ventas
      </Link>
      {/* El aviso espera a la venta ya actualizada: se dice junto con lo que cambio, no sobre un esqueleto. */}
      {notice !== null && state.status === 'ready' && (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      )}
      {state.status === 'loading' && <RowsSkeleton label="Cargando la venta…" rows={3} />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar la venta"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && (
        <SaleView
          sale={state.data}
          onReviewed={() => {
            setReviewed(true);
            reload();
            refreshAttention();
          }}
        />
      )}
    </>
  );
}

/**
 * El detalle de una venta que el servidor ya tiene (C3-13, ADR 0027): su comprobante, lo que le paso y lo que se puede hacer con ella
 * segun quien mira. El nombre y la unidad de cada producto salen de la copia local: el servidor da solo su identificador.
 */
export function SaleDetailPage() {
  const { saleId = '' } = useParams();
  // Con otra venta empieza de cero: ni el aviso ni lo escrito en la nota son de la anterior.
  return <SaleDetailLoader key={saleId} saleId={saleId} />;
}
