import type { Page } from '../../model/page';
import type { SaleDetail, SaleRecord, SaleReview } from '../../model/sales-history';

/**
 * Qué ventas se piden (C3-13): las de un turno, todas las del negocio (solo quien puede verlas) o la bandeja «Requiere atención»
 * (solo la gerencia).
 */
export type SalesView = 'shift' | 'all' | 'attention';

export interface SalesQuery {
  readonly view: SalesView;
  /** El turno, si la vista es `shift`. */
  readonly shiftId?: string;
  /** El cursor de la página siguiente, tal como lo dio la anterior. */
  readonly cursor?: string;
}

export interface VoidInput {
  /** La llave de idempotencia (ADR 0019): se crea una vez por intento de anular y se repite si hay que reintentarlo. */
  readonly operationId: string;
  /** Por qué se anula, en una línea. */
  readonly reason: string;
  /** Un turno ABIERTO de quien anula, de donde sale el efectivo que se devuelve. Hace falta si la venta tuvo efectivo. */
  readonly shiftId?: string | null;
}

export interface Voided {
  readonly sale: SaleDetail;
  /** `true` si el servidor ya había anulado esta venta con esa llave y repitió su respuesta: del efectivo no salió otra vez. */
  readonly replayed: boolean;
}

/**
 * Puerto de entrada: las ventas que el servidor ya tiene (C3-13, ADR 0027). Todo necesita conexión y todo fallo es un `ApiError`
 * con su clase (ADR 0009). Las ventas que todavía están en este equipo no pasan por aquí: salen de la cola.
 */
export interface SalesHistory {
  /** Una página de ventas, la más nueva primero. */
  list(query: SalesQuery): Promise<Page<SaleRecord>>;
  /** Una venta con sus líneas, sus cobros y su IVA. */
  get(saleId: string): Promise<SaleDetail>;
  /** Anula una venta: la existencia vuelve y el efectivo sale del turno abierto de quien anula. Solo la gerencia. */
  voidSale(saleId: string, input: VoidInput): Promise<Voided>;
  /** Marca como revisada una venta de la bandeja, con una nota si se quiere. No la cambia. Solo la gerencia. */
  review(saleId: string, note: string | null): Promise<SaleReview>;
  /** Cuántas piden atención, hasta un tope: `more` dice que hay más de las que se cuentan. Solo la gerencia. */
  attentionCount(): Promise<{ readonly count: number; readonly more: boolean }>;
}
