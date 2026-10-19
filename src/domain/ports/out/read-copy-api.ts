import type { Product } from '../../model/catalog';
import type { CopyPage, StockLevel } from '../../model/read-copy';

/** Una pagina que se pide: desde cuando (o todo), donde seguir y de que tamano. */
export interface CopyRequest {
  /** Solo lo que cambio DESPUES de este instante; `null` pide todo. */
  readonly since: Date | null;
  /** El `nextCursor` de la pagina anterior; `null` pide la primera. */
  readonly cursor: string | null;
  readonly limit: number;
}

/**
 * Puerto de salida: la copia de lectura que da el servidor (`GET /v1/sync/products` y `/stock`, ADR 0028). Todo fallo es un
 * `ApiError` con su clase (ADR 0009). Una respuesta que no es el contrato es un fallo pasajero, no datos.
 */
export interface ReadCopyApi {
  products(request: CopyRequest): Promise<CopyPage<Product>>;
  stock(request: CopyRequest): Promise<CopyPage<StockLevel>>;
}
