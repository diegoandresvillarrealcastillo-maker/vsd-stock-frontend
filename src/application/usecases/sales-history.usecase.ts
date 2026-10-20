import { parsePage, type Page } from '../../domain/model/page';
import {
  parseReview,
  parseSaleDetail,
  parseSaleRecord,
  type SaleDetail,
  type SaleRecord,
  type SaleReview,
} from '../../domain/model/sales-history';
import type {
  SalesHistory,
  SalesQuery,
  VoidInput,
  Voided,
} from '../../domain/ports/in/sales-history';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';
import { unexpectedAnswer } from './unexpected-answer';

/** Cuántas ventas se piden por página, y hasta cuántas de la bandeja se cuentan para el número del menú. */
const PAGE_SIZE = 30;
const COUNT_LIMIT = 50;

/** Las ventas que el servidor ya tiene, sobre la API (C3-13, ADR 0027). */
export class SalesHistoryUseCase implements SalesHistory {
  constructor(private readonly api: ApiGateway) {}

  async list(query: SalesQuery): Promise<Page<SaleRecord>> {
    if (query.view === 'shift' && query.shiftId === undefined) {
      throw new RangeError('The sales of a shift are asked for with the shift');
    }
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/sales',
      query: {
        limit: PAGE_SIZE,
        ...(query.view === 'shift' ? { shift: query.shiftId } : {}),
        ...(query.view === 'attention' ? { attention: true } : {}),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      },
    });
    const page = parsePage(response.body, parseSaleRecord);
    if (page === null) throw unexpectedAnswer(response.status);
    return page;
  }

  async get(saleId: string): Promise<SaleDetail> {
    const response = await this.api.send<unknown>({ method: 'GET', path: pathOf(saleId) });
    return this.detailOf(response.body, response.status);
  }

  async voidSale(saleId: string, input: VoidInput): Promise<Voided> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: `${pathOf(saleId)}/void`,
      body: {
        operationId: input.operationId,
        reason: input.reason,
        ...(input.shiftId == null ? {} : { shiftId: input.shiftId }),
      },
    });
    return { sale: this.detailOf(response.body, response.status), replayed: response.replayed };
  }

  async review(saleId: string, note: string | null): Promise<SaleReview> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: `${pathOf(saleId)}/review`,
      body: note === null ? {} : { note },
    });
    const review = parseReview(response.body);
    if (review === null) throw unexpectedAnswer(response.status);
    return review;
  }

  async attentionCount(): Promise<{ count: number; more: boolean }> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/sales',
      query: { limit: COUNT_LIMIT, attention: true },
    });
    const page = parsePage(response.body, parseSaleRecord);
    if (page === null) throw unexpectedAnswer(response.status);
    return { count: page.items.length, more: page.nextCursor !== null };
  }

  private detailOf(body: unknown, status: number): SaleDetail {
    const sale = parseSaleDetail(body);
    if (sale === null) throw unexpectedAnswer(status);
    return sale;
  }
}

function pathOf(saleId: string): string {
  return `/v1/sales/${encodeURIComponent(saleId)}`;
}
