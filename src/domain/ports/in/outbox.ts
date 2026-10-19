import type { AttentionReason, NewOperation, QueuedOperation } from '../../model/outbox';

/** Lo que paso con una operacion que se mando: el servidor ya la tiene, la rechazo, o no funciono y se reintentara. */
export type Settlement =
  | { readonly operationId: string; readonly outcome: 'done' }
  | {
      readonly operationId: string;
      readonly outcome: 'attention';
      readonly reason: AttentionReason;
    }
  | { readonly operationId: string; readonly outcome: 'attempted' };

export interface OutboxCounts {
  readonly pending: number;
  readonly attention: number;
}

/**
 * La cola de operaciones de UNA persona, con su base abierta (ADR 0009 y 0028). Se pide al espacio de trabajo y sirve mientras esa
 * persona siga trabajando: si el dispositivo cambia de persona, cada metodo lanza `NoWorkspaceError` en vez de tocar la cola de
 * otra.
 */
export interface Outbox {
  /** Pone una operacion en la cola. Si ya estaba, no hace nada. */
  enqueue(operation: NewOperation): Promise<void>;
  /** El siguiente lote: las que esperan, de la mas antigua a la mas nueva, hasta `BATCH_SIZE` o `BATCH_BYTES`. */
  nextBatch(): Promise<QueuedOperation[]>;
  /** Anota lo que paso con cada operacion de un lote. */
  settle(settlements: readonly Settlement[]): Promise<void>;
  counts(): Promise<OutboxCounts>;
  /** Las que piden atencion, de la mas antigua a la mas nueva. */
  attention(): Promise<QueuedOperation[]>;
}
