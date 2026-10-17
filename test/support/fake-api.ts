import type { ApiGateway, ApiRequest, ApiResponse } from '../../src/domain/ports/out/api-gateway';

/** Una respuesta con su estado (por omision 200) y, si se quiere, marcada como repetida por el servidor. */
export interface Reply {
  readonly status: number;
  readonly body: unknown;
  readonly replayed: boolean;
}

export function reply(body: unknown, status = 200, replayed = false): Reply {
  return { status, body, replayed };
}

function isReply(value: unknown): value is Reply {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'replayed' in value &&
    'body' in value
  );
}

/**
 * Una API de mentira para probar los casos de uso: responde lo que se prepare, en orden, y anota lo que se le pidio. Un
 * `Error` se lanza; una `Reply` fija el estado; cualquier otra cosa es el cuerpo de un 200.
 */
export function createFakeApi(...answers: unknown[]) {
  const sent: ApiRequest[] = [];
  const queue = [...answers];
  const api: ApiGateway = {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      const next = queue.shift();
      if (next instanceof Error) return Promise.reject(next);
      if (isReply(next)) {
        return Promise.resolve({
          status: next.status,
          body: next.body as T,
          replayed: next.replayed,
        });
      }
      return Promise.resolve({ status: 200, body: next as T, replayed: false });
    },
  };
  return { api, sent };
}
