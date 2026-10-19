import { ApiError } from '../../domain/model/api-error';
import type { Product } from '../../domain/model/catalog';
import { NoWorkspaceError } from '../../domain/model/local-errors';
import {
  indexProducts,
  searchIndex,
  type SearchIndex,
  type SearchOptions,
} from '../../domain/model/product-search';
import {
  NO_DOWNLOADS,
  sinceOf,
  type CopyCheckpoint,
  type StockLevel,
} from '../../domain/model/read-copy';
import type { ConnectionMonitor } from '../../domain/ports/in/connection-monitor';
import type { CopyStorage } from '../../domain/ports/in/copy-storage';
import type { LocalWorkspace } from '../../domain/ports/in/local-workspace';
import type { CopyFault, CopyState, ReadCopy } from '../../domain/ports/in/read-copy';
import type { SyncEngine } from '../../domain/ports/in/sync-engine';
import type { ReadCopyApi } from '../../domain/ports/out/read-copy-api';

interface Dependencies {
  readonly workspace: LocalWorkspace;
  readonly api: ReadCopyApi;
  readonly connection: ConnectionMonitor;
  /** Del motor de envio solo se mira cuando el servidor acepto algo: la existencia se movio. */
  readonly sync: Pick<SyncEngine, 'current' | 'subscribe'>;
}

/** Cuantos se piden por pagina: el maximo que acepta el servidor, para hacer pocos viajes con una conexion mala. */
const PAGE_SIZE = 200;

const INITIAL: CopyState = {
  status: 'empty',
  productCount: 0,
  productsAsOf: null,
  stockAsOf: null,
  downloading: false,
  fault: null,
};

/** Por que fallo, en palabras de la interfaz: la clase del fallo (ADR 0009) decide. */
function faultOf(error: unknown): CopyFault {
  if (!(error instanceof ApiError)) return 'other';
  if (error.failure.class === 'network') return 'network';
  if (error.failure.class === 'session') return 'session';
  return 'other';
}

/** Si dos estados dicen lo mismo: las fechas se comparan por su hora. */
function sameState(a: CopyState, b: CopyState): boolean {
  return (
    a.status === b.status &&
    a.productCount === b.productCount &&
    a.productsAsOf?.getTime() === b.productsAsOf?.getTime() &&
    a.stockAsOf?.getTime() === b.stockAsOf?.getTime() &&
    a.downloading === b.downloading &&
    a.fault === b.fault
  );
}

/**
 * La copia de lectura (C3-10, ADR 0028). Mientras alguien trabaja, guarda en su base cifrada el catalogo y la existencia que da
 * el servidor, solo lo que cambio desde la ultima descarga, y los tiene en memoria para buscar sin esperar a nadie. Baja cuando
 * el servidor confirma que hay conexion, cuando entra alguien y cuando el dispositivo acaba de enviar algo. Lo que falla se dice en
 * `fault` y no se lanza: la copia que ya habia sigue sirviendo para vender. Nunca mezcla a dos personas.
 */
export class ReadCopyUseCase implements ReadCopy {
  private state: CopyState = INITIAL;
  private readonly listeners = new Set<() => void>();
  private started = false;
  private stops: (() => void)[] = [];
  private running: Promise<void> | null = null;

  /** De quien es lo que hay en memoria. `undefined`: todavia no se miro quien trabaja. */
  private adoptedId: string | null | undefined = undefined;
  private adoption: Promise<void> = Promise.resolve();
  private checkpoint: CopyCheckpoint = NO_DOWNLOADS;
  private readonly products = new Map<string, Product>();
  private readonly levels = new Map<string, number>();
  /** El catalogo listo para buscar: se arma con la primera busqueda tras un cambio y sirve a todas las siguientes. */
  private indexed: SearchIndex | null = null;
  private lastSyncedAt: number | null = null;

  constructor(private readonly deps: Dependencies) {}

  current(): CopyState {
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
    this.lastSyncedAt = this.deps.sync.current().lastSyncedAt?.getTime() ?? null;
    this.stops.push(
      this.deps.workspace.subscribe(() => {
        void this.adopt().then(() => this.request());
      }),
      // `request` mira si hay conexion: un cambio a «sin conexion» o «comprobando» no baja nada.
      this.deps.connection.subscribe(() => {
        this.request();
      }),
      this.deps.sync.subscribe(() => {
        const at = this.deps.sync.current().lastSyncedAt?.getTime() ?? null;
        if (at === null || at === this.lastSyncedAt) return;
        this.lastSyncedAt = at;
        this.request();
      }),
    );
    void this.adopt().then(() => this.request());
  }

  stop(): void {
    this.started = false;
    for (const stop of this.stops) stop();
    this.stops = [];
  }

  refresh(): Promise<void> {
    if (this.running !== null) return this.running;
    const running = this.run().finally(() => {
      this.running = null;
    });
    this.running = running;
    return running;
  }

  search(query: string, options?: SearchOptions): readonly Product[] {
    return searchIndex(this.index(), query, options);
  }

  product(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  stockOf(productId: string): number | null {
    return this.levels.get(productId) ?? null;
  }

  async sold(items: readonly { productId: string; quantityMilli: number }[]): Promise<void> {
    const id = this.adoptedId;
    if (id === null || id === undefined) return;
    const changed: StockLevel[] = [];
    for (const { productId, quantityMilli } of items) {
      const left = this.levels.get(productId);
      // Lo que el servidor nunca dijo no se inventa: sin existencia conocida, no hay con que descontar.
      if (left === undefined) continue;
      const level = { productId, quantityMilli: left - quantityMilli };
      this.levels.set(productId, level.quantityMilli);
      changed.push(level);
    }
    if (changed.length === 0) return;
    try {
      await this.deps.workspace.copy().putStock(changed);
    } catch {
      // Es un calculo para no ofrecer lo que ya no esta, no un dato: si no se pudo guardar (cambio la persona, falla el disco), la
      // proxima descarga lo corrige con lo que sabe el servidor, y la venta ya esta guardada por otro camino.
    }
  }

  /** Lo que pasa solo (llego la conexion, entro alguien, se envio algo): baja si hay con que, y no dice nada si no. */
  private request(): void {
    if (this.deps.connection.current().status === 'online') void this.refresh();
  }

  private async run(): Promise<void> {
    await this.adopt();
    const id = this.adoptedId;
    if (id === null || id === undefined) return;
    if (this.deps.connection.current().status !== 'online') {
      // La persona lo pidio y no se puede: se dice, para que no crea que se actualizo.
      this.update({ fault: 'network' });
      return;
    }
    await this.download(id);
    // Alguien llego mientras tanto y su pedido se junto con este: la descarga de quien se fue no es la suya.
    if (this.adoptedId !== id) await this.run();
  }

  /** Deja en memoria la copia de quien trabaja ahora, y solo la suya. Quien llega a la vez espera a que termine de leerse. */
  private adopt(): Promise<void> {
    const id = this.deps.workspace.current()?.profile.authUserId ?? null;
    if (id === this.adoptedId) return this.adoption;
    this.adoptedId = id;
    this.forget();
    this.adoption = id === null ? Promise.resolve() : this.load(id);
    return this.adoption;
  }

  /** Olvida lo que hay en memoria: es de alguien que ya no trabaja. */
  private forget(): void {
    this.products.clear();
    this.levels.clear();
    this.indexed = null;
    this.checkpoint = NO_DOWNLOADS;
    this.update(INITIAL);
  }

  private async load(id: string): Promise<void> {
    try {
      const storage = this.deps.workspace.copy();
      const [products, levels, checkpoint] = await Promise.all([
        storage.readProducts(),
        storage.readStock(),
        storage.readCheckpoint(),
      ]);
      if (this.adoptedId !== id) return;
      this.merge(products);
      for (const level of levels) this.levels.set(level.productId, level.quantityMilli);
      this.checkpoint = checkpoint;
      this.update(this.describe());
    } catch (error) {
      if (error instanceof NoWorkspaceError) return;
      if (this.adoptedId === id) this.update({ fault: 'other' });
    }
  }

  private async download(id: string): Promise<void> {
    let storage: CopyStorage;
    try {
      storage = this.deps.workspace.copy();
    } catch (error) {
      if (error instanceof NoWorkspaceError) return;
      throw error;
    }
    this.update({ downloading: true, fault: null });
    try {
      const productsAsOf = await this.downloadProducts(storage, id);
      if (productsAsOf === null) return;
      this.checkpoint = { ...this.checkpoint, productsAsOf };
      await storage.writeCheckpoint(this.checkpoint);
      this.update(this.describe());

      const stockAsOf = await this.downloadStock(storage, id);
      if (stockAsOf === null) return;
      this.checkpoint = { ...this.checkpoint, stockAsOf };
      await storage.writeCheckpoint(this.checkpoint);
      this.update(this.describe());
    } catch (error) {
      // La persona cambio mientras tanto: lo que faltaba ya no es de quien llego, y nada de esto le toca.
      if (error instanceof NoWorkspaceError) return;
      if (this.adoptedId === id) this.update({ fault: faultOf(error) });
    } finally {
      // Se baja de a una persona a la vez (`run`): al terminar, nadie mas esta bajando.
      this.update({ downloading: false });
    }
  }

  /** Baja todas las paginas de productos. Devuelve la hora de la PRIMERA, o `null` si la persona cambio a la mitad. */
  private async downloadProducts(storage: CopyStorage, id: string): Promise<Date | null> {
    const since = this.checkpoint.productsAsOf;
    let cursor: string | null = null;
    let first: Date | null = null;
    for (;;) {
      const page = await this.deps.api.products({
        since: since === null ? null : sinceOf(since),
        cursor,
        limit: PAGE_SIZE,
      });
      first ??= page.asOf;
      // Se guarda ANTES de mirar en memoria: si la persona cambio, guardar lanza y nada de esto llega a quien entro.
      await storage.putProducts(page.items);
      if (this.adoptedId !== id) return null;
      this.merge(page.items);
      this.update(this.describe());
      if (page.nextCursor === null) return first;
      cursor = page.nextCursor;
    }
  }

  private async downloadStock(storage: CopyStorage, id: string): Promise<Date | null> {
    const since = this.checkpoint.stockAsOf;
    let cursor: string | null = null;
    let first: Date | null = null;
    for (;;) {
      const page = await this.deps.api.stock({
        since: since === null ? null : sinceOf(since),
        cursor,
        limit: PAGE_SIZE,
      });
      first ??= page.asOf;
      await storage.putStock(page.items);
      if (this.adoptedId !== id) return null;
      for (const level of page.items) this.levels.set(level.productId, level.quantityMilli);
      if (page.nextCursor === null) return first;
      cursor = page.nextCursor;
    }
  }

  /** Mete en memoria los productos que llegaron: gana el que cambio despues (aplicar dos veces no hace dano). */
  private merge(products: readonly Product[]): void {
    for (const product of products) {
      const current = this.products.get(product.id);
      if (current === undefined || current.updatedAt.getTime() <= product.updatedAt.getTime()) {
        this.products.set(product.id, product);
      }
    }
    this.indexed = null;
  }

  private index(): SearchIndex {
    this.indexed ??= indexProducts([...this.products.values()]);
    return this.indexed;
  }

  /** Lo que se dice de lo guardado: cuanto hay y de cuando es. */
  private describe(): Partial<CopyState> {
    return {
      status: this.checkpoint.productsAsOf === null ? 'empty' : 'ready',
      productCount: this.products.size,
      productsAsOf: this.checkpoint.productsAsOf,
      stockAsOf: this.checkpoint.stockAsOf,
    };
  }

  private update(change: Partial<CopyState>): void {
    const next: CopyState = { ...this.state, ...change };
    if (sameState(this.state, next)) return;
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
}
