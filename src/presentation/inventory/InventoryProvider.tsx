import { createContext, useContext, type ReactNode } from 'react';
import type { Inventory } from '../../domain/ports/in/inventory';

const InventoryContext = createContext<Inventory | null>(null);

/** Entrega el caso de uso de las existencias (ya cableado desde `infrastructure/`) a las pantallas que lo usan. */
export function InventoryProvider({
  inventory,
  children,
}: {
  inventory: Inventory;
  children: ReactNode;
}) {
  return <InventoryContext value={inventory}>{children}</InventoryContext>;
}

/** Las existencias. Solo funciona dentro de `InventoryProvider`. */
export function useInventory(): Inventory {
  const value = useContext(InventoryContext);
  if (value === null) {
    throw new Error('useInventory debe usarse dentro de <InventoryProvider>');
  }
  return value;
}
