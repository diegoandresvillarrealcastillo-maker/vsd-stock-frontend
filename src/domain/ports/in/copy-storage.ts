import type { Product } from '../../model/catalog';
import type { CopyCheckpoint, StockLevel } from '../../model/read-copy';

/**
 * La copia de lectura del catalogo y de la existencia que una persona guarda en este dispositivo (C3-10, ADR 0028), cifrada como
 * todo lo demas (ADR 0018). Se pide al espacio de trabajo y sirve mientras esa persona siga trabajando: si el dispositivo cambia
 * de persona, cada metodo lanza `NoWorkspaceError` en vez de tocar la copia de otra.
 */
export interface CopyStorage {
  /** Guarda los productos que llegaron. Si ya estaba uno, gana el de `updatedAt` mayor: aplicar dos veces no hace dano. */
  putProducts(products: readonly Product[]): Promise<void>;
  /** Todos los productos guardados, archivados incluidos, en ningun orden en particular. Lo que no se puede abrir no se da. */
  readProducts(): Promise<Product[]>;
  /** Guarda la existencia de esos productos, reemplazando la que habia. */
  putStock(levels: readonly StockLevel[]): Promise<void>;
  /** La existencia de todos los productos guardados. Lo que no se puede abrir no se da. */
  readStock(): Promise<StockLevel[]>;
  /** Lo que se sabe de las descargas hechas; `NO_DOWNLOADS` si no hay nada o no se puede abrir. */
  readCheckpoint(): Promise<CopyCheckpoint>;
  writeCheckpoint(checkpoint: CopyCheckpoint): Promise<void>;
}
