import { describe, expect, it } from 'vitest';
import { parsePage } from './page';

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

describe('parsePage', () => {
  it('reads the items and the cursor of the next page', () => {
    expect(parsePage({ items: ['a', 'b'], nextCursor: 'siguiente' }, text)).toEqual({
      items: ['a', 'b'],
      nextCursor: 'siguiente',
    });
  });

  it('reads the last page: no cursor', () => {
    expect(parsePage({ items: [], nextCursor: null }, text)).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it.each([null, 'x', 3, [], {}, { items: 'a', nextCursor: null }])(
    'does not believe a body that is not a page: %j',
    (body) => {
      expect(parsePage(body, text)).toBeNull();
    },
  );

  it('does not believe a cursor that is not text', () => {
    expect(parsePage({ items: [], nextCursor: 3 }, text)).toBeNull();
  });

  it('does not believe a page with an item that is not what the contract says', () => {
    expect(parsePage({ items: ['a', 3], nextCursor: null }, text)).toBeNull();
  });

  it('does not believe a page without a cursor field', () => {
    expect(parsePage({ items: [] }, text)).toBeNull();
  });
});
