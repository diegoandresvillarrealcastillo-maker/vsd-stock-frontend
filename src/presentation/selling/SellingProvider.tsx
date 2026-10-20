import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Selling, SellingState } from '../../domain/ports/in/selling';

// Adapta el punto de venta (un caso de uso sin React) a lo que pide useSyncExternalStore, igual que el turno y el envio. Son
// propiedades con funcion y no metodos: se pasan sueltas, no dependen de `this` y su identidad no cambia, asi que las lineas del
// carrito que no cambiaron no se vuelven a dibujar.
interface SellingStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => SellingState;
  actions: Pick<
    Selling,
    'add' | 'setQuantity' | 'setDiscount' | 'remove' | 'clear' | 'confirm' | 'newSale'
  >;
}

const SellingContext = createContext<SellingStore | null>(null);

/**
 * Entrega el punto de venta a toda la interfaz y lo pone en marcha mientras esta montado. Llega ya cableado desde
 * `infrastructure/main.tsx`. Arrancar y detener es idempotente: en desarrollo React monta dos veces y la segunda deja una sola
 * vigilancia.
 */
export function SellingProvider({ selling, children }: { selling: Selling; children: ReactNode }) {
  const store = useMemo<SellingStore>(
    () => ({
      subscribe: (onChange) => selling.subscribe(() => onChange()),
      getSnapshot: () => selling.current(),
      actions: {
        add: (product) => {
          selling.add(product);
        },
        setQuantity: (productId, quantityMilli) => {
          selling.setQuantity(productId, quantityMilli);
        },
        setDiscount: (productId, discount) => {
          selling.setDiscount(productId, discount);
        },
        remove: (productId) => {
          selling.remove(productId);
        },
        clear: () => {
          selling.clear();
        },
        confirm: (payment) => selling.confirm(payment),
        newSale: () => {
          selling.newSale();
        },
      },
    }),
    [selling],
  );

  useEffect(() => {
    selling.start();
    return () => {
      selling.stop();
    };
  }, [selling]);

  return <SellingContext value={store}>{children}</SellingContext>;
}

/** La venta en curso y lo que se hace con ella. Las acciones no cambian de identidad mientras el punto de venta sea el mismo. */
export function useSelling(): { state: SellingState } & SellingStore['actions'] {
  const store = useContext(SellingContext);
  if (store === null) {
    throw new Error('useSelling debe usarse dentro de <SellingProvider>');
  }
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { state, ...store.actions };
}
