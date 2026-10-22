import { createContext, useContext, type ReactNode } from 'react';
import type { Catalog } from '../../domain/ports/in/catalog';

const CatalogContext = createContext<Catalog | null>(null);

/** Entrega el caso de uso del catalogo (ya cableado desde `infrastructure/`) a las pantallas que lo usan. */
export function CatalogProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  return <CatalogContext value={catalog}>{children}</CatalogContext>;
}

/** El catalogo. Solo funciona dentro de `CatalogProvider`. */
export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (catalog === null) {
    throw new Error('useCatalog debe usarse dentro de <CatalogProvider>');
  }
  return catalog;
}
