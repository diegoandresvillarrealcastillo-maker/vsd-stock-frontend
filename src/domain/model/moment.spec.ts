import { describe, expect, it } from 'vitest';
import { formatDay, formatMoment, formatTime } from './moment';

describe('formatTime', () => {
  it.each([
    [new Date(2026, 9, 17, 15, 12), '3:12 p. m.'],
    [new Date(2026, 9, 16, 11, 2), '11:02 a. m.'],
    [new Date(2026, 9, 16, 0, 5), '12:05 a. m.'],
    [new Date(2026, 9, 16, 12, 0), '12:00 p. m.'],
    [new Date(2026, 0, 1, 23, 59), '11:59 p. m.'],
  ])('writes %s as «%s»', (date, text) => {
    expect(formatTime(date)).toBe(text);
  });
});

describe('formatMoment', () => {
  it.each([
    [new Date(2026, 9, 17, 15, 12), '17 oct, 3:12 p. m.'],
    [new Date(2026, 9, 16, 11, 2), '16 oct, 11:02 a. m.'],
    [new Date(2026, 9, 16, 0, 5), '16 oct, 12:05 a. m.'],
    [new Date(2026, 9, 16, 12, 0), '16 oct, 12:00 p. m.'],
    [new Date(2026, 0, 1, 23, 59), '1 ene, 11:59 p. m.'],
    [new Date(2026, 11, 31, 9, 30), '31 dic, 9:30 a. m.'],
  ])('writes %s as «%s»', (date, text) => {
    expect(formatMoment(date)).toBe(text);
  });
});

describe('formatDay', () => {
  it.each([
    [new Date(2026, 9, 3, 23, 59), '3 oct'],
    [new Date(2026, 1, 28, 0, 0), '28 feb'],
    [new Date(2026, 2, 1), '1 mar'],
    [new Date(2026, 3, 1), '1 abr'],
    [new Date(2026, 4, 1), '1 may'],
    [new Date(2026, 5, 1), '1 jun'],
    [new Date(2026, 6, 1), '1 jul'],
    [new Date(2026, 7, 1), '1 ago'],
    [new Date(2026, 8, 1), '1 sep'],
    [new Date(2026, 10, 1), '1 nov'],
  ])('writes %s as «%s»', (date, text) => {
    expect(formatDay(date)).toBe(text);
  });
});
