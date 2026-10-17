/** Un campo invalido: donde esta (puntero JSON), por que (codigo estable) y una explicacion para quien programa. */
export interface ProblemError {
  readonly pointer: string;
  readonly code: string;
  readonly detail: string;
}

/**
 * El cuerpo de todo error de la API (RFC 9457, ADR 0019). El cliente decide por `code` y por el estado HTTP,
 * nunca por `title` ni `detail`: esos son texto y pueden cambiar.
 */
export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  readonly code: string;
  readonly traceId: string;
  readonly errors?: readonly ProblemError[];
}

/** Como se trata un fallo al sincronizar (ADR 0009). */
export type FailureClass = 'network' | 'session' | 'transient' | 'conflict' | 'permanent';

/** Lo maximo que se acepta esperar por un `Retry-After`: una hora. Un encabezado equivocado no congela el dispositivo. */
export const MAX_RETRY_AFTER_MS = 3_600_000;

const CODE = /^[a-z][a-z0-9-]*$/;
const HTTP_DATE = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProblemError(value: unknown): ProblemError | null {
  if (!isRecord(value)) return null;
  const { pointer, code, detail } = value;
  if (typeof pointer !== 'string' || typeof code !== 'string' || typeof detail !== 'string') {
    return null;
  }
  return { pointer, code, detail };
}

/**
 * Lee el cuerpo de un error. Devuelve `null` si no tiene la forma del contrato, y NUNCA lanza, venga lo que
 * venga del servidor: quien lo llama ya esta manejando un fallo. Ignora los miembros que no conoce.
 */
export function parseProblem(body: unknown): Problem | null {
  try {
    if (!isRecord(body)) return null;
    const { type, title, status, detail, instance, code, traceId, errors } = body;
    if (
      typeof type !== 'string' ||
      typeof title !== 'string' ||
      typeof detail !== 'string' ||
      typeof instance !== 'string' ||
      typeof code !== 'string' ||
      typeof traceId !== 'string' ||
      typeof status !== 'number'
    ) {
      return null;
    }
    if (!Number.isInteger(status) || status < 400 || status > 599) return null;
    if (!CODE.test(code) || type !== `urn:vsd-stock:problem:${code}`) return null;

    if (errors === undefined) {
      return { type, title, status, detail, instance, code, traceId };
    }
    if (!Array.isArray(errors)) return null;
    const parsed: ProblemError[] = [];
    for (const entry of errors as unknown[]) {
      const error = parseProblemError(entry);
      if (error === null) return null;
      parsed.push(error);
    }
    return { type, title, status, detail, instance, code, traceId, errors: parsed };
  } catch {
    return null;
  }
}

/**
 * La clase de un fallo segun el estado HTTP (ADR 0009): sin respuesta es red; 401, sesion; 408, 425, 429 y 5xx,
 * pasajero; 409, conflicto; cualquier otro 4xx, permanente. Lanza RangeError con un estado que no es un error.
 */
export function classifyFailure(status: number | null): FailureClass {
  if (status === null) return 'network';
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new RangeError(`An HTTP failure has a status from 400 to 599: ${String(status)}`);
  }
  if (status === 401) return 'session';
  if (status === 409) return 'conflict';
  if (status === 408 || status === 425 || status === 429 || status >= 500) return 'transient';
  return 'permanent';
}

/**
 * Cuantos milisegundos pide esperar el encabezado `Retry-After`: unos segundos o una fecha HTTP. Devuelve `null`
 * si no se entiende, y entonces el cliente espera por su cuenta. Nunca mas de una hora.
 */
export function parseRetryAfter(value: string | null, nowMs: number): number | null {
  if (value === null) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) {
    return Math.min(Number(text) * 1000, MAX_RETRY_AFTER_MS);
  }
  if (HTTP_DATE.test(text)) {
    const at = Date.parse(text);
    if (Number.isNaN(at)) return null;
    return Math.min(Math.max(at - nowMs, 0), MAX_RETRY_AFTER_MS);
  }
  return null;
}
