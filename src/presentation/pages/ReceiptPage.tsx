import { Navigate } from 'react-router';
import { formatMoment, formatTime } from '../../domain/model/moment';
import { formatPesos } from '../../domain/model/quantity';
import { methodLabel } from '../../domain/model/sale-payment';
import { receiptLineLabel, type SaleReceipt } from '../../domain/model/sale-receipt';
import { Button } from '../components/Button';
import { kindRows } from './kind-rows';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { useOperationState } from '../selling/use-operation-state';
import { useSelling } from '../selling/SellingProvider';
import { SummaryCard, type SummaryRow } from '../shift/SummaryCard';

/** Lo que se dice de donde esta la venta: en este equipo esperando, ya en el servidor, o rechazada por el. */
function savedNote(state: ReturnType<typeof useOperationState>): string {
  if (state === null) return 'Guardada y enviada al servidor.';
  if (state === 'attention') {
    return 'Guardada en este equipo. El servidor no la aceptó: la gerencia puede revisarla.';
  }
  return 'Guardada en este equipo. Se envía cuando haya conexión.';
}

function rowsOf(receipt: SaleReceipt): SummaryRow[] {
  const { summary, payment } = receipt;
  const payments: SummaryRow[] =
    payment.method === 'cash'
      ? [
          { label: 'Efectivo recibido', value: formatPesos(payment.received ?? 0) },
          { label: 'Vuelto', value: formatPesos(payment.change) },
        ]
      : [
          {
            label: `Pagado con ${methodLabel(payment.method).toLowerCase()}`,
            value: formatPesos(summary.total),
          },
          ...(payment.reference === null
            ? []
            : [{ label: 'Referencia', value: payment.reference }]),
        ];
  return [
    ...receipt.lines.map((line) => ({
      label: receiptLineLabel(line),
      value: formatPesos(line.total),
    })),
    { label: 'Base sin IVA', value: formatPesos(summary.base), divider: true },
    ...summary.byRate
      .filter((row) => row.tax > 0)
      .map((row) => ({
        label: `IVA ${String(row.rateBp / 100)} % incluido`,
        value: formatPesos(row.tax),
      })),
    ...kindRows(summary.byKind),
    { label: 'Total', value: formatPesos(summary.total), strong: true },
    ...payments,
  ];
}

/**
 * El comprobante de la venta recien cobrada (C3-12, ADR 0027): lo que se vendio, lo que se cobro y como. **No es una factura**, y lo
 * dice. Dice tambien donde esta la venta: guardada en este equipo y esperando a enviarse, o ya en el servidor.
 */
export function ReceiptPage() {
  const { active } = useLocal();
  const { state: sale, newSale } = useSelling();
  const receipt = sale.receipt;
  const operation = useOperationState(receipt?.operationId ?? '');

  if (active === null) return null;
  if (receipt === null) return <Navigate to="/mostrador" replace />;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-fg">{`Venta ${receipt.folio}`}</h1>
        <p className="text-base text-fg-muted">{savedNote(operation)}</p>
      </div>
      <SummaryCard
        name="Comprobante"
        header={`${formatMoment(new Date(receipt.occurredAt))} · ${receipt.cashier} · Turno de las ${formatTime(new Date(receipt.shiftOpenedAt))}`}
        rows={rowsOf(receipt)}
      />
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
        <p className="text-base font-semibold text-fg">Comprobante de venta — no es factura</p>
        <p className="text-sm text-fg-muted">Es el comprobante de la venta en este equipo.</p>
      </div>
      {/* Sin comprobante la pantalla vuelve sola a la venta: empezar otra es solo cerrar este. */}
      <Button onClick={newSale}>Nueva venta</Button>
    </>
  );
}
