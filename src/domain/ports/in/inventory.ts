import type { StockItem, StockMovement } from '../../model/inventory';
import type { Page } from '../../model/page';

export interface StockFilter {
  /** Nombre, SKU o codigo de barras. */
  search?: string;
  /** `true`: solo los que estan por debajo de su minimo. */
  belowMinimum?: boolean;
  /** `true` solo los activos, `false` solo los archivados; sin esto, todos. */
  active?: boolean;
}

export interface AdjustmentInput {
  /** La llave de idempotencia (ADR 0019): se genera una vez por ajuste y se repite si hay que reintentarlo. */
  operationId: string;
  productId: string;
  /** Cuanto sube (positivo) o baja (negativo) la existencia, en milesimas. No es el saldo nuevo. Nunca cero. */
  deltaMilli: number;
  /** Por que se ajusta. Obligatorio: queda escrito en el historial. */
  reason: string;
}

export interface Adjusted {
  readonly movement: StockMovement;
  /** `true` si el servidor ya habia aplicado este ajuste y repitio su respuesta: la existencia no cambio otra vez. */
  readonly replayed: boolean;
}

/**
 * Puerto de entrada: las existencias del negocio y sus ajustes (ADR 0013). La existencia nunca se edita: un ajuste es un
 * movimiento mas. Todo fallo es un `ApiError` con su clase (ADR 0009).
 */
export interface Inventory {
  /** Una pagina de existencias, por nombre. */
  listStock(filter: StockFilter, cursor?: string): Promise<Page<StockItem>>;
  /** Lo que hay de un producto, o `null` si no se pudo saber. Falla con `product-not-found` si el producto no existe. */
  findStock(productId: string): Promise<StockItem | null>;
  /** Una pagina del historial de un producto, lo mas nuevo primero. */
  listMovements(productId: string, cursor?: string): Promise<Page<StockMovement>>;
  adjust(input: AdjustmentInput): Promise<Adjusted>;
}
