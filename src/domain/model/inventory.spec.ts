import { describe, expect, it } from 'vitest';
import { movementLabel, parseMovement, parseStockItem } from './inventory';

const STOCK = {
  productId: 'p-1',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  unit: 'unit',
  active: true,
  quantityMilli: 6000,
  minStockMilli: 10_000,
  belowMinimum: true,
};

const MOVEMENT = {
  id: 'm-1',
  operationId: 'o-1',
  productId: 'p-1',
  kind: 'adjustment',
  deltaMilli: -2000,
  reason: 'Se cayeron dos paquetes',
  createdAt: '2026-10-17T20:12:00.000Z',
};

describe('parseStockItem', () => {
  it('reads the stock of a product', () => {
    expect(parseStockItem(STOCK)).toEqual(STOCK);
  });

  it('reads a product with no minimum, an archived one and a negative stock', () => {
    const item = parseStockItem({
      ...STOCK,
      minStockMilli: null,
      belowMinimum: false,
      active: false,
      quantityMilli: -1500,
    });

    expect(item).toMatchObject({
      minStockMilli: null,
      belowMinimum: false,
      active: false,
      quantityMilli: -1500,
    });
  });

  it.each([null, 'x', 3, [], {}])('does not believe a body that is not stock: %j', (body) => {
    expect(parseStockItem(body)).toBeNull();
  });

  it.each([
    ['productId', 3],
    ['name', null],
    ['sku', 4],
    ['unit', 'box'],
    ['active', 'true'],
    ['quantityMilli', '6000'],
    ['quantityMilli', 1.5],
    ['minStockMilli', '10'],
    ['minStockMilli', 1.5],
    ['belowMinimum', 'true'],
  ])('does not believe stock whose %s is %j', (field, value) => {
    expect(parseStockItem({ ...STOCK, [field]: value })).toBeNull();
  });

  it.each([
    'productId',
    'name',
    'sku',
    'unit',
    'active',
    'quantityMilli',
    'minStockMilli',
    'belowMinimum',
  ])('does not believe stock without %s', (field) => {
    const { [field]: _omitted, ...rest } = STOCK as Record<string, unknown>;
    expect(parseStockItem(rest)).toBeNull();
  });
});

describe('parseMovement', () => {
  it('reads a movement', () => {
    expect(parseMovement(MOVEMENT)).toEqual({
      ...MOVEMENT,
      createdAt: new Date('2026-10-17T20:12:00.000Z'),
    });
  });

  it('reads a movement with no reason', () => {
    expect(parseMovement({ ...MOVEMENT, reason: null, kind: 'sale' })?.reason).toBeNull();
  });

  it.each(['sale', 'purchase', 'adjustment', 'void'])('reads the kind «%s»', (kind) => {
    expect(parseMovement({ ...MOVEMENT, kind })?.kind).toBe(kind);
  });

  it.each([null, 'x', 3, [], {}])('does not believe a body that is not a movement: %j', (body) => {
    expect(parseMovement(body)).toBeNull();
  });

  it.each([
    ['id', 3],
    ['operationId', null],
    ['productId', 4],
    ['kind', 'gift'],
    ['kind', 'toString'],
    ['deltaMilli', '2'],
    ['deltaMilli', 1.5],
    ['reason', 3],
    ['createdAt', 'ayer'],
    ['createdAt', 5],
  ])('does not believe a movement whose %s is %j', (field, value) => {
    expect(parseMovement({ ...MOVEMENT, [field]: value })).toBeNull();
  });

  it.each(['id', 'operationId', 'productId', 'kind', 'deltaMilli', 'reason', 'createdAt'])(
    'does not believe a movement without %s',
    (field) => {
      const { [field]: _omitted, ...rest } = MOVEMENT as Record<string, unknown>;
      expect(parseMovement(rest)).toBeNull();
    },
  );
});

describe('movementLabel', () => {
  it.each([
    ['sale', 'Venta'],
    ['purchase', 'Compra'],
    ['adjustment', 'Ajuste'],
    ['void', 'Anulación'],
  ] as const)('calls %s «%s»', (kind, label) => {
    expect(movementLabel(kind)).toBe(label);
  });
});
