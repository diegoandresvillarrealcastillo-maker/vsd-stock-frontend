import { useState } from 'react';
import {
  monthLabel,
  monthOfBogota,
  rowLabel,
  shiftMonth,
  type MonthlyReport,
  type ReportSection,
} from '../../domain/model/monthly-report';
import { formatPesos } from '../../domain/model/quantity';
import { methodLabel } from '../../domain/model/sale-payment';
import { Callout } from '../components/Callout';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { useLoad } from '../forms/use-load';
import { useReports } from '../reports/ReportsProvider';
import { SummaryCard } from '../shift/SummaryCard';

const MONTH_BUTTON =
  'inline-flex min-h-touch items-center justify-center rounded-md border border-border bg-surface-raised px-4 text-base font-medium text-fg hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60';

/** Las ventas de un bloque del reporte: los cuatro renglones de la declaracion, lo que suman y como se pagaron. */
function Block({
  title,
  summary,
  intro,
  section,
  names,
}: {
  title: string;
  summary: string;
  intro?: string;
  section: ReportSection;
  names: { list: string; totals: string; total: string; payments: string };
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold text-fg">{title}</h3>
        <p className="text-sm text-fg-muted">{summary}</p>
        {intro !== undefined && <p className="text-sm text-fg-muted">{intro}</p>}
      </div>
      <ul aria-label={names.list} className="flex flex-col">
        {section.rows.map((row) => (
          <li
            key={`${row.taxKind}-${String(row.rateBp)}`}
            className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-base font-medium text-fg">{rowLabel(row)}</p>
              <p className="whitespace-nowrap text-base font-semibold tabular-nums text-fg">
                {formatPesos(row.total)}
              </p>
            </div>
            <p className="text-sm text-fg-muted">
              {row.taxKind === 'taxed'
                ? `Base ${formatPesos(row.base)} · IVA ${formatPesos(row.tax)}`
                : 'Sin IVA'}
            </p>
          </li>
        ))}
      </ul>
      <SummaryCard
        name={names.totals}
        rows={[
          { label: 'Base sin IVA', value: formatPesos(section.base) },
          { label: 'IVA', value: formatPesos(section.tax) },
          { label: names.total, value: formatPesos(section.total), strong: true },
        ]}
      />
      <SummaryCard
        name={names.payments}
        rows={section.payments.map((payment) => ({
          label: methodLabel(payment.method),
          value: formatPesos(payment.amount),
        }))}
      />
    </section>
  );
}

/**
 * Lo que hay que saber antes de usar el reporte (auditoria contable del 25 de octubre de 2026): los cuatro renglones resumen las
 * ventas para el control interno, no alcanzan para preparar la declaracion. Va arriba, antes de cualquier cifra, y se ve aunque el mes
 * no tenga ventas o el reporte no cargue. El reporte lo calcula al pedirlo y elige las ventas por la hora en que ocurrieron: una venta
 * hecha sin conexion que llega despues de cerrar el mes cambia ese mes.
 */
function UseNotice() {
  return (
    <div role="note" aria-label="Para qué sirve este reporte">
      <Callout tone="warn" title="Este reporte es de control interno, no es tu declaración de IVA">
        <div className="flex flex-col gap-2">
          <p>
            No reemplaza la factura electrónica ni la declaración de impuestos. Sirve para ver cómo
            van tus ventas y para dárselo a quien lleva tus cuentas.
          </p>
          <p>
            A la declaración le faltan cosas que este reporte no tiene: tus compras y gastos, el IVA
            que puedes descontar, las retenciones y los períodos de tu declaración (pueden ser de
            dos meses o más). Tu contador lo concilia con sus documentos.
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              No copies el «Total vendido» como tus ingresos: lleva el IVA adentro. Para los
              ingresos usa el valor sin IVA.
            </li>
            <li>
              Si una venta hecha sin conexión llega después de cerrar el mes, ese mes cambia. Antes
              de dárselo a tu contador, conecta todos los equipos y espera a que digan «Todo
              enviado».
            </li>
            <li>
              Exento y excluido salen como los marcaste en cada producto; si dudas de cuál es,
              pregúntale a tu contador. Que un producto sea exento no significa que puedas descontar
              o pedir de vuelta el IVA de tus compras.
            </li>
          </ul>
        </div>
      </Callout>
    </div>
  );
}

function ReportView({ report }: { report: MonthlyReport }) {
  const { sales, voids } = report;
  const label = monthLabel(report.month);
  if (sales.count === 0 && voids.count === 0) {
    return <p className="text-base text-fg-muted">{`En ${label} no hubo ventas.`}</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      {sales.count > 0 && (
        <Block
          title="Ventas del mes"
          summary={sales.count === 1 ? '1 venta' : `${String(sales.count)} ventas`}
          section={sales}
          names={{
            list: 'Ventas por tarifa',
            totals: 'Totales de las ventas',
            total: 'Total vendido',
            payments: 'Cobrado por medio de pago',
          }}
        />
      )}
      {voids.count > 0 && (
        <Block
          title="Anulaciones del mes"
          summary={voids.count === 1 ? '1 venta anulada' : `${String(voids.count)} ventas anuladas`}
          intro={`Las ventas que se anularon en ${label}, aunque se hicieran antes. No se restan de las ventas del mes.`}
          section={voids}
          names={{
            list: 'Anulaciones por tarifa',
            totals: 'Totales de las anulaciones',
            total: 'Total anulado',
            payments: 'Medio de pago de lo anulado',
          }}
        />
      )}
    </div>
  );
}

/**
 * El reporte mensual (ADR 0035 del backend): lo vendido en el mes separado como se declara (gravado al 19 %, gravado al 5 %, exento y
 * excluido), las anulaciones aparte y lo cobrado por medio de pago. Los meses los corta un reloj de Bogota. No resta nada: lo que se
 * anula se ve junto a lo vendido.
 */
export function MonthlyReportPage() {
  const reports = useReports();
  const [current] = useState(() => monthOfBogota(new Date()));
  const [month, setMonth] = useState(current);
  const { state, reload } = useLoad(() => reports.monthly(month), [month]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Reporte mensual</h1>
        <p className="text-base text-fg-muted">
          Lo que vendiste en el mes, separado como lo necesita quien lleva tus cuentas.
        </p>
      </div>
      <UseNotice />
      <div className="flex flex-col gap-3">
        <h2 aria-live="polite" className="text-2xl font-semibold text-fg">
          {monthLabel(month)}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={MONTH_BUTTON}
            onClick={() => {
              setMonth(shiftMonth(month, -1));
            }}
          >
            Mes anterior
          </button>
          <button
            type="button"
            className={MONTH_BUTTON}
            disabled={month >= current}
            onClick={() => {
              setMonth(shiftMonth(month, 1));
            }}
          >
            Mes siguiente
          </button>
        </div>
      </div>
      {state.status === 'loading' && <RowsSkeleton label="Cargando el reporte…" />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar el reporte"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && <ReportView report={state.data} />}
    </section>
  );
}
