// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

describe('contrastRatio', () => {
  it('is 21 between black and white, the maximum possible', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('is 1 between a color and itself, the minimum possible', () => {
    expect(contrastRatio('#0b6e3a', '#0b6e3a')).toBeCloseTo(1, 5);
  });

  it('does not depend on which color is the text and which the background', () => {
    expect(contrastRatio('#0b6e3a', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#0b6e3a'),
      10,
    );
  });

  it('matches the known value for gray 767676 on white, the lightest gray that passes AA', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('reads the short form of a hex color', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
  });

  it('rejects a color that is not hexadecimal, so a typo in a token cannot pass silently', () => {
    expect(() => contrastRatio('green', '#ffffff')).toThrow(/color/i);
  });
});
