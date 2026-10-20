import { unitShort, type UnitCode } from './catalog';
import { formatPesos, formatQuantity } from './quantity';
import { cartSummary, lineTotalOf, type Cart } from './sale-cart';
import { changeOf, type PaymentMethod } from './sale-payment';

/** Como se cobro la venta: en efectivo, con lo que se recibio; con tarjeta o transferencia, con su referencia. */
export type SalePayment =
  | { readonly method: 'cash'; readonly received: number }
  | { readonly method: 'card' | 'transfer'; readonly reference: string | null };

interface SaleInput {
  readonly operationId: string;
  readonly shiftId: string;
  readonly folio: string;
  /** La hora del dispositivo al confirmar la venta. */
  readonly at: Date;
  /** Cuanto adelanta el servidor al reloj en la ultima medicion confiable (ADR 0016), o `null`. */
  readonly clockOffsetMs: number | null;
  readonly cashier: string;
  /** ISO 8601: cuando se abrio el turno en el que se vende. */
  readonly shiftOpenedAt: string;
  readonly cart: Cart;
  readonly payment: SalePayment;
}

/**
 * El cuerpo de una venta: EXACTAMENTE el de `POST /v1/sales` (ADR 0028). Las lineas van como se vendieron (precio y tarifa de cuando
 * se agregaron), el total es el que se le cobro al cliente y el cobro es el total, **sin el vuelto**: lo que quedo en la caja.
 */
export function saleBody(input: SaleInput): Record<string, unknown> {
  const total = cartSummary(input.cart).total.amount;
  return {
    operationId: input.operationId,
    shiftId: input.shiftId,
    folio: input.folio,
    total,
    lines: input.cart.lines.map((line) => ({
      productId: line.productId,
      quantityMilli: line.quantityMilli,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRateBp: line.taxRateBp,
    })),
    payments: [
      {
        method: input.payment.method,
        amount: total,
        reference: input.payment.method === 'cash' ? null : input.payment.reference,
      },
    ],
    deviceTime: input.at.toISOString(),
    clockOffsetMs: input.clockOffsetMs,
  };
}

export interface ReceiptLine {
  readonly name: string;
  readonly quantityMilli: number;
  readonly unit: UnitCode;
  readonly unitPrice: number;
  readonly discount: number;
  /** Lo que costo la linea: lo bruto menos la rebaja. */
  readonly total: number;
}

/** El comprobante de una venta (no es una factura): lo que se vendio, lo que se cobro y como. Se arma de lo mismo que se manda. */
export interface SaleReceipt {
  readonly operationId: string;
  readonly folio: string;
  /** ISO 8601: la hora del dispositivo al confirmar. */
  readonly occurredAt: string;
  readonly cashier: string;
  readonly shiftOpenedAt: string;
  readonly lines: readonly ReceiptLine[];
  readonly summary: {
    readonly base: number;
    readonly tax: number;
    readonly total: number;
    readonly byRate: readonly {
      readonly rateBp: number;
      readonly base: number;
      readonly tax: number;
    }[];
  };
  readonly payment: {
    readonly method: PaymentMethod;
    /** El efectivo que entrego quien compra; `null` si no pago en efectivo. */
    readonly received: number | null;
    readonly change: number;
    readonly reference: string | null;
  };
}

export function buildReceipt(input: SaleInput): SaleReceipt {
  const summary = cartSummary(input.cart);
  const { payment } = input;
  return {
    operationId: input.operationId,
    folio: input.folio,
    occurredAt: input.at.toISOString(),
    cashier: input.cashier,
    shiftOpenedAt: input.shiftOpenedAt,
    lines: input.cart.lines.map((line) => ({
      name: line.name,
      quantityMilli: line.quantityMilli,
      unit: line.unit,
      unitPrice: line.unitPrice,
      discount: line.discount,
      total: lineTotalOf(line),
    })),
    summary: {
      base: summary.base.amount,
      tax: summary.tax.amount,
      total: summary.total.amount,
      byRate: summary.byRate.map((row) => ({
        rateBp: row.rateBp,
        base: row.base.amount,
        tax: row.tax.amount,
      })),
    },
    payment:
      payment.method === 'cash'
        ? {
            method: 'cash',
            received: payment.received,
            change: changeOf(summary.total.amount, payment.received),
            reference: null,
          }
        : { method: payment.method, received: null, change: 0, reference: payment.reference },
  };
}

/** Una linea del comprobante como se dice: `2 × Arroz 500 g`, y la rebaja si la hay: `1 × Aceite 1 L (− $ 500)`. */
export function receiptLineLabel(line: ReceiptLine): string {
  const unit = line.unit === 'unit' ? '' : ` ${unitShort(line.unit)}`;
  const discount = line.discount > 0 ? ` (− ${formatPesos(line.discount)})` : '';
  return `${formatQuantity(line.quantityMilli)}${unit} × ${line.name}${discount}`;
}
