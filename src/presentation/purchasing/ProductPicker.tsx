import type { Product } from '../../domain/model/catalog';
import type { ProductFilter } from '../../domain/ports/in/catalog';
import { useCatalog } from '../catalog/CatalogProvider';
import { Button } from '../components/Button';
import { FormField } from '../components/FormField';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { useLoad } from '../forms/use-load';
import { useSearchTerm } from '../forms/use-search-term';

/** Cuantos resultados se muestran a la vez: si el producto no esta, se escribe mas para acotar. */
const VISIBLE = 8;

/**
 * Elegir un producto activo del catalogo buscandolo por nombre, SKU o codigo de barras. Sin producto elegido muestra el buscador y
 * lo que encuentra; con uno elegido, lo muestra y deja cambiarlo. Los archivados no se ofrecen: no se pueden comprar.
 */
export function ProductPicker({
  value,
  onChange,
  error,
  disabled = false,
}: {
  value: Product | null;
  onChange: (product: Product | null) => void;
  /** Lo que esta mal con el producto, dicho en una frase. */
  error?: string;
  disabled?: boolean;
}) {
  const catalog = useCatalog();
  const { term, setTerm, search, submit } = useSearchTerm();
  const filter: ProductFilter = { active: true, ...(search === '' ? {} : { search }) };
  const { state, reload } = useLoad(() => catalog.listProducts(filter), [search]);

  if (value !== null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-base font-medium text-fg">Producto</p>
        <p className="text-base text-fg">{`${value.name} (${value.sku})`}</p>
        <Button onClick={() => onChange(null)}>Cambiar producto</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <form
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField
          id="producto"
          label="Producto"
          type="search"
          autoComplete="off"
          placeholder="Buscar un producto…"
          value={term}
          onChange={setTerm}
          disabled={disabled}
          {...(error === undefined ? {} : { error })}
        />
      </form>
      {state.status === 'loading' && <RowsSkeleton label="Cargando productos…" rows={2} />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar los productos"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' &&
        (state.data.items.length === 0 ? (
          <p className="text-sm text-fg-muted">
            {search === ''
              ? 'No hay productos activos.'
              : `No encontramos productos activos con «${search}».`}
          </p>
        ) : (
          <ul aria-label="Productos para elegir" className="flex flex-col">
            {state.data.items.slice(0, VISIBLE).map((product) => (
              <li key={product.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(product)}
                  className="flex min-h-touch w-full flex-col items-start justify-center py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="text-base font-medium text-fg">{product.name}</span>
                  <span className="text-sm text-fg-muted">{product.sku}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
