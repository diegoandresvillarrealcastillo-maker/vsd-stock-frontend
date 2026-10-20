import { ApiError } from '../../../domain/model/api-error';
import { parseProduct, type Product } from '../../../domain/model/catalog';
import {
  parseCopyPage,
  parseStockLevel,
  type CopyPage,
  type StockLevel,
} from '../../../domain/model/read-copy';
import type { ApiGateway } from '../../../domain/ports/out/api-gateway';
import type { CopyRequest, ReadCopyApi } from '../../../domain/ports/out/read-copy-api';

/** La copia de lectura de la API (`GET /v1/sync/products` y `/stock`, ADR 0028) por la API de la sesion. */
export class ApiReadCopy implements ReadCopyApi {
  constructor(private readonly api: ApiGateway) {}

  async products(request: CopyRequest): Promise<CopyPage<Product>> {
    return await this.page('/v1/sync/products', request, parseProduct);
  }

  async stock(request: CopyRequest): Promise<CopyPage<StockLevel>> {
    return await this.page('/v1/sync/stock', request, parseStockLevel);
  }

  private async page<T>(
    path: string,
    request: CopyRequest,
    parseItem: (raw: unknown) => T | null,
  ): Promise<CopyPage<T>> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path,
      query: {
        ...(request.since === null ? {} : { since: request.since.toISOString() }),
        ...(request.cursor === null ? {} : { cursor: request.cursor }),
        limit: request.limit,
      },
    });
    const page = response.status === 200 ? parseCopyPage(response.body, parseItem) : null;
    if (page === null) {
      // Un 200 que no es el contrato no es nuestro servidor (un proxy, otra version): se trata como un fallo pasajero.
      throw new ApiError({
        class: 'transient',
        status: response.status,
        problem: null,
        retryAfterMs: null,
      });
    }
    return page;
  }
}
