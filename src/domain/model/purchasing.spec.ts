import { describe, expect, it } from 'vitest';
import { parsePurchase, parsePurchaseSummary, parseSupplier } from './purchasing';

const SUPPLIER = {
  id: 's-1',
  name: 'Distribuidora El Sol',
  contact: '300 123 4567',
  createdAt: '2026-10-17T12:00:00.000Z',
};

const SUMMARY = {
  id: 'c-1',
  operationId: 'o-1',
  warehouseId: 'w-1',
  supplierId: 's-1',
  note: 'Pedido de octubre',
  createdAt: '2026-10-17T16:00:00.000Z',
  createdByUserId: 'u-1',
  lineCount: 3,
};

const PURCHASE = {
  ...SUMMARY,
  lines: [
    { productId: 'p-1', quantityMilli: 24_000, unitCost: 2500 },
    { productId: 'p-2', quantityMilli: 12_500, unitCost: 4200 },
  ],
};

describe('parseSupplier', () => {
  it('reads a supplier', () => {
    expect(parseSupplier(SUPPLIER)).toEqual({
      ...SUPPLIER,
      createdAt: new Date('2026-10-17T12:00:00.000Z'),
    });
  });

  it('reads a supplier with no contact', () => {
    expect(parseSupplier({ ...SUPPLIER, contact: null })?.contact).toBeNull();
  });

  it.each([null, 'x', 3, [], {}])('does not believe a body that is not a supplier: %j', (body) => {
    expect(parseSupplier(body)).toBeNull();
  });

  it.each([
    ['id', 3],
    ['name', null],
    ['contact', 3],
    ['createdAt', 'ayer'],
  ])('does not believe a supplier whose %s is %j', (field, value) => {
    expect(parseSupplier({ ...SUPPLIER, [field]: value })).toBeNull();
  });

  it.each(['id', 'name', 'contact', 'createdAt'])(
    'does not believe a supplier without %s',
    (field) => {
      const { [field]: _omitted, ...rest } = SUPPLIER as Record<string, unknown>;
      expect(parseSupplier(rest)).toBeNull();
    },
  );
});

describe('parsePurchaseSummary', () => {
  it('reads the summary of a purchase', () => {
    expect(parsePurchaseSummary(SUMMARY)).toEqual({
      ...SUMMARY,
      createdAt: new Date('2026-10-17T16:00:00.000Z'),
    });
  });

  it('reads a purchase with no supplier, no note and no author', () => {
    const summary = parsePurchaseSummary({
      ...SUMMARY,
      supplierId: null,
      note: null,
      createdByUserId: null,
    });

    expect(summary).toMatchObject({ supplierId: null, note: null, createdByUserId: null });
  });

  it.each([null, 'x', 3, [], {}])('does not believe a body that is not a purchase: %j', (body) => {
    expect(parsePurchaseSummary(body)).toBeNull();
  });

  it.each([
    ['id', 3],
    ['operationId', null],
    ['warehouseId', 3],
    ['supplierId', 3],
    ['note', 3],
    ['createdByUserId', 3],
    ['createdAt', 'ayer'],
    ['lineCount', '3'],
    ['lineCount', 1.5],
    ['lineCount', -1],
  ])('does not believe a purchase whose %s is %j', (field, value) => {
    expect(parsePurchaseSummary({ ...SUMMARY, [field]: value })).toBeNull();
  });

  it.each([
    'id',
    'operationId',
    'warehouseId',
    'supplierId',
    'note',
    'createdAt',
    'createdByUserId',
    'lineCount',
  ])('does not believe a purchase without %s', (field) => {
    const { [field]: _omitted, ...rest } = SUMMARY as Record<string, unknown>;
    expect(parsePurchaseSummary(rest)).toBeNull();
  });
});

describe('parsePurchase', () => {
  it('reads a purchase with its lines', () => {
    const { lineCount: _count, ...summary } = SUMMARY;
    expect(parsePurchase(PURCHASE)).toEqual({
      ...summary,
      createdAt: new Date('2026-10-17T16:00:00.000Z'),
      lines: PURCHASE.lines,
    });
  });

  it.each([null, 'x', 3, [], {}])('does not believe a body that is not a purchase: %j', (body) => {
    expect(parsePurchase(body)).toBeNull();
  });

  it('does not believe a purchase without lines', () => {
    const { lines: _lines, ...rest } = PURCHASE;
    expect(parsePurchase(rest)).toBeNull();
    expect(parsePurchase({ ...PURCHASE, lines: 'x' })).toBeNull();
  });

  it.each([
    [{ productId: 3, quantityMilli: 1000, unitCost: 1 }],
    [{ productId: 'p', quantityMilli: '1000', unitCost: 1 }],
    [{ productId: 'p', quantityMilli: 1.5, unitCost: 1 }],
    [{ productId: 'p', quantityMilli: 1000, unitCost: '1' }],
    [{ productId: 'p', quantityMilli: 1000, unitCost: 1.5 }],
    [{ productId: 'p', quantityMilli: 1000 }],
    [null],
    ['x'],
  ])('does not believe a purchase with a line like %j', (line) => {
    expect(parsePurchase({ ...PURCHASE, lines: [PURCHASE.lines[0], line] })).toBeNull();
  });

  it('does not believe a purchase whose header is wrong', () => {
    expect(parsePurchase({ ...PURCHASE, id: 3 })).toBeNull();
    expect(parsePurchase({ ...PURCHASE, createdAt: 'ayer' })).toBeNull();
  });
});
