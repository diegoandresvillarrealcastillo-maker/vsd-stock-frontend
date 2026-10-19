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

/** Un producto con todo lo que se compara ya preparado: asi buscar no vuelve a normalizar el catalogo entero en cada tecla. */
interface Entry {
  readonly product: Product;
  readonly name: string;
  readonly words: readonly string[];
  readonly sku: string;
  readonly barcode: string;
  readonly bareBarcode: string;
  /** Lo que se recorre para saber si una palabra esta: el nombre, el codigo del negocio y el de barras. */
  readonly haystack: string;
}

/** La copia del catalogo lista para buscar. Se arma una vez por cambio del catalogo y sirve para todas las busquedas. */
export interface SearchIndex {
  readonly entries: readonly Entry[];
}

export function indexProducts(products: readonly Product[]): SearchIndex {
  return {
    entries: products.map((product) => {
      const name = normalizeForSearch(product.name);
      const sku = normalizeForSearch(product.sku);
      const barcode = product.barcode ?? '';
      return {
        product,
        name,
        words: name.split(' '),
        sku,
        barcode,
        bareBarcode: withoutLeadingZeros(barcode),
        haystack: `${name} ${sku} ${barcode}`,
      };
    }),
  };
}

interface Candidate {
  readonly entry: Entry;
  readonly tier: Tier;
}

interface Wanted {
  readonly text: string;
  readonly bare: string;
  readonly tokens: readonly string[];
}

function tierOf(entry: Entry, wanted: Wanted): Tier | null {
  const code =
    entry.sku === wanted.text || (entry.barcode !== '' && entry.bareBarcode === wanted.bare);
  if (code) return 0;
  if (!wanted.tokens.every((token) => entry.haystack.includes(token))) return null;
  if (entry.name.startsWith(wanted.text)) return 1;
  if (wanted.tokens.every((token) => entry.words.some((word) => word.startsWith(token)))) return 2;
  return 3;
}

// Un comparador creado una vez: `localeCompare` con un idioma lo crea en cada llamada y, con miles de productos, se nota.
const collator = new Intl.Collator('es');

function compare(a: Candidate, b: Candidate): number {
  return (
    a.tier - b.tier ||
    collator.compare(a.entry.name, b.entry.name) ||
    collator.compare(a.entry.product.id, b.entry.product.id)
  );
}

/** Mete el candidato en su lugar de una lista ya ordenada y la deja con `limit` como mucho: solo se guardan los mejores. */
function keepBest(best: Candidate[], candidate: Candidate, limit: number): void {
  if (best.length === limit && compare(candidate, best[limit - 1] as Candidate) >= 0) return;
  let low = 0;
  let high = best.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (compare(best[middle] as Candidate, candidate) <= 0) low = middle + 1;
    else high = middle;
  }
  best.splice(low, 0, candidate);
  if (best.length > limit) best.pop();
}

/**
 * Busca en la copia del catalogo lo que la persona escribio o lo que leyo el lector de codigos. Con una sola palabra o varias,
 * en cualquier orden, sin importar mayusculas ni tildes; por el nombre, el codigo del negocio o el codigo de barras (completo,
 * con o sin el cero que vuelve un UPC en EAN). Un codigo exacto va primero; luego lo que empieza como se escribio, luego lo que
 * tiene una palabra que empieza asi y al final lo que solo lo contiene; dentro de cada grupo, por nombre. No busca nada si no se
 * escribio nada. Solo ordena los que se van a mostrar, no todo lo que coincide.
 */
export function searchIndex(
  index: SearchIndex,
  query: string,
  options: SearchOptions = {},
): Product[] {
  const text = normalizeForSearch(query);
  const limit = options.limit ?? DEFAULT_SEARCH_LIMIT;
  if (text === '' || limit <= 0) return [];
  const wanted: Wanted = { text, bare: withoutLeadingZeros(text), tokens: text.split(' ') };
  const best: Candidate[] = [];
  for (const entry of index.entries) {
    if (!entry.product.active && options.includeArchived !== true) continue;
    const tier = tierOf(entry, wanted);
    if (tier !== null) keepBest(best, { entry, tier }, limit);
  }
  return best.map(({ entry }) => entry.product);
}

/** Lo mismo con la lista a secas: arma el indice y busca. Para una sola busqueda; quien busca muchas veces arma el indice una vez. */
export function searchProducts(
  products: readonly Product[],
  query: string,
  options: SearchOptions = {},
): Product[] {
  return searchIndex(indexProducts(products), query, options);
}
