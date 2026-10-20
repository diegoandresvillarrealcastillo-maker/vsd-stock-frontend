import type { Product } from '../../model/catalog';
import type { SearchOptions } from '../../model/product-search';

/** `empty`: todavia no se completo ninguna descarga. `ready`: hay una copia, con su hora. */
export type CopyStatus = 'empty' | 'ready';

/** Por que no se pudo bajar la ultima vez: no hay red, la sesion caduco o fue otra cosa. */
export type CopyFault = 'network' | 'session' | 'other';

/** Lo que la interfaz sabe de la copia de lectura. Es el mismo objeto mientras nada cambie. */
export interface CopyState {
  readonly status: CopyStatus;
  /** Cuantos productos hay en la copia, archivados incluidos. */
  readonly productCount: number;
  /** La hora del servidor a la que se leyo el catalogo, o `null` si nunca se completo una descarga. */
  readonly productsAsOf: Date | null;
  /** La hora del servidor a la que se leyo la existencia: lo que se dice como «al...». */
  readonly stockAsOf: Date | null;
  readonly downloading: boolean;
  readonly fault: CopyFault | null;
}

/**
 * Puerto de entrada: la copia de lectura del catalogo y de la existencia que cada persona guarda en este dispositivo para vender
 * sin conexion (C3-10, ADR 0028). La baja del servidor cuando hay conexion, solo lo que cambio, y la busca en memoria. Nada de
 * esto es la verdad de hoy en todas las cajas: es lo que el servidor sabia a su hora.
 */
export interface ReadCopy {
  current(): CopyState;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
  /** Empieza a vigilar a quien trabaja, la conexion y los envios, y baja lo que falte. Llamarlo otra vez no hace nada. */
  start(): void;
  /** Deja de vigilar. */
  stop(): void;
  /** Baja lo que cambio desde la ultima vez. Nunca lanza: lo que fallo queda en `fault`. Se cumple cuando termina. */
  refresh(): Promise<void>;
  /** Busca en la copia lo que se escribio o leyo el lector de codigos. */
  search(query: string, options?: SearchOptions): readonly Product[];
  /** Un producto de la copia por su identificador. */
  product(productId: string): Product | undefined;
  /** La existencia de la copia en milesimas de la unidad, o `null` si el servidor no ha dicho nada de ese producto. */
  stockOf(productId: string): number | null;
}
