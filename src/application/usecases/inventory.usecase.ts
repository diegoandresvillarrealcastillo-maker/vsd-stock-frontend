import { parseProduct } from '../../domain/model/catalog';
import {
  parseMovement,
  parseStockItem,
  type StockItem,
  type StockMovement,
} from '../../domain/model/inventory';
import { parsePage, type Page } from '../../domain/model/page';
import type {
  Adjusted,
  AdjustmentInput,
  Inventory,
  StockFilter,
} from '../../domain/ports/in/inventory';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';
import { unexpectedAnswer } from './unexpected-answer';

const PAGE_SIZE = 50;
/** Para buscar un producto por su SKU entre las existencias: un SKU parecido a otros puede traer varias. */
const LOOKUP_PAGE_SIZE = 200;

/** Existencias del negocio (ADR 0013) sobre la API. */
export class InventoryUseCase implements Inventory {
  constructor(private readonly api: ApiGateway) {}

  async listStock(filter: StockFilter, cursor?: string): Promise<Page<StockItem>> {
    const search = filter.search?.trim() ?? '';
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/stock',
      query: {
        limit: PAGE_SIZE,
        ...(search === '' ? {} : { search }),
        ...(filter.active === undefined ? {} : { active: filter.active }),
        ...(filter.belowMinimum === undefined ? {} : { belowMinimum: filter.belowMinimum }),
        ...(cursor === undefined ? {} : { cursor }),
      },
    });
    const page = parsePage(response.body, parseStockItem);
    if (page === null) throw unexpectedAnswer(response.status);
    return page;
  }

  async findStock(productId: string): Promise<StockItem | null> {
    // La API no da la existencia de UN producto: se averigua su SKU y se busca entre las existencias.
    const productResponse = await this.api.send<unknown>({
      method: 'GET',
      path: `/v1/products/${encodeURIComponent(productId)}`,
    });
    const product = parseProduct(productResponse.body);
    if (product === null) throw unexpectedAnswer(productResponse.status);
    const stockResponse = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/stock',
      query: { limit: LOOKUP_PAGE_SIZE, search: product.sku },
    });
    const page = parsePage(stockResponse.body, parseStockItem);
    if (page === null) throw unexpectedAnswer(stockResponse.status);
    return page.items.find((item) => item.productId === productId) ?? null;
  }

  async listMovements(productId: string, cursor?: string): Promise<Page<StockMovement>> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/stock-movements',
      query: { productId, limit: PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) },
    });
    const page = parsePage(response.body, parseMovement);
    if (page === null) throw unexpectedAnswer(response.status);
    return page;
  }

  async adjust(input: AdjustmentInput): Promise<Adjusted> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/stock-adjustments',
      body: {
        operationId: input.operationId,
        productId: input.productId,
        deltaMilli: input.deltaMilli,
        reason: input.reason.trim(),
      },
    });
    const movement = parseMovement(response.body);
    if (movement === null) throw unexpectedAnswer(response.status);
    return { movement, replayed: response.replayed };
  }
}
