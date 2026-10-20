import { describe, expect, it } from 'vitest';
import { MathRandom } from './math-random';

describe('MathRandom', () => {
  it('gives numbers from zero up to, but not including, one', () => {
    const random = new MathRandom();

    for (let n = 0; n < 1000; n += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not give the same number every time', () => {
    const random = new MathRandom();

    expect(new Set(Array.from({ length: 20 }, () => random.next())).size).toBeGreaterThan(1);
  });
});
