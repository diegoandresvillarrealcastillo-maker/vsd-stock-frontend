import type { Product } from '../../src/domain/model/catalog';
import { EMPTY_CART, addProduct, cartSummary, type Cart } from '../../src/domain/model/sale-cart';
import type { SalePayment, SaleReceipt } from '../../src/domain/model/sale-receipt';
import type { Selling, SellingState } from '../../src/domain/ports/in/selling';

// El punto de venta de mentira para las pruebas del proveedor: cuenta lo que le piden. El caso de uso real se prueba aparte
// (`selling.usecase.spec.ts`) y las pantallas se prueban con el real (`fake-selling.ts`).

export class FakeSelling implements Selling {
  starts = 0;
  stops = 0;
  readonly added: Product[] = [];
  readonly quantities: [string, number][] = [];
  readonly discounts: [string, number][] = [];
  readonly removed: string[] = [];
  readonly confirmed: SalePayment[] = [];
  clears = 0;
  newSales = 0;
  private state: SellingState = stateOf(EMPTY_CART, null);
  private readonly listeners = new Set<() => void>();

  current(): SellingState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }

  add(product: Product): void {
    this.added.push(product);
    this.set(addProduct(this.state.cart, product), null);
  }

  setQuantity(productId: string, quantityMilli: number): void {
    this.quantities.push([productId, quantityMilli]);
  }

  setDiscount(productId: string, discount: number): void {
    this.discounts.push([productId, discount]);
  }

  remove(productId: string): void {
    this.removed.push(productId);
  }

  clear(): void {
    this.clears += 1;
  }

  confirm(payment: SalePayment): Promise<SaleReceipt> {
    this.confirmed.push(payment);
    return Promise.reject(new Error('la venta de mentira no cobra'));
  }

  newSale(): void {
    this.newSales += 1;
  }

  /** La venta cambia: la interfaz se entera como se enteraria de la real. El estado nuevo es otro objeto. */
  set(cart: Cart, receipt: SaleReceipt | null): void {
    this.state = stateOf(cart, receipt);
    for (const listener of [...this.listeners]) listener();
  }

  get subscribers(): number {
    return this.listeners.size;
  }
}

function stateOf(cart: Cart, receipt: SaleReceipt | null): SellingState {
  return { cart, summary: cartSummary(cart), receipt };
}
