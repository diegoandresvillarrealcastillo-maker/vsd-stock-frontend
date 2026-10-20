import { describe, expect, it } from 'vitest';
import { DEVICE_CODE_ALPHABET, DeviceCode } from './device-code';

describe('device code alphabet', () => {
  it('has thirty characters and none that can be mistaken for another', () => {
    expect(DEVICE_CODE_ALPHABET).toHaveLength(30);
    expect(new Set(DEVICE_CODE_ALPHABET).size).toBe(30);
    for (const confusing of ['0', '1', 'I', 'L', 'O', 'U']) {
      expect(DEVICE_CODE_ALPHABET, confusing).not.toContain(confusing);
    }
  });

  it('starts with letters, so the first devices are AA, AB, AC...', () => {
    expect(DEVICE_CODE_ALPHABET.startsWith('ABCDEFGH')).toBe(true);
  });
});

describe('DeviceCode.parse', () => {
  it.each(['AA', 'K7', 'ZZ9', 'A2B3', '99'])('accepts "%s"', (text) => {
    expect(DeviceCode.parse(text).value).toBe(text);
  });

  it('reads lower case as upper case, because a person types it', () => {
    expect(DeviceCode.parse(' k7 ').value).toBe('K7');
  });

  it.each([
    ['', 'empty'],
    ['A', 'one character'],
    ['ABCDE', 'five characters'],
    ['A0', 'a zero'],
    ['A1', 'a one'],
    ['AO', 'a letter O'],
    ['AI', 'a letter I'],
    ['AL', 'a letter L'],
    ['AU', 'a letter U'],
    ['A-', 'a dash'],
    ['A B', 'a space inside'],
  ])('rejects "%s" (%s)', (text) => {
    expect(() => DeviceCode.parse(text)).toThrow(RangeError);
  });

  it('rejects what is not text', () => {
    expect(() => DeviceCode.parse(12 as never)).toThrow(RangeError);
  });

  it('is shown as its value', () => {
    expect(String(DeviceCode.parse('K7'))).toBe('K7');
  });

  it('cannot be changed once created', () => {
    const code = DeviceCode.parse('K7');

    expect(() => {
      (code as { value: string }).value = 'ZZ';
    }).toThrow(TypeError);
  });
});
