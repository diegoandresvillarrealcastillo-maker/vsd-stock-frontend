import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { Product } from '../../domain/model/catalog';
import { can } from '../../domain/model/permissions';
import { formatPesos } from '../../domain/model/quantity';
import type { ProductFilter } from '../../domain/ports/in/catalog';
import { useMembership } from '../auth/AuthProvider';
import { Badge } from '../components/Badge';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { useCatalog } from '../catalog/CatalogProvider';
import { useLoad } from '../forms/use-load';
import { usePagedLoad } from '../forms/use-paged-load';

/** Cuanto espera la pantalla despues de la ultima tecla para pedir la busqueda. */
const SEARCH_DELAY_MS = 300;

type Status = 'all' | 'active' | 'archived';

const STATUSES: readonly { id: Status; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'archived', label: 'Archivados' },
];

function Row({
  product,
  categoryName,
  linked,
}: {
  product: Product;
  /** El nombre de la categoria, o `undefined` si todavia no se sabe. */
  categoryName: string | undefined;
  linked: boolean;
}) {
  const detail = categoryName === undefined ? product.sku : `${product.sku} · ${categoryName}`;
  const content = (
    <>
      <span className="flex min-w-0 flex-col">
        <span
          className={`truncate text-base font-medium ${product.active ? 'text-fg' : 'text-fg-muted'}`}
        >
          {product.name}
        </span>
        <span className="truncate text-sm text-fg-muted">{detail}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-base font-semibold text-fg">{formatPesos(product.unitPrice)}</span>
        {!product.active && <Badge tone="muted">Archivado</Badge>}
      </span>
    </>
  );
  const layout = 'flex items-center justify-between gap-4 py-3';
  return (
    <li className="border-b border-border last:border-b-0">
      {linked ? (
        <Link
          to={`/catalogo/${encodeURIComponent(product.id)}`}
          className={`${layout} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
        >
          {content}
        </Link>
      ) : (
        <div className={layout}>{content}</div>
      )}
    </li>
  );
}

/** El catalogo del negocio (ADR 0015): los productos que se venden y se compran, con busqueda y el estado de cada uno. */
export function CatalogPage() {
  const catalog = useCatalog();
  const membership = useMembership();
  const location = useLocation();
  const notice = (location.state as { notice?: unknown } | null)?.notice;
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status>('active');

  // La busqueda se pide sola cuando la persona deja de escribir; Enter la pide de inmediato.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [term]);

  const active = status === 'all' ? undefined : status === 'active';
  const filter: ProductFilter = {
    ...(search === '' ? {} : { search }),
    ...(active === undefined ? {} : { active }),
  };
  const { state, reload } = usePagedLoad(
    (cursor) =>
      cursor === undefined ? catalog.listProducts(filter) : catalog.listProducts(filter, cursor),
    [search, active],
  );
  // Los nombres de las categorias son un adorno de cada fila: si no llegan, la lista se muestra igual.
  const categories = useLoad(() => catalog.listAllCategories(), []);
  const categoryNames =
    categories.state.status === 'ready'
      ? new Map(categories.state.data.map((category) => [category.id, category.name]))
      : null;

  const canManage = membership !== null && can(membership.role, 'product:manage');

  function categoryNameOf(product: Product): string | undefined {
    if (product.categoryId === null) return categoryNames === null ? undefined : 'Sin categoría';
    return categoryNames?.get(product.categoryId);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Catálogo</h1>
        <p className="text-base text-fg-muted">Los productos que vendes y compras.</p>
      </div>
      {typeof notice === 'string' && (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      )}
      <form
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(term.trim());
        }}
      >
        <FormField
          id="buscar"
          label="Buscar"
          type="search"
          autoComplete="off"
          placeholder="Nombre, SKU o código de barras"
          value={term}
          onChange={setTerm}
        />
      </form>
      <div role="group" aria-label="Estado del producto" className="flex flex-wrap gap-2">
        {STATUSES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={status === option.id}
            onClick={() => setStatus(option.id)}
            className={`inline-flex min-h-touch items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              status === option.id
                ? 'border-primary bg-primary text-on-primary'
                : 'border-border bg-surface text-fg'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {state.status === 'loading' && <RowsSkeleton label="Cargando productos…" />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar el catálogo"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && (
        <>
          {state.items.length === 0 ? (
            <p className="text-base text-fg-muted">
              {search !== ''
                ? `No encontramos productos con «${search}». Prueba con otro nombre, SKU o código de barras.`
                : status === 'archived'
                  ? 'No hay productos archivados.'
                  : canManage
                    ? 'Todavía no tienes productos.'
                    : 'Todavía no hay productos. Pídele a quien administra que los cree.'}
            </p>
          ) : (
            <ul aria-label="Productos" className="flex flex-col">
              {state.items.map((product) => (
                <Row
                  key={product.id}
                  product={product}
                  categoryName={categoryNameOf(product)}
                  linked={canManage}
                />
              ))}
            </ul>
          )}
          {state.moreProblem !== null && (
            <FormAlert title="No pudimos cargar más">{state.moreProblem.message}</FormAlert>
          )}
          {state.hasMore && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                state.loadMore();
              }}
            >
              <SubmitButton pending={state.loadingMore} variant="accent">
                Cargar más
              </SubmitButton>
            </form>
          )}
        </>
      )}
      {canManage && (
        <>
          <LinkButton to="/catalogo/nuevo">Nuevo producto</LinkButton>
          <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3">
            <p className="text-base font-medium text-fg">Categorías</p>
            <p className="text-sm text-fg-muted">
              Agrupa tus productos para encontrarlos más rápido.{' '}
              <Link to="/catalogo/categorias" className="font-medium text-primary underline">
                Ver y cambiar categorías
              </Link>
              .
            </p>
          </div>
        </>
      )}
    </section>
  );
}
