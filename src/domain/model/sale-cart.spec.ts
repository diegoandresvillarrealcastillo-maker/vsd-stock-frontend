import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import { MAX_PESOS } from './money';
import {
  EMPTY_CART,
  MAX_CART_LINES,
  addProduct,
  canAdd,
  cartSummary,
  lineGross,
  lineTotalOf,
  parseDiscount,
  removeLine,
  setDiscount,
  setQuantity,
  stockWarning,
} from './sale-cart';
import { MAX_QUANTITY_MILLI } from './sale-totals';

let counter = 0;
const product = (change: Partial<Product> = {}): Product => {
  counter += 1;
  return {
    id: `f0000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    name: `Producto ${String(counter)}`,
    sku: `SKU-${String(counter)}`,
    barcode: null,
    unit: 'unit',
    unitPrice: 3_200,
    taxRateBp: 0,
    taxKind: 'exempt',
    active: true,
    categoryId: null,
    minStockMilli: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...change,
  };
};

const arroz = product({ name: 'Arroz 500 g', unitPrice: 3_200, taxRateBp: 0, taxKind: 'exempt' });
const aceite = product({
  name: 'Aceite 1 L',
  unitPrice: 12_500,
  taxRateBp: 1_900,
  taxKind: 'taxed',
});
const pan = product({ name: 'Pan tajado', unitPrice: 2_800, taxRateBp: 500, taxKind: 'taxed' });

describe('the cart of a sale', () => {
  it('starts with nothing, and a total of zero', () => {
    expect(EMPTY_CART.lines).toEqual([]);
    expect(cartSummary(EMPTY_CART).total.amount).toBe(0);
  });

  describe('adding a product', () => {
    it('puts one unit of it, with the price and the tax it has now', () => {
      const cart = addProduct(EMPTY_CART, aceite);

      expect(cart.lines).toEqual([
        {
          productId: aceite.id,
          name: 'Aceite 1 L',
          sku: aceite.sku,
          unit: 'unit',
          unitPrice: 12_500,
          taxRateBp: 1_900,
          taxKind: 'taxed',
          quantityMilli: 1_000,
          discount: 0,
        },
      ]);
    });

    it.each([
      ['taxed', 1_900],
      ['exempt', 0],
      ['excluded', 0],
    ] as const)(
      'puts the line down as %s, the way the product was classified',
      (taxKind, taxRateBp) => {
        const classified = product({ taxKind, taxRateBp });

        expect(addProduct(EMPTY_CART, classified).lines[0]).toMatchObject({ taxKind, taxRateBp });
      },
    );

    it('keeps the kind it had when the product was added, whatever the catalogue says later', () => {
      const cart = addProduct(EMPTY_CART, arroz);
      const reclassified = { ...arroz, taxKind: 'excluded' } as const;

      // Sumar otra unidad con el producto ya cambiado no cambia lo que se le cobro a la linea que ya estaba.
      expect(addProduct(cart, reclassified).lines[0]?.taxKind).toBe('exempt');
    });

    it('adds another unit to the line it already has, instead of repeating the product', () => {
      const cart = addProduct(addProduct(EMPTY_CART, arroz), arroz);

      expect(cart.lines).toHaveLength(1);
      expect(cart.lines[0]?.quantityMilli).toBe(2_000);
    });

    it('keeps the order in which the products were added', () => {
      const cart = addProduct(addProduct(addProduct(EMPTY_CART, arroz), aceite), pan);

      expect(cart.lines.map((line) => line.name)).toEqual([
        'Arroz 500 g',
        'Aceite 1 L',
        'Pan tajado',
      ]);
    });

    it('does not change the cart it was given', () => {
      const cart = addProduct(EMPTY_CART, arroz);
      addProduct(cart, arroz);

      expect(cart.lines[0]?.quantityMilli).toBe(1_000);
      expect(EMPTY_CART.lines).toEqual([]);
    });

    it('does not sell what is archived', () => {
      const archived = product({ active: false });

      expect(canAdd(EMPTY_CART, archived)).toBe(false);
      expect(addProduct(EMPTY_CART, archived)).toBe(EMPTY_CART);
    });

    it('does not go past the largest quantity of a line', () => {
      let cart = setQuantity(addProduct(EMPTY_CART, arroz), arroz.id, MAX_QUANTITY_MILLI);

      expect(canAdd(cart, arroz)).toBe(false);
      cart = addProduct(cart, arroz);

      expect(cart.lines[0]?.quantityMilli).toBe(MAX_QUANTITY_MILLI);
    });

    it('takes as many lines as the server does: two hundred', () => {
      expect(MAX_CART_LINES).toBe(200);
      let cart = EMPTY_CART;
      for (let n = 0; n < 200; n += 1) cart = addProduct(cart, product());

      expect(cart.lines).toHaveLength(200);
      expect(addProduct(cart, product()).lines).toHaveLength(200);
    });

    it('adds up to the largest quantity and no further when less than one unit is left to it', () => {
      const kilos = product({ unit: 'kilogram', unitPrice: 8_000 });
      let cart = setQuantity(addProduct(EMPTY_CART, kilos), kilos.id, MAX_QUANTITY_MILLI - 500);

      expect(canAdd(cart, kilos)).toBe(true);
      cart = addProduct(cart, kilos);

      expect(cart.lines[0]?.quantityMilli).toBe(MAX_QUANTITY_MILLI);
    });

    it('does not take more lines than a sale has room for, but still adds units to the ones it has', () => {
      let cart = EMPTY_CART;
      const first = product();
      cart = addProduct(cart, first);
      for (let n = 1; n < MAX_CART_LINES; n += 1) cart = addProduct(cart, product());
      expect(cart.lines).toHaveLength(MAX_CART_LINES);

      expect(canAdd(cart, product())).toBe(false);
      expect(addProduct(cart, product())).toBe(cart);
      expect(canAdd(cart, first)).toBe(true);
      expect(addProduct(cart, first).lines[0]?.quantityMilli).toBe(2_000);
    });
  });

  describe('the quantity of a line', () => {
    it('changes it, and keeps the rest of the line', () => {
      const cart = setQuantity(addProduct(EMPTY_CART, arroz), arroz.id, 3_000);

      expect(cart.lines[0]).toMatchObject({ quantityMilli: 3_000, unitPrice: 3_200 });
    });

    it('leaves the other lines as they were', () => {
      const cart = setQuantity(addProduct(addProduct(EMPTY_CART, arroz), pan), pan.id, 3_000);

      expect(cart.lines.map((line) => line.quantityMilli)).toEqual([1_000, 3_000]);
    });

    it.each([0, -1_000, 1.5, Number.NaN, MAX_QUANTITY_MILLI + 1])(
      'does not take %s',
      (quantity) => {
        const cart = addProduct(EMPTY_CART, arroz);

        expect(() => setQuantity(cart, arroz.id, quantity)).toThrow(/Not a quantity/);
      },
    );

    it('takes only whole units for what is counted one by one', () => {
      const cart = addProduct(EMPTY_CART, arroz);

      expect(() => setQuantity(cart, arroz.id, 1_500)).toThrow(RangeError);
    });

    it('takes decimals for what is weighed', () => {
      const kilos = product({ unit: 'kilogram', unitPrice: 8_000 });
      const cart = setQuantity(addProduct(EMPTY_CART, kilos), kilos.id, 1_250);

      expect(cart.lines[0]?.quantityMilli).toBe(1_250);
      expect(lineGross(cart.lines[0]!)).toBe(10_000);
    });

    it('lowers the discount to what the line is worth now when the quantity goes down', () => {
      let cart = setQuantity(addProduct(EMPTY_CART, arroz), arroz.id, 3_000);
      cart = setDiscount(cart, arroz.id, 9_000);

      cart = setQuantity(cart, arroz.id, 1_000);

      expect(cart.lines[0]?.discount).toBe(3_200);
    });

    it('says nothing is there when it is a product that is not in the cart', () => {
      expect(() => setQuantity(EMPTY_CART, 'no-esta', 1_000)).toThrow(RangeError);
    });
  });

  describe('the discount of a line', () => {
    it('lowers what the line costs, with the tax already inside', () => {
      const cart = setDiscount(addProduct(EMPTY_CART, aceite), aceite.id, 500);

      expect(lineGross(cart.lines[0]!)).toBe(12_500);
      expect(lineTotalOf(cart.lines[0]!)).toBe(12_000);
    });

    it('can be everything the line is worth, and not a peso more', () => {
      const cart = addProduct(EMPTY_CART, arroz);

      expect(setDiscount(cart, arroz.id, 3_200).lines[0]?.discount).toBe(3_200);
      expect(() => setDiscount(cart, arroz.id, 3_201)).toThrow(RangeError);
    });

    it.each([-1, 10.5, Number.NaN])('does not take %s', (discount) => {
      expect(() => setDiscount(addProduct(EMPTY_CART, arroz), arroz.id, discount)).toThrow(
        RangeError,
      );
    });

    it('can be taken away with zero', () => {
      const cart = setDiscount(addProduct(EMPTY_CART, arroz), arroz.id, 200);

      expect(setDiscount(cart, arroz.id, 0).lines[0]?.discount).toBe(0);
    });
  });

  describe('removing a line', () => {
    it('takes out that line and no other', () => {
      const cart = removeLine(addProduct(addProduct(EMPTY_CART, arroz), pan), arroz.id);

      expect(cart.lines.map((line) => line.name)).toEqual(['Pan tajado']);
    });

    it('does nothing for a product that is not there', () => {
      const cart = addProduct(EMPTY_CART, arroz);

      expect(removeLine(cart, 'no-esta')).toBe(cart);
    });
  });

  describe('the total, with the tax split by rate', () => {
    it('adds up the lines, with each rate on its own', () => {
      let cart = setQuantity(addProduct(EMPTY_CART, arroz), arroz.id, 2_000);
      cart = setDiscount(addProduct(cart, aceite), aceite.id, 500);
      cart = setQuantity(addProduct(cart, pan), pan.id, 3_000);

      const summary = cartSummary(cart);

      expect(summary.total.amount).toBe(6_400 + 12_000 + 8_400);
      expect(summary.byRate.map((row) => row.rateBp)).toEqual([0, 500, 1_900]);
      expect(summary.byRate.map((row) => row.total.amount)).toEqual([6_400, 8_400, 12_000]);
      expect(summary.base.amount + summary.tax.amount).toBe(summary.total.amount);
    });

    it('is the same as the server calculates: the base and the tax of a nineteen percent line', () => {
      const cart = setQuantity(addProduct(EMPTY_CART, aceite), aceite.id, 2_000);

      const { base, tax, total } = cartSummary(cart);

      expect([base.amount, tax.amount, total.amount]).toEqual([21_008, 3_992, 25_000]);
    });
  });

  describe('what is left of what the line sells', () => {
    const line = () => addProduct(EMPTY_CART, arroz).lines[0]!;

    it('does not warn when the quantity is not known: there is nothing to compare', () => {
      expect(stockWarning(line(), null)).toBeNull();
    });

    it('does not warn when there is enough', () => {
      expect(stockWarning(line(), 1_000)).toBeNull();
      expect(stockWarning(line(), 12_000)).toBeNull();
    });

    it('says there is none when nothing is left, or less than nothing', () => {
      expect(stockWarning(line(), 0)).toEqual({ kind: 'none' });
      expect(stockWarning(line(), -2_000)).toEqual({ kind: 'none' });
    });

    it('says how much is left when it is not enough', () => {
      const two = setQuantity(addProduct(EMPTY_CART, arroz), arroz.id, 3_000).lines[0]!;

      expect(stockWarning(two, 2_000)).toEqual({ kind: 'short', leftMilli: 2_000 });
    });
  });

  describe('the discount a person writes', () => {
    it('is nothing when it is left empty', () => {
      expect(parseDiscount('', 3_200)).toEqual({ ok: true, value: 0 });
      expect(parseDiscount('   ', 3_200)).toEqual({ ok: true, value: 0 });
    });

    it('is the pesos that were written, up to what the line is worth', () => {
      expect(parseDiscount('500', 3_200)).toEqual({ ok: true, value: 500 });
      expect(parseDiscount('3200', 3_200)).toEqual({ ok: true, value: 3_200 });
    });

    it('is not more than the line is worth', () => {
      expect(parseDiscount('3201', 3_200)).toEqual({
        ok: false,
        message: 'El descuento no puede pasar del valor de la línea: $ 3.200.',
      });
    });

    it.each(['5o', '1.000', '1,5', '-5', '$ 500'])(
      'does not guess what %j means: only digits',
      (text) => {
        expect(parseDiscount(text, 3_200)).toEqual({
          ok: false,
          message: 'Escribe el descuento en pesos, solo con números.',
        });
      },
    );

    it('does not take a number the system can not hold', () => {
      expect(parseDiscount(String(MAX_PESOS + 1), MAX_PESOS)).toMatchObject({ ok: false });
      expect(parseDiscount(String(MAX_PESOS + 1), MAX_PESOS + 10)).toMatchObject({ ok: false });
      expect(parseDiscount(String(MAX_PESOS), MAX_PESOS + 10)).toEqual({
        ok: true,
        value: MAX_PESOS,
      });
    });
  });
});
