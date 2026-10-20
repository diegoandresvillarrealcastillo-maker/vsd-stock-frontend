import type { SaleStatus } from '../../domain/model/sales-history';

/** El color de la etiqueta de cada estado de una venta. El color acompaña: lo que dice la etiqueta está siempre escrito. */
export const STATUS_TONES: Record<SaleStatus, 'success' | 'neutral' | 'warning' | 'muted'> = {
  sent: 'success',
  attention: 'warning',
  reviewed: 'neutral',
  voided: 'muted',
};
