import { classifyFailure, type Problem } from './problem';

/**
 * Lo que se puede hacer sin conexion y por eso espera en la cola (ADR 0017 y 0028): abrir un turno, cerrarlo y vender. Lo demas
 * (anular, mover efectivo, compras, ajustes) es de la gerencia, con conexion, y se pide por su propia ruta.
 */
export const OPERATION_KINDS = ['shift-open', 'shift-close', 'sale'] as const;
export type OperationKind = (typeof OPERATION_KINDS)[number];

/** Cuantas operaciones se mandan en un lote, como maximo (ADR 0028). */
export const BATCH_SIZE = 20;
/** Cuanto pesa, como maximo, el cuerpo de un lote: lo que llegue primero entre esto y `BATCH_SIZE`. */
export const BATCH_BYTES = 64 * 1024;

/** Cuanto pesa el cuerpo de una operacion al enviarse, en bytes. */
function sizeOf(operation: QueuedOperation): number {
  return new TextEncoder().encode(JSON.stringify(operation.body)).length;
}

/** Una operacion nueva para la cola: su cuerpo es EXACTAMENTE el de la ruta individual de esa clase (ADR 0028). */
export interface NewOperation {
  readonly operationId: string;
  readonly kind: OperationKind;
  /** Solo al cerrar un turno (`shift-close`): el turno que se cierra, que en la ruta individual va en el camino (ADR 0028). */
  readonly shiftId?: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

/** `pending`: espera a enviarse. `attention`: el servidor no la acepto y alguien tiene que mirarla. */
export type OperationState = 'pending' | 'attention';

/** Por que una operacion pide atencion: la clase del fallo (ADR 0009), el estado que dio el servidor y su codigo estable. */
export interface AttentionReason {
  readonly class: 'conflict' | 'permanent';
  readonly status: number;
  readonly code: string | null;
}

/** Una operacion en la cola, tal como se guarda. */
export interface QueuedOperation {
  readonly operationId: string;
  readonly kind: OperationKind;
  /** El turno que se cierra si es un `shift-close`; `null` en las demas. */
  readonly shiftId: string | null;
  readonly body: Readonly<Record<string, unknown>>;
  /** ISO 8601 UTC: cuando la persona la hizo. La cola se envia en este orden. */
  readonly createdAt: string;
  readonly state: OperationState;
  /** Cuantas veces se intento enviar. Solo informa. */
  readonly attempts: number;
  /** Solo si `state` es `attention`. */
  readonly attention: AttentionReason | null;
}

/** El resultado de UNA operacion de un lote (ADR 0028): lo que habria contestado la ruta individual. */
export interface SyncResult {
  /** El de la operacion, o `null` si el servidor ni siquiera lo pudo leer del cuerpo. */
  readonly operationId: string | null;
  readonly status: number;
  /** `true` si el servidor ya la habia aplicado antes (la respuesta se perdio, no la operacion). */
  readonly replayed: boolean;
  /** Lo que la ruta individual devuelve (la venta, el turno) cuando se aplico. */
  readonly body: unknown;
  /** El error de siempre (`application/problem+json`) cuando no se aplico. */
  readonly problem: Problem | null;
}

/**
 * Que hacer con el resultado de una operacion (ADR 0009 y 0028):
 * - `done`: el servidor la tiene; sale de la cola.
 * - `retry`: puede pasar (408, 425, 429, 5xx, o una respuesta que no es del contrato); se queda y se reintenta.
 * - `attention`: el servidor la rechazo y enviarla otra vez no cambia la respuesta; se aparta y no bloquea a las demas.
 * - `session`: un 401, que es de la sesion y no de la operacion; se detiene todo y la cola se conserva.
 */
export type ResultAction =
  | { readonly action: 'done'; readonly replayed: boolean }
  | { readonly action: 'retry' }
  | { readonly action: 'attention'; readonly reason: AttentionReason }
  | { readonly action: 'session' };

export function actionOfResult(result: SyncResult): ResultAction {
  const { status } = result;
  if (!Number.isInteger(status)) return { action: 'retry' };
  if (status >= 200 && status <= 299) return { action: 'done', replayed: result.replayed };
  // Un lote no trae redirecciones ni informativos: lo que no es un exito ni un error no es de nuestro servidor.
  if (status < 400 || status > 599) return { action: 'retry' };

  switch (classifyFailure(status)) {
    case 'session':
      return { action: 'session' };
    case 'conflict':
      return {
        action: 'attention',
        reason: { class: 'conflict', status, code: result.problem?.code ?? null },
      };
    case 'permanent':
      return {
        action: 'attention',
        reason: { class: 'permanent', status, code: result.problem?.code ?? null },
      };
    default:
      // `transient`; `network` no se da con un estado.
      return { action: 'retry' };
  }
}

/**
 * Arma el siguiente lote con las que esperan, ya en orden: hasta `BATCH_SIZE` operaciones o `BATCH_BYTES` bytes de cuerpos, lo que
 * llegue primero (ADR 0028). Una sola operacion siempre sale, pese lo que pese: si no, una venta enorme se quedaria para siempre.
 */
export function takeBatch(waiting: readonly QueuedOperation[]): QueuedOperation[] {
  const batch: QueuedOperation[] = [];
  let bytes = 0;
  for (const operation of waiting) {
    if (batch.length >= BATCH_SIZE) break;
    const size = sizeOf(operation);
    if (batch.length > 0 && bytes + size > BATCH_BYTES) break;
    batch.push(operation);
    bytes += size;
  }
  return batch;
}

/** Dos segundos, la espera tras el primer fallo seguido. */
const BASE_DELAY_MS = 2_000;
/** Cinco minutos: lo maximo que se espera entre intentos. */
const MAX_DELAY_MS = 300_000;

/**
 * Cuanto esperar antes de volver a enviar tras `failures` fallos seguidos: dos segundos que se duplican hasta cinco minutos, con
 * azar (de la mitad a la totalidad) para que muchos dispositivos que vuelven a la vez no lleguen juntos. Nunca menos de lo que el
 * servidor pidio con `Retry-After`. `random` devuelve un numero de 0 a 1.
 */
export function retryDelayMs(
  failures: number,
  retryAfterMs: number | null,
  random: () => number,
): number {
  const exponent = Math.max(failures, 1) - 1;
  const base = Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
  const spread = Math.round(base * (0.5 + 0.5 * random()));
  return Math.max(spread, retryAfterMs ?? 0);
}
