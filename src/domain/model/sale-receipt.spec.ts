import { describe, expect, it } from 'vitest';
import type { Product } from './catalog';
import {
  EMPTY_CART,
  addProduct,
  cartSummary,
  setDiscount,
  setQuantity,
  type Cart,
} from './sale-cart';
import {
  buildReceipt,
  receiptLineLabel,
  saleBody,
  totalsByKind,
  type SalePayment,
} from './sale-receipt';

const AT = new Date('2026-10-19T20:42:00.000Z');

const product = (id: number, change: Partial<Product> = {}): Product => ({
  id: `f0000000-0000-4000-8000-00000000000${String(id)}`,
  name: `Producto ${String(id)}`,
  sku: `SKU-${String(id)}`,
  barcode: null,
  unit: 'unit',
  unitPrice: 1_000,
  taxRateBp: 0,
  taxKind: 'exempt',
  active: true,
  categoryId: null,
  minStockMilli: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  ...change,
});

const taxed = { taxRateBp: 1_900, taxKind: 'taxed' } as const;
const arroz = product(1, { name: 'Arroz 500 g', unitPrice: 3_200, ...taxed });
const aceite = product(2, { name: 'Aceite 1 L', unitPrice: 12_500, ...taxed });
const pan = product(3, { name: 'Pan tajado', unitPrice: 2_800, ...taxed });
const leche = product(4, { name: 'Leche 1 L', unitPrice: 4_000 });
const sal = product(5, { name: 'Sal', unitPrice: 1_500, taxKind: 'excluded' });

/** Una venta de las tres clases: 1 aceite gravado al 19 %, 2 leches exentas y 1 sal excluida con $ 100 de descuento. */
function mixedCart(): Cart {
  let sale = addProduct(EMPTY_CART, aceite);
  sale = setQuantity(addProduct(sale, leche), leche.id, 2_000);
  return setDiscount(addProduct(sale, sal), sal.id, 100);
}

/** La venta del diseno: 2 arroz, 1 aceite con $ 500 de descuento y 3 panes. */
function cart(): Cart {
  let sale = setQuantity(addProduct(EMPTY_CART, arroz), arroz.id, 2_000);
  sale = setDiscount(addProduct(sale, aceite), aceite.id, 500);
  return setQuantity(addProduct(sale, pan), pan.id, 3_000);
}

const cash: SalePayment = { method: 'cash', received: 30_000 };

const input = (payment: SalePayment = cash) => ({
  operationId: 'a0000000-0000-4000-8000-000000000010',
  shiftId: 'a0000000-0000-4000-8000-000000000001',
  folio: 'AA-000142',
  at: AT,
  clockOffsetMs: 1_500,
  cashier: 'Ana Gómez',
  shiftOpenedAt: '2026-10-19T13:02:00.000Z',
  cart: cart(),
  payment,
});

describe('the body of a sale', () => {
  it('is exactly what the route of the sale takes: the lines as they were sold, and the payment without the change', () => {
    expect(saleBody(input())).toEqual({
      operationId: 'a0000000-0000-4000-8000-000000000010',
      shiftId: 'a0000000-0000-4000-8000-000000000001',
      folio: 'AA-000142',
      total: 26_800,
      lines: [
        {
          productId: arroz.id,
          quantityMilli: 2_000,
          unitPrice: 3_200,
          discount: 0,
          taxRateBp: 1_900,
          taxKind: 'taxed',
        },
        {
          productId: aceite.id,
          quantityMilli: 1_000,
          unitPrice: 12_500,
          discount: 500,
          taxRateBp: 1_900,
          taxKind: 'taxed',
        },
        {
          productId: pan.id,
          quantityMilli: 3_000,
          unitPrice: 2_800,
          discount: 0,
          taxRateBp: 1_900,
          taxKind: 'taxed',
        },
      ],
      payments: [{ method: 'cash', amount: 26_800, reference: null }],
      deviceTime: '2026-10-19T20:42:00.000Z',
      clockOffsetMs: 1_500,
    });
  });

  it('carries the reference of a card payment, and no reference for cash', () => {
    const card = saleBody(input({ method: 'card', reference: 'Visa 4455' }));
    const transfer = saleBody(input({ method: 'transfer', reference: null }));

    expect(card['payments']).toEqual([{ method: 'card', amount: 26_800, reference: 'Visa 4455' }]);
    expect(transfer['payments']).toEqual([{ method: 'transfer', amount: 26_800, reference: null }]);
  });

  it('says nothing of the clock when it was never measured', () => {
    expect(saleBody({ ...input(), clockOffsetMs: null })['clockOffsetMs']).toBeNull();
  });
});

describe('the receipt of a sale', () => {
  it('keeps who sold, when, in which shift, and under what folio', () => {
    const receipt = buildReceipt(input());

    expect(receipt).toMatchObject({
      operationId: 'a0000000-0000-4000-8000-000000000010',
      folio: 'AA-000142',
      occurredAt: '2026-10-19T20:42:00.000Z',
      cashier: 'Ana Gómez',
      shiftOpenedAt: '2026-10-19T13:02:00.000Z',
    });
  });

  it('keeps each line as it was sold, with what it cost', () => {
    expect(buildReceipt(input()).lines).toEqual([
      {
        name: 'Arroz 500 g',
        quantityMilli: 2_000,
        unit: 'unit',
        unitPrice: 3_200,
        discount: 0,
        taxKind: 'taxed',
        total: 6_400,
      },
      {
        name: 'Aceite 1 L',
        quantityMilli: 1_000,
        unit: 'unit',
        unitPrice: 12_500,
        discount: 500,
        taxKind: 'taxed',
        total: 12_000,
      },
      {
        name: 'Pan tajado',
        quantityMilli: 3_000,
        unit: 'unit',
        unitPrice: 2_800,
        discount: 0,
        taxKind: 'taxed',
        total: 8_400,
      },
    ]);
  });

  it('splits the tax by rate, the same as the total of the cart', () => {
    const receipt = buildReceipt(input());
    const expected = cartSummary(cart());

    expect(receipt.summary.total).toBe(26_800);
    expect(receipt.summary.base).toBe(expected.base.amount);
    expect(receipt.summary.tax).toBe(expected.tax.amount);
    expect(receipt.summary.byRate).toEqual([{ rateBp: 1_900, base: 22_521, tax: 4_279 }]);
  });

  it('says what was received in cash, and the change', () => {
    expect(buildReceipt(input()).payment).toEqual({
      method: 'cash',
      received: 30_000,
      change: 3_200,
      reference: null,
    });
  });

  it('says there was no change for an exact amount', () => {
    expect(buildReceipt(input({ method: 'cash', received: 26_800 })).payment.change).toBe(0);
  });

  it('says there was nothing received in cash for a card or a transfer, and keeps its reference', () => {
    expect(buildReceipt(input({ method: 'card', reference: 'Visa 4455' })).payment).toEqual({
      method: 'card',
      received: null,
      change: 0,
      reference: 'Visa 4455',
    });
  });
});

describe('the tax kind of a sale (ADR 0034 of the backend)', () => {
  const mixed = () => ({ ...input(), cart: mixedCart() });

  it('goes in every line of the body, as it was sold, next to the rate', () => {
    const lines = saleBody(mixed())['lines'] as { taxKind: string; taxRateBp: number }[];

    expect(lines.map(({ taxKind, taxRateBp }) => [taxKind, taxRateBp])).toEqual([
      ['taxed', 1_900],
      ['exempt', 0],
      ['excluded', 0],
    ]);
  });

  it('goes in every line of the receipt', () => {
    expect(buildReceipt(mixed()).lines.map((line) => line.taxKind)).toEqual([
      'taxed',
      'exempt',
      'excluded',
    ]);
  });

  it('adds up what was sold exempt and what was sold excluded, discounts included', () => {
    const receipt = buildReceipt(mixed());

    expect(receipt.summary.total).toBe(21_900);
    expect(receipt.summary.byKind).toEqual({ exempt: 8_000, excluded: 1_400 });
  });

  it('adds up nothing for a sale of only taxed products', () => {
    expect(buildReceipt(input()).summary.byKind).toEqual({ exempt: 0, excluded: 0 });
  });

  it('keeps the IVA of the taxed lines only: the exempt and the excluded add none', () => {
    expect(buildReceipt(mixed()).summary.tax).toBe(1_996);
  });

  describe('totalsByKind', () => {
    it('adds the lines of each kind and leaves the taxed ones out', () => {
      expect(
        totalsByKind([
          { taxKind: 'exempt', total: 100 },
          { taxKind: 'taxed', total: 5_000 },
          { taxKind: 'excluded', total: 30 },
          { taxKind: 'exempt', total: 20 },
          { taxKind: 'excluded', total: 7 },
        ]),
      ).toEqual({ exempt: 120, excluded: 37 });
    });

    it('is zero for no lines', () => {
      expect(totalsByKind([])).toEqual({ exempt: 0, excluded: 0 });
    });
  });
});

describe('a line of the receipt, in a sentence', () => {
  it('is the quantity, the name and, when there is one, the discount', () => {
    const [arrozLine, aceiteLine] = buildReceipt(input()).lines;

    expect(receiptLineLabel(arrozLine!)).toBe('2 × Arroz 500 g');
    expect(receiptLineLabel(aceiteLine!)).toBe('1 × Aceite 1 L (− $ 500)');
  });

  it('says exempt or excluded at the end when the line carries no IVA, and nothing when it is taxed', () => {
    const [aceiteLine, lecheLine, salLine] = buildReceipt({ ...input(), cart: mixedCart() }).lines;

    expect(receiptLineLabel(aceiteLine!)).toBe('1 × Aceite 1 L');
    expect(receiptLineLabel(lecheLine!)).toBe('2 × Leche 1 L · Exento');
    expect(receiptLineLabel(salLine!)).toBe('1 × Sal (− $ 100) · Excluido');
  });

  it('says the unit and the decimals of what is weighed', () => {
    const queso = product(4, { name: 'Queso', unit: 'kilogram', unitPrice: 20_000, ...taxed });
    const sale = setQuantity(addProduct(EMPTY_CART, queso), queso.id, 1_250);

    const [line] = buildReceipt({ ...input(), cart: sale }).lines;

    expect(receiptLineLabel(line!)).toBe('1,25 kg × Queso');
  });
});
