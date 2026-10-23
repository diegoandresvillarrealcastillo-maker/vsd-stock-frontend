import type { Product, UnitCode } from './catalog';
import { MAX_PESOS, Money } from './money';
import { formatPesos, type Parsed } from './quantity';
import {
  MAX_QUANTITY_MILLI,
  grossLineTotal,
  lineTotal,
  summarizeSale,
  type SaleSummary,
} from './sale-totals';
import { unitIsWhole } from './catalog';
import type { TaxKind } from './tax';

/** Cuantas lineas caben en una venta: lo mismo que acepta el servidor. */
export const MAX_CART_LINES = 200;

/** Una unidad de lo que se vende, en milesimas: lo que se agrega cada vez que se toca o se lee un producto. */
const ONE_UNIT_MILLI = 1_000;

/**
 * Una linea del carrito: el producto tal como estaba en la copia cuando se agrego (nombre, precio y tarifa), la cantidad y la
 * rebaja de la linea. Hay una linea por producto. El precio y la tarifa se guardan aqui y no se vuelven a mirar en el catalogo:
 * lo que se le cobro al cliente es lo que se ve en la linea (ADR 0027).
 */
export interface CartLine {
  readonly productId: string;
  readonly name: string;
  readonly sku: string;
  readonly unit: UnitCode;
  /** Pesos enteros por unidad, con el IVA incluido. */
  readonly unitPrice: number;
  readonly taxRateBp: number;
  /** Gravado, exento o excluido, congelado como el precio y la tarifa (ADR 0034 del backend). */
  readonly taxKind: TaxKind;
  /** Milesimas de la unidad: 1,5 kg = 1500. */
  readonly quantityMilli: number;
  /** Rebaja de la linea en pesos, con el IVA incluido. */
  readonly discount: number;
}

export interface Cart {
  readonly lines: readonly CartLine[];
}

export const EMPTY_CART: Cart = { lines: [] };

/** El carrito de siempre es inmutable: cada cambio da uno nuevo y el anterior no se toca. */
function replaceLine(cart: Cart, productId: string, change: (line: CartLine) => CartLine): Cart {
  if (!cart.lines.some((line) => line.productId === productId)) {
    throw new RangeError(`The product ${productId} is not in the cart`);
  }
  return {
    lines: cart.lines.map((line) => (line.productId === productId ? change(line) : line)),
  };
}

/** Lo que vale la linea sin la rebaja: precio por cantidad, redondeado al peso. */
export function lineGross(line: CartLine): number {
  return grossLineTotal(Money.of(line.unitPrice), line.quantityMilli).amount;
}

/** Lo que cuesta la linea: lo bruto menos la rebaja. */
export function lineTotalOf(line: CartLine): number {
  return lineTotal({
    unitPrice: Money.of(line.unitPrice),
    quantityMilli: line.quantityMilli,
    discount: Money.of(line.discount),
    rateBp: line.taxRateBp,
  }).amount;
}

/** Si el producto se puede agregar: no esta archivado, hay lugar en la venta y la linea que ya tiene no esta en el maximo. */
export function canAdd(cart: Cart, product: Product): boolean {
  if (!product.active) return false;
  const existing = cart.lines.find((line) => line.productId === product.id);
  if (existing === undefined) return cart.lines.length < MAX_CART_LINES;
  return existing.quantityMilli < MAX_QUANTITY_MILLI;
}

/**
 * Agrega una unidad del producto: si ya estaba, le suma una unidad a su linea; si no, abre una linea nueva con el precio y la tarifa
 * de ahora. Lo que no se puede agregar (archivado, la venta llena, la cantidad en su maximo) devuelve el mismo carrito.
 */
export function addProduct(cart: Cart, product: Product): Cart {
  if (!canAdd(cart, product)) return cart;
  const existing = cart.lines.find((line) => line.productId === product.id);
  if (existing !== undefined) {
    return replaceLine(cart, product.id, (line) => ({
      ...line,
      quantityMilli: Math.min(line.quantityMilli + ONE_UNIT_MILLI, MAX_QUANTITY_MILLI),
    }));
  }
  return {
    lines: [
      ...cart.lines,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        unitPrice: product.unitPrice,
        taxRateBp: product.taxRateBp,
        taxKind: product.taxKind,
        quantityMilli: ONE_UNIT_MILLI,
        discount: 0,
      },
    ],
  };
}

/**
 * Cambia la cantidad de una linea. Lo que no es una cantidad (cero, negativa, con decimales de milesima, mas del maximo, o con
 * decimales en algo que se cuenta de a uno) lanza `RangeError`: la pantalla ya lo valido. Si la rebaja pasa a ser mayor que lo que
 * vale la linea, se baja a lo que vale: nunca queda una linea que cueste menos que nada.
 */
export function setQuantity(cart: Cart, productId: string, quantityMilli: number): Cart {
  if (!Number.isInteger(quantityMilli) || quantityMilli < 1 || quantityMilli > MAX_QUANTITY_MILLI) {
    throw new RangeError(`Not a quantity: ${String(quantityMilli)}`);
  }
  return replaceLine(cart, productId, (line) => {
    if (unitIsWhole(line.unit) && quantityMilli % ONE_UNIT_MILLI !== 0) {
      throw new RangeError('This product is counted in whole units');
    }
    const next = { ...line, quantityMilli };
    return { ...next, discount: Math.min(line.discount, lineGross(next)) };
  });
}

/** Pone la rebaja de una linea, en pesos: de cero a lo que vale la linea. Otra cosa lanza `RangeError`. */
export function setDiscount(cart: Cart, productId: string, discount: number): Cart {
  return replaceLine(cart, productId, (line) => {
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > lineGross(line)) {
      throw new RangeError(`Not a discount for this line: ${String(discount)}`);
    }
    return { ...line, discount };
  });
}

/** Saca una linea. Si el producto no estaba, no pasa nada. */
export function removeLine(cart: Cart, productId: string): Cart {
  if (!cart.lines.some((line) => line.productId === productId)) return cart;
  return { lines: cart.lines.filter((line) => line.productId !== productId) };
}

/** El total de la venta y el IVA desglosado por tarifa, con el mismo calculo del servidor (ADR 0014). */
export function cartSummary(cart: Cart): SaleSummary {
  return summarizeSale(
    cart.lines.map((line) => ({
      unitPrice: Money.of(line.unitPrice),
      quantityMilli: line.quantityMilli,
      discount: Money.of(line.discount),
      rateBp: line.taxRateBp,
    })),
  );
}

/** Lo que se avisa de la existencia de una linea: no queda nada, o queda menos de lo que se vende. Solo avisa: la venta se puede hacer. */
export type StockWarning =
  { readonly kind: 'none' } | { readonly kind: 'short'; readonly leftMilli: number };

export function stockWarning(line: CartLine, stockMilli: number | null): StockWarning | null {
  if (stockMilli === null) return null;
  if (stockMilli <= 0) return { kind: 'none' };
  return line.quantityMilli > stockMilli ? { kind: 'short', leftMilli: stockMilli } : null;
}

/**
 * Lee la rebaja que una persona escribio: solo digitos, porque un punto o una coma es ambiguo (ADR 0014). Vacio es sin rebaja, y
 * no puede pasar de lo que vale la linea.
 */
export function parseDiscount(text: string, gross: number): Parsed {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: 0 };
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: 'Escribe el descuento en pesos, solo con números.' };
  }
  const value = Number(trimmed);
  if (value > Math.min(gross, MAX_PESOS)) {
    return {
      ok: false,
      message: `El descuento no puede pasar del valor de la línea: ${formatPesos(gross)}.`,
    };
  }
  return { ok: true, value };
}
