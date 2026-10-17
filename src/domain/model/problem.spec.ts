import { describe, expect, it } from 'vitest';
import {
  MAX_RETRY_AFTER_MS,
  classifyFailure,
  parseProblem,
  parseRetryAfter,
  type FailureClass,
} from './problem';

const VALID = {
  type: 'urn:vsd-stock:problem:shift-closed',
  title: 'Conflicto',
  status: 409,
  detail: 'El turno ya estaba cerrado',
  instance: '/v1/sales',
  code: 'shift-closed',
  traceId: '3f0c9d58-8f6e-4f0a-9f0e-0d1d2a6b7c11',
};

describe('parseProblem (ADR 0019)', () => {
  it('reads the body the API sends for every error', () => {
    expect(parseProblem(VALID)).toEqual(VALID);
  });

  it('reads the list of invalid fields', () => {
    const errors = [
      { pointer: '/lines/0/quantityMilli', code: 'out-of-range', detail: 'Debe ser positivo' },
    ];

    expect(
      parseProblem({
        ...VALID,
        type: 'urn:vsd-stock:problem:validation-failed',
        status: 400,
        code: 'validation-failed',
        errors,
      })?.errors,
    ).toEqual(errors);
  });

  it('leaves "errors" out when the API sent none', () => {
    expect(parseProblem(VALID) !== null && 'errors' in (parseProblem(VALID) ?? {})).toBe(false);
  });

  it('ignores members it does not know, so that the API can add some without breaking the client', () => {
    const problem = parseProblem({ ...VALID, extra: 'x', hint: { nested: true } });

    expect(problem).toEqual(VALID);
  });

  it.each(['type', 'title', 'status', 'detail', 'instance', 'code', 'traceId'])(
    'refuses a body without "%s"',
    (member) => {
      const { [member]: _removed, ...rest } = VALID as Record<string, unknown>;

      expect(parseProblem(rest)).toBeNull();
    },
  );

  it.each([
    ['status as text', { ...VALID, status: '409' }],
    ['status that is not an error', { ...VALID, status: 200 }],
    ['status with decimals', { ...VALID, status: 409.5 }],
    ['status that is not a number', { ...VALID, status: Number.NaN }],
    ['an empty code', { ...VALID, code: '' }],
    ['a code that is not a text', { ...VALID, code: 7 }],
    [
      'a code with capitals, even if the type agrees with it',
      { ...VALID, code: 'Shift-Closed', type: 'urn:vsd-stock:problem:Shift-Closed' },
    ],
    ['errors that is a text', { ...VALID, errors: 'mal' }],
    ['errors that is an empty text', { ...VALID, errors: '' }],
    ['errors that is an object', { ...VALID, errors: {} }],
    ['an error entry without a pointer', { ...VALID, errors: [{ code: 'x', detail: 'y' }] }],
    ['an error entry that is not an object', { ...VALID, errors: [3] }],
  ])('refuses %s', (_label, body) => {
    expect(parseProblem(body)).toBeNull();
  });

  it.each([null, undefined, 'error', 42, true, [], [VALID]])(
    'refuses something that is not an object: %j',
    (body) => {
      expect(parseProblem(body)).toBeNull();
    },
  );

  it('never throws, whatever the server sends', () => {
    const hostile = {
      get type() {
        throw new Error('boom');
      },
    };

    expect(() => parseProblem(hostile)).not.toThrow();
    expect(parseProblem(hostile)).toBeNull();
  });

  it('does not trust a code that does not match the type it claims', () => {
    expect(parseProblem({ ...VALID, type: 'urn:vsd-stock:problem:other' })).toBeNull();
  });
});

describe('classifyFailure (the failure classes of ADR 0009)', () => {
  it.each<[number | null, FailureClass]>([
    [null, 'network'],
    [401, 'session'],
    [408, 'transient'],
    [425, 'transient'],
    [429, 'transient'],
    [500, 'transient'],
    [502, 'transient'],
    [503, 'transient'],
    [504, 'transient'],
    [599, 'transient'],
    [409, 'conflict'],
    [400, 'permanent'],
    [403, 'permanent'],
    [404, 'permanent'],
    [405, 'permanent'],
    [413, 'permanent'],
    [415, 'permanent'],
    [418, 'permanent'],
    [499, 'permanent'],
  ])('puts %s in the class "%s"', (status, expected) => {
    expect(classifyFailure(status)).toBe(expected);
  });

  it.each([200, 201, 204, 302, 399, 600, 99, 404.5, Number.NaN])(
    'refuses %s: it is not a failure',
    (status) => {
      expect(() => classifyFailure(status)).toThrow(RangeError);
    },
  );
});

describe('parseRetryAfter', () => {
  const NOW = Date.parse('2026-10-20T15:00:00.000Z');

  it('reads a number of seconds', () => {
    expect(parseRetryAfter('7', NOW)).toBe(7000);
    expect(parseRetryAfter('0', NOW)).toBe(0);
    expect(parseRetryAfter(' 30 ', NOW)).toBe(30_000);
  });

  it('reads an HTTP date, as the time left until then', () => {
    expect(parseRetryAfter('Tue, 20 Oct 2026 15:00:45 GMT', NOW)).toBe(45_000);
  });

  it('answers 0 for an HTTP date that already passed', () => {
    expect(parseRetryAfter('Tue, 20 Oct 2026 14:00:00 GMT', NOW)).toBe(0);
  });

  it('never asks for more than an hour, so that a wrong header cannot freeze the device', () => {
    expect(parseRetryAfter('86400', NOW)).toBe(MAX_RETRY_AFTER_MS);
    expect(parseRetryAfter('Wed, 21 Oct 2026 15:00:00 GMT', NOW)).toBe(MAX_RETRY_AFTER_MS);
    expect(parseRetryAfter('3600', NOW)).toBe(MAX_RETRY_AFTER_MS);
    expect(parseRetryAfter('3599', NOW)).toBe(3_599_000);
  });

  it.each([null, '', '  ', 'pronto', '-5', '1.5', '1e3', '0x10', 'NaN', 'Infinity'])(
    'has no answer for %j: the client backs off on its own',
    (value) => {
      expect(parseRetryAfter(value, NOW)).toBeNull();
    },
  );
});
