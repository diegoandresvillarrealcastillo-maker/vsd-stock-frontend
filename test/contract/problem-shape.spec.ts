// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { components } from '../../src/adapters/out/api/schema';
import { parseProblem, type Problem } from '../../src/domain/model/problem';

// El dominio lee el error con su propio tipo (no puede importar el del adaptador). Esta prueba comprueba que ese tipo
// y lo que el contrato del backend promete (ADR 0019) siguen siendo lo mismo: en compilacion, porque la muestra se
// declara con el tipo generado, y en ejecucion, porque se compara con el esquema de contract/openapi.json.

type ProblemDetails = components['schemas']['ProblemDetailsDto'];

const WITHOUT_ERRORS: ProblemDetails = {
  type: 'urn:vsd-stock:problem:not-found',
  title: 'No encontrado',
  status: 404,
  detail: 'No existe el producto',
  instance: '/v1/products/abc',
  code: 'not-found',
  traceId: '3f0c9d58-8f6e-4f0a-9f0e-0d1d2a6b7c11',
};

const WITH_ERRORS: ProblemDetails = {
  ...WITHOUT_ERRORS,
  type: 'urn:vsd-stock:problem:validation-failed',
  status: 400,
  code: 'validation-failed',
  errors: [
    { pointer: '/lines/0/quantityMilli', code: 'out-of-range', detail: 'Debe ser positivo' },
  ],
};

const contract = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../contract/openapi.json'), 'utf8'),
) as {
  paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
  components: {
    schemas: Record<string, { properties: Record<string, unknown>; required: string[] }>;
  };
};
const schema = contract.components.schemas['ProblemDetailsDto'];

describe('the error format of the contract and the domain (ADR 0019)', () => {
  it('has the schema ProblemDetailsDto', () => {
    expect(schema).toBeDefined();
  });

  it('is read by the domain exactly as the contract promises it', () => {
    const read: Problem | null = parseProblem(WITH_ERRORS);

    expect(read).toEqual(WITH_ERRORS);
  });

  it('keeps in the domain every member the contract declares, and none that it does not', () => {
    const members = Object.keys(parseProblem(WITH_ERRORS) ?? {}).sort();

    expect(members).toEqual(Object.keys(schema?.properties ?? {}).sort());
  });

  it('requires in the domain the same members the contract requires', () => {
    const required = Object.keys(parseProblem(WITHOUT_ERRORS) ?? {}).sort();

    expect(required).toEqual([...(schema?.required ?? [])].sort());
  });

  it('declares a problem+json default response for every operation', () => {
    for (const [path, item] of Object.entries(contract.paths)) {
      for (const [method, operation] of Object.entries(item)) {
        expect(operation.responses['default'], `${method.toUpperCase()} ${path}`).toMatchObject({
          content: {
            'application/problem+json': {
              schema: { $ref: '#/components/schemas/ProblemDetailsDto' },
            },
          },
        });
      }
    }
  });
});
