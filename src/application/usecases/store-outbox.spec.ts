import { describe, expect, it, vi } from 'vitest';
import { BATCH_SIZE } from '../../domain/model/outbox';
import type { LocalStore } from '../../domain/ports/out/local-store';
import { StoreOutbox } from './store-outbox';

describe('StoreOutbox', () => {
  it('asks the base for no more than a batch: it does not open, one by one, what will not be sent now', async () => {
    const pendingOperations = vi.fn().mockResolvedValue([]);
    const store = { pendingOperations } as unknown as LocalStore;

    await new StoreOutbox(() => store).nextBatch();

    expect(pendingOperations).toHaveBeenCalledWith(BATCH_SIZE);
  });

  it('gives what waits, as many as it is asked for, to whoever wants to show it', async () => {
    const waiting = [{ operationId: 'a' }, { operationId: 'b' }];
    const pendingOperations = vi.fn().mockResolvedValue(waiting);
    const store = { pendingOperations } as unknown as LocalStore;

    const found = await new StoreOutbox(() => store).pending(200);

    expect(found).toBe(waiting);
    expect(pendingOperations).toHaveBeenCalledWith(200);
  });
});
