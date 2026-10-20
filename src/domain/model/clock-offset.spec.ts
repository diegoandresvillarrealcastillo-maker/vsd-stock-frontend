import { describe, expect, it } from 'vitest';
import { MAX_ROUND_TRIP_MS, measureClockOffsetMs } from './clock-offset';

const at = (seconds: number, ms = 0) => new Date(Date.UTC(2026, 9, 19, 12, 0, seconds, ms));

describe('measuring how far the clock of the device is from the server', () => {
  it('is zero when both say the same hour at the middle of the trip', () => {
    // Salio a las 12:00:00 y volvio a las 12:00:02: a la mitad, 12:00:01.
    expect(measureClockOffsetMs(at(1), at(0), at(2))).toBe(0);
  });

  it('is how much the server is ahead of the device, with the sign of the ADR 0016', () => {
    expect(measureClockOffsetMs(at(61), at(0), at(2))).toBe(60_000);
    expect(measureClockOffsetMs(at(1, 500), at(0), at(2))).toBe(500);
  });

  it('is negative when the server is behind the device', () => {
    expect(measureClockOffsetMs(at(1), at(30), at(32))).toBe(-30_000);
  });

  it('rounds to a whole number of milliseconds', () => {
    expect(measureClockOffsetMs(at(0, 1), at(0), at(0, 1))).toBe(1);
    expect(Number.isInteger(measureClockOffsetMs(at(0, 7), at(0), at(0, 4)))).toBe(true);
  });

  it('trusts a trip of five seconds, and not one of a millisecond more', () => {
    expect(MAX_ROUND_TRIP_MS).toBe(5_000);
    expect(measureClockOffsetMs(at(2, 500), at(0), at(5))).toBe(0);
    expect(measureClockOffsetMs(at(2, 500), at(0), at(5, 1))).toBeNull();
  });

  it('is nothing when the clock moved while waiting: the trip would have gone back in time', () => {
    expect(measureClockOffsetMs(at(1), at(5), at(2))).toBeNull();
  });

  it('is nothing when a date is not a date', () => {
    expect(measureClockOffsetMs(new Date('nada'), at(0), at(1))).toBeNull();
    expect(measureClockOffsetMs(at(1), new Date('nada'), at(2))).toBeNull();
    expect(measureClockOffsetMs(at(1), at(0), new Date('nada'))).toBeNull();
  });

  it('accepts a trip that took no time at all', () => {
    expect(measureClockOffsetMs(at(3), at(1), at(1))).toBe(2_000);
  });
});
