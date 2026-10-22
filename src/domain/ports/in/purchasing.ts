import type { Page } from '../../model/page';
import type { Purchase, PurchaseLine, PurchaseSummary, Supplier } from '../../model/purchasing';

export interface SupplierInput {
  name: string;
  /** Un telefono, un correo o lo que sirva para llamar. Vacio o `null`: sin contacto. */
  contact?: string | null;
}

/** Solo se manda lo que cambia. `null` borra el contacto. */
export interface SupplierChange {
  name?: string;
  contact?: string | null;
}

export interface NewPurchase {
  /** La llave de idempotencia (ADR 0019): se genera una vez por compra y se repite si hay que reintentarla. */
  operationId: string;
  supplierId?: string | null;
  note?: string | null;
  /** Un producto por linea. */
  lines: readonly PurchaseLine[];
}

export interface Registered {
  readonly purchase: Purchase;
  /** `true` si el servidor ya habia registrado esta compra y repitio su respuesta: la existencia no subio otra vez. */
  readonly replayed: boolean;
}

/**
 * Puerto de entrada: proveedores y compras (ADR 0015 y 0019). Una compra sube la existencia de cada producto en la misma
 * operacion. Todo fallo es un `ApiError` con su clase (ADR 0009).
 */
export interface Purchasing {
  /** Todos los proveedores (un negocio de barrio tiene pocos), con un tope de paginas. */
  listAllSuppliers(): Promise<Supplier[]>;
  createSupplier(input: SupplierInput): Promise<Supplier>;
  updateSupplier(supplierId: string, change: SupplierChange): Promise<Supplier>;
  /** Solo un proveedor sin compras se borra; si no, `supplier-in-use`. */
  deleteSupplier(supplierId: string): Promise<void>;
  /** Una pagina de compras, la mas nueva primero. */
  listPurchases(cursor?: string): Promise<Page<PurchaseSummary>>;
  createPurchase(input: NewPurchase): Promise<Registered>;
}
