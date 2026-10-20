import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../domain/model/api-error';
import type { QueuedOperation } from '../../../domain/model/outbox';
import { createFakeApi, reply } from '../../../../test/support/fake-api';
import { ApiSync } from './api-sync';

const A = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const B = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const SHIFT = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';

const queued = (
  operationId: string,
  kind: QueuedOperation['kind'],
  body: Record<string, unknown>,
  shiftId: string | null = null,
): QueuedOperation => ({
  operationId,
  kind,
  shiftId,
  body,
  createdAt: '2026-10-19T12:00:00.000Z',
  state: 'pending',
  attempts: 3,
  attention: null,
});

const sale = queued(A, 'sale', { operationId: A, folio: 'AA-000001' });
const closing = queued(B, 'shift-close', { operationId: B, countedAmount: 100 }, SHIFT);

const problem = (code: string, status: number) => ({
  type: `urn:vsd-stock:problem:${code}`,
  title: 'Titulo',
  status,
  detail: 'Detalle',
  instance: '/v1/sync',
  code,
  traceId: 'traza',
});

const answer = (results: unknown, serverTime: unknown = '2026-10-19T12:00:01.500Z') => ({
  serverTime,
  results,
});

describe('ApiSync', () => {
  describe('what it sends', () => {
    it('sends each operation as its kind and the exact body of its route, and nothing else of the queue', async () => {
      const { api, sent } = createFakeApi(
        answer([
          { operationId: A, status: 201, replayed: false, body: {}, problem: null },
          { operationId: B, status: 200, replayed: false, body: {}, problem: null },
        ]),
      );

      await new ApiSync(api).send([sale, closing]);

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/sync',
          body: {
            operations: [
              { kind: 'sale', body: { operationId: A, folio: 'AA-000001' } },
              { kind: 'shift-close', shiftId: SHIFT, body: { operationId: B, countedAmount: 100 } },
            ],
          },
        },
      ]);
    });

    it('does not invent a shift for a closing that has none', async () => {
      const { api, sent } = createFakeApi(
        answer([{ operationId: B, status: 200, replayed: false, body: {}, problem: null }]),
      );

      await new ApiSync(api).send([{ ...closing, shiftId: null }]);

      expect(JSON.stringify(sent[0]?.body)).not.toContain('shiftId');
    });

    it('does not send the shift of an operation that is not a closing', async () => {
      const { api, sent } = createFakeApi(
        answer([{ operationId: A, status: 201, replayed: false, body: {}, problem: null }]),
      );

      await new ApiSync(api).send([{ ...sale, shiftId: SHIFT }]);

      expect(JSON.stringify(sent[0]?.body)).not.toContain('shiftId');
    });
  });

  describe('what it reads', () => {
    it('gives the hour of the server and a result for each operation, in the same order', async () => {
      const { api } = createFakeApi(
        answer([
          { operationId: A, status: 201, replayed: false, body: { id: 'x' }, problem: null },
          {
            operationId: B,
            status: 409,
            replayed: false,
            body: null,
            problem: problem('shift-already-open', 409),
          },
        ]),
      );

      const response = await new ApiSync(api).send([sale, closing]);

      expect(response.serverTime).toEqual(new Date('2026-10-19T12:00:01.500Z'));
      expect(response.results).toEqual([
        { operationId: A, status: 201, replayed: false, body: { id: 'x' }, problem: null },
        {
          operationId: B,
          status: 409,
          replayed: false,
          body: null,
          problem: problem('shift-already-open', 409),
        },
      ]);
    });

    it('gives no body when the server brought none, and not a missing one', async () => {
      const { api } = createFakeApi(answer([{ operationId: A, status: 201, replayed: false }]));

      const response = await new ApiSync(api).send([sale]);

      expect(response.results[0]).toEqual({
        operationId: A,
        status: 201,
        replayed: false,
        body: null,
        problem: null,
      });
    });

    it('keeps a result whose operation the server could not read, with no identifier', async () => {
      const { api } = createFakeApi(
        answer([
          {
            operationId: null,
            status: 400,
            replayed: false,
            body: null,
            problem: problem('validation-failed', 400),
          },
        ]),
      );

      const response = await new ApiSync(api).send([sale]);

      expect(response.results[0]).toMatchObject({ operationId: null, status: 400 });
    });

    it('keeps the status of a failure whose problem it can not read, without the problem', async () => {
      const { api } = createFakeApi(
        answer([
          { operationId: A, status: 503, replayed: false, body: null, problem: { raro: true } },
        ]),
      );

      const response = await new ApiSync(api).send([sale]);

      expect(response.results[0]).toEqual({
        operationId: A,
        status: 503,
        replayed: false,
        body: null,
        problem: null,
      });
    });
  });

  describe('an answer that is not the contract is a failure that may pass', () => {
    const transient = async (body: unknown) => {
      const { api } = createFakeApi(body);
      const failure = await new ApiSync(api).send([sale]).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(ApiError);
      expect((failure as ApiError).failure).toEqual({
        class: 'transient',
        status: 200,
        problem: null,
        retryAfterMs: null,
      });
    };

    it.each([
      ['nothing', undefined],
      ['text', 'hola'],
      ['a list', []],
      ['null', null],
      ['a result that is null', answer([null])],
      ['no results', { serverTime: '2026-10-19T12:00:00.000Z' }],
      ['results that are not a list', answer('no')],
      ['no hour of the server', { results: [] }],
      ['an hour that is not an hour', answer([], 'ayer')],
      ['an hour that is not text', answer([], 5)],
      ['a result that is not an object', answer([5])],
      [
        'a status that is not a number',
        answer([{ operationId: A, status: '201', replayed: false }]),
      ],
      ['a status with decimals', answer([{ operationId: A, status: 201.5, replayed: false }])],
      ['no flag of repeated', answer([{ operationId: A, status: 201 }])],
      [
        'an identifier that is not text',
        answer([{ operationId: 5, status: 201, replayed: false }]),
      ],
    ])('when it brings %s', async (_name, body) => {
      await transient(body);
    });

    it('also when the server answers with a status that is not a 200', async () => {
      const { api } = createFakeApi(reply(answer([]), 204));

      await expect(new ApiSync(api).send([sale])).rejects.toBeInstanceOf(ApiError);
    });
  });

  it('lets the failure of the API go up as it came', async () => {
    const failure = new ApiError({
      class: 'session',
      status: 401,
      problem: null,
      retryAfterMs: null,
    });
    const { api } = createFakeApi(failure);

    await expect(new ApiSync(api).send([sale])).rejects.toBe(failure);
  });
});
