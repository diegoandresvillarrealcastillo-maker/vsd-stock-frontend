import type { Product } from '../../domain/model/catalog';
import type { CopyCheckpoint, StockLevel } from '../../domain/model/read-copy';
import type { CopyStorage } from '../../domain/ports/in/copy-storage';
import type { LocalStore } from '../../domain/ports/out/local-store';

/**
 * La copia de lectura de una persona sobre su base local. Recibe una funcion que da la base mientras esa persona siga
 * trabajando y lanza `NoWorkspaceError` cuando ya no (la base se solto o entro otra persona): asi nunca toca la copia de otra.
 */
export class StoreCopy implements CopyStorage {
  constructor(private readonly current: () => LocalStore) {}

  async putProducts(products: readonly Product[]): Promise<void> {
    await this.current().putProducts(products);
  }

  async readProducts(): Promise<Product[]> {
    return await this.current().readProducts();
  }

  async putStock(levels: readonly StockLevel[]): Promise<void> {
    await this.current().putStock(levels);
  }

  async readStock(): Promise<StockLevel[]> {
    return await this.current().readStock();
  }

  async readCheckpoint(): Promise<CopyCheckpoint> {
    return await this.current().readCheckpoint();
  }

  async writeCheckpoint(checkpoint: CopyCheckpoint): Promise<void> {
    await this.current().writeCheckpoint(checkpoint);
  }
}
