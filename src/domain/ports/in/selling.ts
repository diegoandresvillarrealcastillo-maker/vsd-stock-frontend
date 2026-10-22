import type { Product } from '../../model/catalog';
import type { Cart } from '../../model/sale-cart';
import type { SaleReceipt, SalePayment } from '../../model/sale-receipt';
import type { SaleSummary } from '../../model/sale-totals';

/** Lo que la interfaz sabe de la venta que se esta armando y de la ultima que se cobro. Es el mismo objeto mientras nada cambie. */
export interface SellingState {
  readonly cart: Cart;
  /** El total y el IVA desglosado de lo que hay en el carrito. */
  readonly summary: SaleSummary;
  /** El comprobante de la venta que se acaba de cobrar, hasta que se empieza otra; `null` si no hay. */
  readonly receipt: SaleReceipt | null;
}

/**
 * Puerto de entrada: el punto de venta (C3-12, ADR 0027). Arma la venta de quien trabaja en el mostrador y la cobra sin conexion:
 * guarda la venta en la cola de envio, la suma al turno y le pone su folio en UNA sola transaccion de la base cifrada. La venta que
 * se esta armando vive en memoria y es de una persona: si cambia quien trabaja, se descarta.
 */
export interface Selling {
  current(): SellingState;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
  /** Empieza a vigilar a quien trabaja. Llamarlo otra vez no hace nada. */
  start(): void;
  /** Deja de vigilar. */
  stop(): void;
  /** Agrega una unidad del producto (o abre su linea). Lo archivado o lo que ya no cabe no se agrega. */
  add(product: Product): void;
  /** Lanza `RangeError` si no es una cantidad valida para esa linea. */
  setQuantity(productId: string, quantityMilli: number): void;
  /** Lanza `RangeError` si no es una rebaja valida para esa linea. */
  setDiscount(productId: string, discount: number): void;
  remove(productId: string): void;
  /** Descarta lo que hay en el carrito. */
  clear(): void;
  /**
   * Cobra la venta: el efectivo recibido tiene que cubrir el total. Lanza `EmptySaleError`, `NoWorkspaceError`,
   * `NoOpenShiftError` (no hay turno abierto), `DeviceNotRegisteredError` (el servidor no conoce el dispositivo, y no hay folio) y
   * `RangeError`. Si algo falla, nada queda a medias y el carrito se conserva.
   */
  confirm(payment: SalePayment): Promise<SaleReceipt>;
  /** Cierra el comprobante: se empieza otra venta. */
  newSale(): void;
}
