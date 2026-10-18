import { parsePage, type Page } from '../../domain/model/page';
import {
  parsePurchase,
  parsePurchaseSummary,
  parseSupplier,
  type PurchaseSummary,
  type Supplier,
} from '../../domain/model/purchasing';
import type {
  NewPurchase,
  Purchasing,
  Registered,
  SupplierChange,
  SupplierInput,
} from '../../domain/ports/in/purchasing';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';
import { unexpectedAnswer } from './unexpected-answer';

/** Cuantas compras se piden por pagina, y cuantas paginas de proveedores se leen como maximo (un negocio de barrio tiene pocos). */
const PAGE_SIZE = 50;
const ALL_PAGE_SIZE = 200;
const MAX_ALL_PAGES = 10;

/** Proveedores y compras del negocio (ADR 0015 y 0019) sobre la API. */
export class PurchasingUseCase implements Purchasing {
  constructor(private readonly api: ApiGateway) {}

  async listAllSuppliers(): Promise<Supplier[]> {
    const all: Supplier[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < MAX_ALL_PAGES; pages += 1) {
      const response = await this.api.send<unknown>({
        method: 'GET',
        path: '/v1/suppliers',
        query: { limit: ALL_PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) },
      });
      const page = parsePage(response.body, parseSupplier);
      if (page === null) throw unexpectedAnswer(response.status);
      all.push(...page.items);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    return all;
  }

  async createSupplier(input: SupplierInput): Promise<Supplier> {
    const contact = input.contact?.trim() ?? '';
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/suppliers',
      body: { name: input.name.trim(), ...(contact === '' ? {} : { contact }) },
    });
    return this.supplierOf(response.body, response.status);
  }

  async updateSupplier(supplierId: string, change: SupplierChange): Promise<Supplier> {
    const response = await this.api.send<unknown>({
      method: 'PATCH',
      path: `/v1/suppliers/${encodeURIComponent(supplierId)}`,
      body: {
        ...(change.name === undefined ? {} : { name: change.name.trim() }),
        ...(change.contact === undefined
          ? {}
          : { contact: change.contact === null ? null : change.contact.trim() || null }),
      },
    });
    return this.supplierOf(response.body, response.status);
  }

  async deleteSupplier(supplierId: string): Promise<void> {
    await this.api.send<unknown>({
      method: 'DELETE',
      path: `/v1/suppliers/${encodeURIComponent(supplierId)}`,
    });
  }

  async listPurchases(cursor?: string): Promise<Page<PurchaseSummary>> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/purchases',
      query: { limit: PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) },
    });
    const page = parsePage(response.body, parsePurchaseSummary);
    if (page === null) throw unexpectedAnswer(response.status);
    return page;
  }

  async createPurchase(input: NewPurchase): Promise<Registered> {
    const note = input.note?.trim() ?? '';
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/purchases',
      body: {
        operationId: input.operationId,
        ...(input.supplierId == null ? {} : { supplierId: input.supplierId }),
        ...(note === '' ? {} : { note }),
        lines: input.lines.map((line) => ({
          productId: line.productId,
          quantityMilli: line.quantityMilli,
          unitCost: line.unitCost,
        })),
      },
    });
    const purchase = parsePurchase(response.body);
    if (purchase === null) throw unexpectedAnswer(response.status);
    return { purchase, replayed: response.replayed };
  }

  private supplierOf(body: unknown, status: number): Supplier {
    const supplier = parseSupplier(body);
    if (supplier === null) throw unexpectedAnswer(status);
    return supplier;
  }
}
