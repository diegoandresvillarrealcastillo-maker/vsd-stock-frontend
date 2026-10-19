import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Product } from '../../domain/model/catalog';
import type { SearchOptions } from '../../domain/model/product-search';
import type { CopyState, ReadCopy } from '../../domain/ports/in/read-copy';

// Adapta la copia de lectura (un caso de uso sin React) a lo que pide useSyncExternalStore, igual que la conexion y el envio. Son
// propiedades con funcion y no metodos: se pasan sueltas y no deben depender de `this`.
interface CopyStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => CopyState;
  refresh: () => void;
  search: (query: string, options?: SearchOptions) => readonly Product[];
  product: (productId: string) => Product | undefined;
  stockOf: (productId: string) => number | null;
}

const CopyContext = createContext<CopyStore | null>(null);

/**
 * Entrega la copia de lectura del catalogo y de la existencia a toda la interfaz y la pone en marcha mientras esta montada. La
 * copia llega ya cableada desde `infrastructure/main.tsx`. Arrancar y detener es idempotente: en desarrollo React monta dos veces
 * y la segunda deja una sola vigilancia.
 */
export function ReadCopyProvider({ copy, children }: { copy: ReadCopy; children: ReactNode }) {
  const store = useMemo<CopyStore>(
    () => ({
      subscribe: (onChange) => copy.subscribe(() => onChange()),
      getSnapshot: () => copy.current(),
      refresh: () => {
        void copy.refresh();
      },
      search: (query, options) => copy.search(query, options),
      product: (productId) => copy.product(productId),
      stockOf: (productId) => copy.stockOf(productId),
    }),
    [copy],
  );

  useEffect(() => {
    copy.start();
    return () => {
      copy.stop();
    };
  }, [copy]);

  return <CopyContext value={store}>{children}</CopyContext>;
}

/**
 * La copia de lectura: lo que se sabe de ella y las cuatro cosas que se le piden (actualizar, buscar, un producto y su
 * existencia). Quien muestre productos o existencias lee de aqui, no del servidor: tiene que funcionar sin conexion.
 */
export function useReadCopy(): {
  state: CopyState;
  refresh: () => void;
  search: CopyStore['search'];
  product: CopyStore['product'];
  stockOf: CopyStore['stockOf'];
} {
  const store = useContext(CopyContext);
  if (store === null) {
    throw new Error('useReadCopy debe usarse dentro de <ReadCopyProvider>');
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return {
    state,
    refresh: store.refresh,
    search: store.search,
    product: store.product,
    stockOf: store.stockOf,
  };
}
