import type { NewOperation } from '../../model/outbox';

/** Que hace el motor ahora: nada, enviando un lote o esperando para reintentar tras un fallo. */
export type SyncPhase = 'idle' | 'sending' | 'waiting';

/** Lo que la interfaz sabe del envio: la cola, el motor y por que no avanza. Es el mismo objeto mientras nada cambie. */
export interface SyncState {
  readonly phase: SyncPhase;
  /** Cuantas operaciones esperan a ser enviadas. */
  readonly pending: number;
  /** Cuantas pidieron atencion: el servidor no las acepto. */
  readonly attention: number;
  /** Cuando el servidor acepto un lote por ultima vez en este dispositivo, o `null`. */
  readonly lastSyncedAt: Date | null;
  /** `true` si el servidor rechazo la sesion: hay que entrar de nuevo. La cola se conserva. */
  readonly sessionExpired: boolean;
  /** Cuando se volvera a intentar tras un fallo, o `null`. */
  readonly nextTryAt: Date | null;
  /** Por que fallo la ultima peticion entera, si el servidor la rechazo, o `null`. */
  readonly fault: { readonly status: number | null; readonly code: string | null } | null;
}

/**
 * Puerto de entrada: el motor de sincronizacion (C3-09, ADR 0009 y 0028). Envia la cola de operaciones de quien trabaja cuando
 * hay conexion, de a un lote y una pestaña a la vez, clasifica cada resultado como cualquier respuesta (ADR 0009), reintenta con
 * espera creciente y mide el reloj del dispositivo con la hora que da el servidor.
 */
export interface SyncEngine {
  current(): SyncState;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
  /** Empieza a vigilar la conexion y a quien trabaja, y envia lo que espere. Llamarlo otra vez no hace nada. */
  start(): void;
  /** Deja de vigilar y cancela lo pendiente. */
  stop(): void;
  /** Guarda la operacion en la cola de quien trabaja y la envia en cuanto se pueda. Lanza `NoWorkspaceError`. */
  enqueue(operation: NewOperation): Promise<void>;
  /**
   * Algo entro a la cola sin pasar por `enqueue` (el turno de caja guarda el turno y su operacion en una sola transaccion):
   * vuelve a contarla y envia en cuanto se pueda. Sin nadie trabajando no hace nada.
   */
  queued(): Promise<void>;
  /** La persona pide enviar ya (o volver a intentar tras un fallo). Se cumple cuando termina el intento. */
  syncNow(): Promise<void>;
  /** Cuanto adelanta el servidor al reloj de este dispositivo en la ultima medicion confiable (ADR 0016), o `null`. */
  clockOffsetMs(): number | null;
}
