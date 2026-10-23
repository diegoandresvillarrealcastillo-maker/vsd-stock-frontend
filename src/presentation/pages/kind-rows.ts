import { formatPesos } from '../../domain/model/quantity';
import type { KindTotals } from '../../domain/model/sale-receipt';
import type { SummaryRow } from '../shift/SummaryCard';

/** Las filas de lo vendido exento y lo vendido excluido: no llevan IVA y se declaran aparte. Solo las que tienen algo. */
export function kindRows(totals: KindTotals): SummaryRow[] {
  return [
    ...(totals.exempt > 0
      ? [{ label: 'Productos exentos', value: formatPesos(totals.exempt) }]
      : []),
    ...(totals.excluded > 0
      ? [{ label: 'Productos excluidos', value: formatPesos(totals.excluded) }]
      : []),
  ];
}
