import { useState } from 'react';
import { Link } from 'react-router';
import type { StockItem } from '../../domain/model/inventory';
import { unitShort } from '../../domain/model/catalog';
import { formatQuantity } from '../../domain/model/quantity';
import type { StockFilter } from '../../domain/ports/in/inventory';
import { Badge } from '../components/Badge';
import { FormAlert } from '../components/FormAlert';
import { FormField } from '../components/FormField';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { usePagedLoad } from '../forms/use-paged-load';
import { useSearchTerm } from '../forms/use-search-term';
import { useInventory } from '../inventory/InventoryProvider';

function Row({ item }: { item: StockItem }) {
  const short = unitShort(item.unit);
  const minimum =
    item.minStockMilli === null
      ? 'sin mínimo'
      : `mínimo ${formatQuantity(item.minStockMilli)} ${short}`;
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`/inventario/${encodeURIComponent(item.productId)}`}
        className="flex items-center justify-between gap-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex min-w-0 flex-col">
          <span
            className={`truncate text-base font-medium ${item.active ? 'text-fg' : 'text-fg-muted'}`}
          >
            {item.name}
          </span>
          <span className="truncate text-sm text-fg-muted">{`${item.sku} · ${minimum}`}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`text-base font-semibold ${item.belowMinimum ? 'text-accent-text' : 'text-fg'}`}
          >
            {`${formatQuantity(item.quantityMilli)} ${short}`}
          </span>
          {item.belowMinimum && <Badge tone="warning">Bajo el mínimo</Badge>}
          {item.quantityMilli < 0 && <Badge tone="warning">Negativa</Badge>}
          {!item.active && <Badge tone="muted">Archivado</Badge>}
        </span>
      </Link>
    </li>
  );
}

/** Las existencias del negocio (ADR 0013): lo que hay de cada producto, con la alerta de lo que esta por debajo de su minimo. */
export function StockPage() {
  const inventory = useInventory();
  const { term, setTerm, search, submit: searchNow } = useSearchTerm();
  const [belowMinimum, setBelowMinimum] = useState(false);

  const filter: StockFilter = {
    ...(search === '' ? {} : { search }),
    ...(belowMinimum ? { belowMinimum: true } : {}),
  };
  const { state, reload } = usePagedLoad(
    (cursor) =>
      cursor === undefined ? inventory.listStock(filter) : inventory.listStock(filter, cursor),
    [search, belowMinimum],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Existencias</h1>
        <p className="text-base text-fg-muted">
          Lo que hay de cada producto, según todo lo que entró y salió.
        </p>
      </div>
      <form
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          searchNow();
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
      <div role="group" aria-label="Filtro de existencias" className="flex flex-wrap gap-2">
        {[
          { below: false, label: 'Todos' },
          { below: true, label: 'Por debajo del mínimo' },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={belowMinimum === option.below}
            onClick={() => setBelowMinimum(option.below)}
            className={`inline-flex min-h-touch items-center rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              belowMinimum === option.below
                ? 'border-primary bg-primary text-on-primary'
                : 'border-border bg-surface text-fg'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {state.status === 'loading' && <RowsSkeleton label="Cargando existencias…" />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar las existencias"
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
                : belowMinimum
                  ? 'Ningún producto está por debajo de su mínimo.'
                  : 'Todavía no hay productos con existencias.'}
            </p>
          ) : (
            <ul aria-label="Existencias" className="flex flex-col">
              {state.items.map((item) => (
                <Row key={item.productId} item={item} />
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
    </section>
  );
}
