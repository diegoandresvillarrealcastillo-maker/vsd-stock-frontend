import { createContext, useContext, type ReactNode } from 'react';
import type { Purchasing } from '../../domain/ports/in/purchasing';

const PurchasingContext = createContext<Purchasing | null>(null);

/** Entrega el caso de uso de proveedores y compras (ya cableado desde `infrastructure/`) a las pantallas que lo usan. */
export function PurchasingProvider({
  purchasing,
  children,
}: {
  purchasing: Purchasing;
  children: ReactNode;
}) {
  return <PurchasingContext value={purchasing}>{children}</PurchasingContext>;
}

/** Proveedores y compras. Solo funciona dentro de `PurchasingProvider`. */
export function usePurchasing(): Purchasing {
  const value = useContext(PurchasingContext);
  if (value === null) {
    throw new Error('usePurchasing debe usarse dentro de <PurchasingProvider>');
  }
  return value;
}
