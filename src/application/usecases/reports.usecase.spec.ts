import { describe, expect, it } from 'vitest';
import { createFakeApi, reply } from '../../../test/support/fake-api';
import { ApiError } from '../../domain/model/api-error';
import { ReportsUseCase } from './reports.usecase';

const wireSection = (total = 0) => ({
  count: total === 0 ? 0 : 1,
  total,
  base: total,
  tax: 0,
  rows: [
    { taxKind: 'taxed', rateBp: 1900, total: 0, base: 0, tax: 0 },
    { taxKind: 'taxed', rateBp: 500, total: 0, base: 0, tax: 0 },
    { taxKind: 'exempt', rateBp: 0, total, base: total, tax: 0 },
    { taxKind: 'excluded', rateBp: 0, total: 0, base: 0, tax: 0 },
  ],
  payments: [
    { method: 'cash', amount: total },
    { method: 'card', amount: 0 },
    { method: 'transfer', amount: 0 },
  ],
});

const wireReport = (change: Record<string, unknown> = {}) => ({
  month: '2026-10',
  from: '2026-10-01T05:00:00.000Z',
  to: '2026-11-01T05:00:00.000Z',
  sales: wireSection(700),
  voids: wireSection(),
  ...change,
});

const failedWith = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('ReportsUseCase', () => {
  it('asks the server for the month it was given and reads the answer', async () => {
    const { api, sent } = createFakeApi(wireReport());

    const report = await new ReportsUseCase(api).monthly('2026-10');

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      method: 'GET',
      path: '/v1/reports/monthly',
      query: { month: '2026-10' },
    });
    expect(report.month).toBe('2026-10');
    expect(report.sales.total).toBe(700);
    expect(report.voids.count).toBe(0);
  });

  it('does not believe an answer that is not what the contract says: a proxy or another version', async () => {
    const { api } = createFakeApi(wireReport({ sales: 'ninguna' }));

    const error = await failedWith(new ReportsUseCase(api).monthly('2026-10'));

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure.class).toBe('transient');
  });

  it('keeps the status it was answered with, so the failure can be told apart from others', async () => {
    const { api } = createFakeApi(reply(wireReport({ sales: 'ninguna' }), 202));

    const error = await failedWith(new ReportsUseCase(api).monthly('2026-10'));

    expect((error as ApiError).failure).toMatchObject({ class: 'transient', status: 202 });
  });

  it('lets the failure of the server go through as it is', async () => {
    const { api } = createFakeApi(
      new ApiError({ class: 'permanent', status: 403, problem: null, retryAfterMs: null }),
    );

    const error = await failedWith(new ReportsUseCase(api).monthly('2026-10'));

    expect((error as ApiError).failure).toMatchObject({ class: 'permanent', status: 403 });
  });
});
