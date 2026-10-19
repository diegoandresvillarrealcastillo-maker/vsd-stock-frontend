import type { Product } from '../../domain/model/catalog';
import {
  EmptySaleError,
  NoWorkspaceError,
  ShiftRequiredError,
} from '../../domain/model/local-errors';
import {
  EMPTY_CART,
  addProduct,
  cartSummary,
  removeLine,
  setDiscount,
  setQuantity,
  type Cart,
} from '../../domain/model/sale-cart';
import {
  buildReceipt,
  saleBody,
  type SalePayment,
  type SaleReceipt,
} from '../../domain/model/sale-receipt';
import { recordSale } from '../../domain/model/shift';
import type { LocalWorkspace } from '../../domain/ports/in/local-workspace';
import type { ReadCopy } from '../../domain/ports/in/read-copy';
import type { Selling, SellingState } from '../../domain/ports/in/selling';
import type { Shifts } from '../../domain/ports/in/shifts';
import type { SyncEngine } from '../../domain/ports/in/sync-engine';
import type { Clock } from '../../domain/ports/out/clock';
import type { IdGenerator } from '../../domain/ports/out/id-generator';

interface Dependencies {
  readonly workspace: LocalWorkspace;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Del motor de envio: avisarle de lo que se puso en la cola y saber cuanto se adelanta el servidor. */
  readonly sync: Pick<SyncEngine, 'queued' | 'clockOffsetMs'>;
  /** Del turno: que vuelva a leer sus totales, que esta venta acaba de cambiar. */
  readonly shifts: Pick<Shifts, 'refresh'>;
  /** De la copia: descontar lo vendido de la existencia que se muestra. */
  readonly copy: Pick<ReadCopy, 'sold'>;
}

function stateOf(cart: Cart, receipt: SaleReceipt | null): SellingState {
  return { cart, summary: cartSummary(cart), receipt };
}

/**
 * El punto de venta (C3-12, ADR 0027). Arma la venta de quien trabaja y la cobra: el turno, el folio, la venta y su operacion de la
 * cola se escriben juntos en la base cifrada (si algo falla a la mitad, no queda nada), y despues se avisa al envio, al turno y a la
 * copia. La venta que se esta armando vive en memoria y es de UNA persona: si cambia quien trabaja, se descarta.
 */
export class SellingUseCase implements Selling {
  private state: SellingState = stateOf(EMPTY_CART, null);
  private readonly listeners = new Set<() => void>();
  private started = false;
  private stops: (() => void)[] = [];
  /** De quien es la venta que se arma. Cambiar el codigo del dispositivo no cambia de persona: la venta sigue. */
  private person: string | null = null;
  /** Cobrar se hace de a una: la segunda vez que se toca ve el carrito que dejo la primera. */
  private turn: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: Dependencies) {}

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
    if (this.started) return;
    this.started = true;
    this.person = this.deps.workspace.current()?.profile.authUserId ?? null;
    this.stops.push(
      this.deps.workspace.subscribe(() => {
        const now = this.deps.workspace.current()?.profile.authUserId ?? null;
        if (now === this.person) return;
        this.person = now;
        this.update(EMPTY_CART, null);
      }),
    );
  }

  stop(): void {
    this.started = false;
    for (const stop of this.stops) stop();
    this.stops = [];
  }

  // El comprobante solo existe con el carrito vacio (se cobro y no se empezo otra venta): agregar un producto empieza otra y lo cierra,
  // y lo demas solo cambia un carrito que ya tiene lineas, o sea, uno que ya no tiene comprobante.
  add(product: Product): void {
    const next = addProduct(this.state.cart, product);
    if (next !== this.state.cart) this.update(next, null);
  }

  setQuantity(productId: string, quantityMilli: number): void {
    this.update(setQuantity(this.state.cart, productId, quantityMilli), null);
  }

  setDiscount(productId: string, discount: number): void {
    this.update(setDiscount(this.state.cart, productId, discount), null);
  }

  remove(productId: string): void {
    const next = removeLine(this.state.cart, productId);
    if (next !== this.state.cart) this.update(next, null);
  }

  clear(): void {
    if (this.state.cart.lines.length > 0) this.update(EMPTY_CART, null);
  }

  newSale(): void {
    this.update(EMPTY_CART, null);
  }

  confirm(payment: SalePayment): Promise<SaleReceipt> {
    const result = this.turn.then(
      () => this.charge(payment),
      () => this.charge(payment),
    );
    // La siguiente se encadena con `then(a, a)`: sigue aunque esta haya fallado.
    this.turn = result;
    return result;
  }

  private async charge(payment: SalePayment): Promise<SaleReceipt> {
    const { cart } = this.state;
    if (cart.lines.length === 0) throw new EmptySaleError();
    const total = cartSummary(cart).total.amount;
    if (payment.method === 'cash' && payment.received < total) {
      throw new RangeError('The cash received does not cover the total');
    }
    const active = this.deps.workspace.current();
    if (active === null) throw new NoWorkspaceError();

    const storage = this.deps.workspace.shifts();
    const shift = await storage.readCurrentShift();
    if (shift === null || shift.closing !== null) throw new ShiftRequiredError();
    // El folio se reserva ya con el turno comprobado: la serie solo crece, y un salto por un fallo es aceptable (ADR 0016), pero no
    // hace falta gastar uno por una venta que ni siquiera tiene turno.
    const folio = await this.deps.workspace.nextFolio();

    const at = this.deps.clock.now();
    const operationId = this.deps.ids.newId();
    const sale = {
      operationId,
      shiftId: shift.shiftId,
      folio,
      at,
      clockOffsetMs: this.deps.sync.clockOffsetMs(),
      cashier: active.profile.fullName,
      shiftOpenedAt: shift.openedAt,
      cart,
      payment,
    };
    const receipt = buildReceipt(sale);
    await storage.saveShift(
      { ...shift, sales: recordSale(shift.sales, payment.method, receipt.summary.total) },
      { operationId, kind: 'sale', body: saleBody(sale), createdAt: at },
    );

    // Ya esta guardada. Lo que sigue avisa a quien tiene que enterarse; que un aviso falle no deshace la venta.
    this.update(EMPTY_CART, receipt);
    try {
      await this.deps.sync.queued();
    } catch {
      // La venta y su operacion ya estan guardadas; el motor las encuentra cuando vuelva la conexion o se reabra la aplicacion.
    }
    await this.deps.shifts.refresh();
    await this.deps.copy.sold(
      cart.lines.map((line) => ({ productId: line.productId, quantityMilli: line.quantityMilli })),
    );
    return receipt;
  }

  private update(cart: Cart, receipt: SaleReceipt | null): void {
    if (cart === this.state.cart && receipt === this.state.receipt) return;
    this.state = stateOf(cart, receipt);
    for (const listener of [...this.listeners]) listener();
  }
}
