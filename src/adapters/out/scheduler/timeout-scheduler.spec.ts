import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeoutScheduler } from './timeout-scheduler';

describe('TimeoutScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the callback once, after the delay and not before', () => {
    const callback = vi.fn();
    new TimeoutScheduler().schedule(callback, 5_000);

    vi.advanceTimersByTime(4_999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not run the callback once it is cancelled', () => {
    const callback = vi.fn();
    const cancel = new TimeoutScheduler().schedule(callback, 5_000);

    cancel();
    vi.advanceTimersByTime(60_000);

    expect(callback).not.toHaveBeenCalled();
  });

  it('can be cancelled twice, or after it ran, without a problem', () => {
    const callback = vi.fn();
    const cancel = new TimeoutScheduler().schedule(callback, 10);
    vi.advanceTimersByTime(10);

    expect(() => {
      cancel();
      cancel();
    }).not.toThrow();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
