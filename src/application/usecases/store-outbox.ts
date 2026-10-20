import {
  BATCH_SIZE,
  takeBatch,
  type NewOperation,
  type QueuedOperation,
} from '../../domain/model/outbox';
import type { Outbox, OutboxCounts, Settlement } from '../../domain/ports/in/outbox';
import type { LocalStore } from '../../domain/ports/out/local-store';

/**
 * La cola de operaciones de una persona sobre su base local. Recibe una funcion que da la base mientras esa persona siga
 * trabajando y lanza `NoWorkspaceError` cuando ya no (la base se solto o entro otra persona): asi nunca toca la cola de otra.
 */
export class StoreOutbox implements Outbox {
  constructor(private readonly current: () => LocalStore) {}

  async enqueue(operation: NewOperation): Promise<void> {
    await this.current().enqueue(operation);
  }

  async nextBatch(): Promise<QueuedOperation[]> {
    return takeBatch(await this.current().pendingOperations(BATCH_SIZE));
  }

  async settle(settlements: readonly Settlement[]): Promise<void> {
    const store = this.current();
    const done: string[] = [];
    const attempted: string[] = [];
    for (const settlement of settlements) {
      if (settlement.outcome === 'done') done.push(settlement.operationId);
      else if (settlement.outcome === 'attempted') attempted.push(settlement.operationId);
    }
    if (done.length > 0) await store.resolveOperations(done);
    for (const settlement of settlements) {
      if (settlement.outcome === 'attention') {
        await store.markAttention(settlement.operationId, settlement.reason);
      }
    }
    if (attempted.length > 0) await store.recordAttempts(attempted);
  }

  async counts(): Promise<OutboxCounts> {
    const store = this.current();
    const [pending, attention] = await Promise.all([store.countPending(), store.countAttention()]);
    return { pending, attention };
  }

  async attention(): Promise<QueuedOperation[]> {
    return await this.current().attentionOperations();
  }
}
