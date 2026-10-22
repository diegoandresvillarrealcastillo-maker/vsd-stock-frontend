import { afterEach, describe, expect, it } from 'vitest';
import { deferred } from './deferred';

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('deferred', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    unhandled.length = 0;
  });

  it('gives the value to whoever asks after it is resolved', async () => {
    const pending = deferred<number>();
    pending.resolve(7);

    expect(await pending.promise).toBe(7);
  });

  it('gives the rejection to whoever asks, even when it was rejected before anyone asked', async () => {
    const pending = deferred<number>();
    const failure = new Error('no hubo respuesta');
    pending.reject(failure);
    await nextTurn();

    await expect(pending.promise).rejects.toBe(failure);
  });

  it('does not report a rejection as unhandled just because nobody has asked for it yet', async () => {
    process.on('unhandledRejection', onUnhandled);
    const pending = deferred<number>();
    pending.reject(new Error('no hubo respuesta'));

    await nextTurn();

    expect(unhandled).toEqual([]);
  });
});
