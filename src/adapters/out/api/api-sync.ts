import { ApiError } from '../../../domain/model/api-error';
import type { QueuedOperation, SyncResult } from '../../../domain/model/outbox';
import { parseProblem } from '../../../domain/model/problem';
import type { ApiGateway } from '../../../domain/ports/out/api-gateway';
import type { SyncApi, SyncResponse } from '../../../domain/ports/out/sync-api';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResult(value: unknown): SyncResult | null {
  if (!isRecord(value)) return null;
  const { operationId, status, replayed, body, problem } = value;
  if (operationId !== null && typeof operationId !== 'string') return null;
  if (typeof status !== 'number' || !Number.isInteger(status)) return null;
  if (typeof replayed !== 'boolean') return null;
  return {
    operationId,
    status,
    replayed,
    body: body ?? null,
    // El detalle del problema es para quien programa: si no tiene la forma del contrato, el estado ya dice lo importante.
    problem: parseProblem(problem),
  };
}

/** Lee la respuesta del lote. Devuelve `null` si no tiene la forma del contrato, y NUNCA lanza: los datos de la red no son de fiar. */
function parseResponse(body: unknown): SyncResponse | null {
  if (!isRecord(body)) return null;
  const { serverTime, results } = body;
  if (typeof serverTime !== 'string' || !Array.isArray(results)) return null;
  const at = new Date(serverTime);
  if (Number.isNaN(at.getTime())) return null;
  const parsed: SyncResult[] = [];
  for (const entry of results as unknown[]) {
    const result = parseResult(entry);
    if (result === null) return null;
    parsed.push(result);
  }
  return { serverTime: at, results: parsed };
}

/** El lote de sincronizacion de la API (`POST /v1/sync`, ADR 0028) por la API de la sesion. */
export class ApiSync implements SyncApi {
  constructor(private readonly api: ApiGateway) {}

  async send(operations: readonly QueuedOperation[]): Promise<SyncResponse> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/sync',
      body: {
        operations: operations.map((operation) => ({
          kind: operation.kind,
          // Solo cerrar un turno lleva el turno aparte: en la ruta suelta va en el camino.
          ...(operation.kind === 'shift-close' && operation.shiftId !== null
            ? { shiftId: operation.shiftId }
            : {}),
          body: operation.body,
        })),
      },
    });
    const parsed = response.status === 200 ? parseResponse(response.body) : null;
    if (parsed === null) {
      // Un 200 que no es el contrato no es nuestro servidor (un proxy, otra version): se trata como un fallo pasajero.
      throw new ApiError({
        class: 'transient',
        status: response.status,
        problem: null,
        retryAfterMs: null,
      });
    }
    return parsed;
  }
}
