import type { Product } from './catalog';

/** Cuantos resultados se dan por omision: la lista de una pantalla de venta, no el catalogo entero. */
export const DEFAULT_SEARCH_LIMIT = 20;

export interface SearchOptions {
  readonly limit?: number;
  /** Los archivados no se venden y por omision no se ofrecen. */
  readonly includeArchived?: boolean;
}

/** Como se compara lo escrito: sin mayusculas, sin tildes y con un solo espacio entre palabras. */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** El GTIN de 12 digitos y el de 13 que le antepone un cero son el mismo codigo: se comparan sin ceros a la izquierda. */
function withoutLeadingZeros(code: string): string {
  return code.replace(/^0+/, '');
}

/** Cuanto se parece lo encontrado a lo escrito: 0 es un codigo exacto y 3, que solo lo contiene. */
type Tier = 0 | 1 | 2 | 3;

interface Candidate {
  readonly product: Product;
  readonly name: string;
  readonly tier: Tier;
}

function tierOf(
  product: Product,
  name: string,
  query: string,
  tokens: readonly string[],
  digits: boolean,
): Tier | null {
  const sku = normalizeForSearch(product.sku);
  const barcode = product.barcode ?? '';
  const code =
    sku === query ||
    (digits && barcode !== '' && withoutLeadingZeros(barcode) === withoutLeadingZeros(query));
  if (code) return 0;
  const haystack = `${name} ${sku} ${barcode}`;
  if (!tokens.every((token) => haystack.includes(token))) return null;
  if (name.startsWith(query)) return 1;
  const words = name.split(' ');
  if (tokens.every((token) => words.some((word) => word.startsWith(token)))) return 2;
  return 3;
}

/**
 * Busca en la copia del catalogo lo que la persona escribio o lo que leyo el lector de codigos. Con una sola palabra o varias,
 * en cualquier orden, sin importar mayusculas ni tildes; por el nombre, el codigo del negocio o el codigo de barras (completo,
 * con o sin el cero que vuelve un UPC en EAN). Un codigo exacto va primero; luego lo que empieza como se escribio, luego lo que
 * tiene una palabra que empieza asi y al final lo que solo lo contiene; dentro de cada grupo, por nombre. No busca nada si no se
 * escribio nada.
 */
export function searchProducts(
  products: readonly Product[],
  query: string,
  options: SearchOptions = {},
): Product[] {
  const wanted = normalizeForSearch(query);
  if (wanted === '') return [];
  const tokens = wanted.split(' ');
  const digits = /^\d+$/.test(wanted);
  const candidates: Candidate[] = [];
  for (const product of products) {
    if (!product.active && options.includeArchived !== true) continue;
    const name = normalizeForSearch(product.name);
    const tier = tierOf(product, name, wanted, tokens, digits);
    if (tier !== null) candidates.push({ product, name, tier });
  }
  candidates.sort(
    (a, b) =>
      a.tier - b.tier ||
      a.name.localeCompare(b.name, 'es') ||
      a.product.id.localeCompare(b.product.id),
  );
  return candidates.slice(0, options.limit ?? DEFAULT_SEARCH_LIMIT).map(({ product }) => product);
}
