import { Link } from 'react-router';
import { formatPesos } from '../../domain/model/quantity';
import { Badge } from '../components/Badge';

/** Una fila de la lista de ventas: el folio con dónde está, cuándo y de quién, y el total. Si lleva a un detalle, toda la fila es el enlace. */
export function SaleRow({
  folio,
  status,
  when,
  total,
  to,
}: {
  folio: string;
  status: { readonly tone: 'success' | 'neutral' | 'warning' | 'muted'; readonly label: string };
  /** «3:10 p. m. · Ana Gómez». */
  when: string;
  total: number;
  /** La pantalla del detalle; sin él, la fila solo informa (una venta que todavía no está en el servidor no tiene detalle ahí). */
  to?: string;
}) {
  const content = (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-fg">{folio}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
        <span className="text-sm text-fg-muted">{when}</span>
      </span>
      <span className="shrink-0 text-base font-semibold tabular-nums text-fg">
        {formatPesos(total)}
      </span>
    </>
  );
  const LAYOUT = 'flex min-h-touch items-center justify-between gap-3 border-b border-border py-3';
  return (
    <li>
      {to === undefined ? (
        <div className={LAYOUT}>{content}</div>
      ) : (
        <Link
          to={to}
          className={`${LAYOUT} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
        >
          {content}
        </Link>
      )}
    </li>
  );
}
