import { describe, expect, it } from 'vitest';
import { RandomIdGenerator } from './random-id-generator';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('RandomIdGenerator', () => {
  it('makes version 4 identifiers with the variant that the standard asks for', () => {
    const ids = new RandomIdGenerator((bytes) => crypto.getRandomValues(bytes));

    for (let index = 0; index < 200; index += 1) {
      expect(ids.newId()).toMatch(UUID_V4);
    }
  });

  it('forces the version and the variant even when the random bytes would say otherwise', () => {
    const allOnes = new RandomIdGenerator((bytes) => bytes.fill(0xff));
    const allZeros = new RandomIdGenerator((bytes) => bytes.fill(0x00));

    expect(allOnes.newId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(allZeros.newId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('writes every byte in order, two hexadecimal digits each', () => {
    const counting = new RandomIdGenerator((bytes) => {
      bytes.forEach((_, index) => {
        bytes[index] = index * 16 + index;
      });
      return bytes;
    });

    expect(counting.newId()).toBe('00112233-4455-4677-8899-aabbccddeeff');
  });

  it('does not repeat itself', () => {
    const ids = new RandomIdGenerator((bytes) => crypto.getRandomValues(bytes));

    expect(new Set(Array.from({ length: 1000 }, () => ids.newId())).size).toBe(1000);
  });
});
