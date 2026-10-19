import { useDeferredValue, useMemo, useState, type KeyboardEvent } from 'react';
import { formatTime } from '../../domain/model/moment';
import { isExactCode } from '../../domain/model/product-search';
import { formatPesos, formatQuantity } from '../../domain/model/quantity';
import type { Product } from '../../domain/model/catalog';
import { Callout } from '../components/Callout';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/FormField';
import { LinkButton } from '../components/LinkButton';
import { Skeleton } from '../components/Skeleton';
import { useReadCopy } from '../copy/ReadCopyProvider';
import { focusField } from '../forms/focus-field';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { CartLineRow } from '../selling/CartLineRow';
import { ChargeBar, productsLabel } from '../selling/ChargeBar';
import { useSelling } from '../selling/SellingProvider';
import { useShift } from '../shift/ShiftProvider';
import { SummaryCard, type SummaryRow } from '../shift/SummaryCard';

const SEARCH = 'buscar';

const NOT_FOUND = 'No encontramos ese producto. Prueba con otra palabra o con el código.';

/** Lo que se dice de lo que se encontro: cuantos hay, o que no hay, o como leer un codigo. */
function searchMessage(query: string, count: number): string {
  if (query.trim() === '') return 'Con el lector, apunta al código y listo.';
  if (count === 0) return NOT_FOUND;
  return count === 1
    ? '1 producto. Tócalo para agregarlo.'
    : `${String(count)} productos. Toca uno para agregarlo.`;
}

/** La linea que se ofrece de un producto: su codigo y lo que queda, o que se agoto. */
function detailOf(product: Product, stockMilli: number | null): string {
  if (stockMilli !== null && stockMilli <= 0) return 'Agotado';
  return stockMilli === null
    ? product.sku
    : `${product.sku} · quedan ${formatQuantity(stockMilli)}`;
}

function Heading({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-semibold text-fg">Vender</h1>
      {subtitle !== undefined && <p className="text-base text-fg-muted">{subtitle}</p>}
    </div>
  );
}

/**
 * El punto de venta (C3-12, ADR 0027), la pantalla principal del mostrador: se busca por nombre o se lee el codigo, se arma la
 * venta con sus cantidades y rebajas, y se llega a cobrar. Todo sale de la copia que guarda el equipo y de lo guardado de la persona,
 * asi que vende igual sin conexion. Una venta solo se hace dentro de un turno abierto.
 */
export function SellPage() {
  const { active } = useLocal();
  const { state: shift } = useShift();
  const { state: sale, add, setQuantity, setDiscount, remove, clear } = useSelling();
  const { state: copy, search: searchCopy, stockOf } = useReadCopy();
  const [query, setQuery] = useState('');
  const [emptying, setEmptying] = useState(false);
  // La lista de resultados se dibuja con un valor que se pone al dia sin frenar lo que se escribe: tocar y escribir siguen fluidos
  // aunque el catalogo sea grande.
  const settled = useDeferredValue(query);
  const found = useMemo(
    () => searchCopy(settled),
    // La busqueda cambia cuando cambia lo escrito o cuando la copia trae otro catalogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settled, searchCopy, copy.productsAsOf, copy.productCount],
  );

  if (active === null) return null;

  if (shift.status === 'loading') {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="text-base text-fg-muted">Cargando el turno…</p>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (shift.status === 'failed') {
    return (
      <>
        <Heading />
        <Callout tone="warn" title="No pudimos leer el turno de este equipo">
          Lo que hay guardado no se pudo abrir. Mira el turno para volver a intentarlo.
        </Callout>
        <LinkButton to="/mostrador/turno">Ver el turno</LinkButton>
      </>
    );
  }

  if (shift.status !== 'open') {
    return (
      <>
        <Heading />
        <Callout tone="warn" title="Abre un turno para vender">
          Cada venta queda en un turno de caja: con el efectivo inicial se cuadra la caja al cerrar.
        </Callout>
        <LinkButton to="/mostrador/turno">Abrir turno</LinkButton>
      </>
    );
  }

  const lines = sale.cart.lines;
  const { summary } = sale;

  function addProduct(product: Product) {
    add(product);
    setQuery('');
    focusField(SEARCH);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    // Un lector termina de escribir el codigo con Enter: se busca lo escrito ahora mismo, sin esperar a la lista de resultados.
    const [first, second] = searchCopy(query);
    if (first === undefined) return;
    if (second === undefined || isExactCode(first, query)) addProduct(first);
  }

  const rows: SummaryRow[] = [
    { label: 'Base sin IVA', value: formatPesos(summary.base.amount) },
    ...summary.byRate
      .filter((row) => row.tax.amount > 0)
      .map((row) => ({
        label: `IVA ${String(row.rateBp / 100)} % incluido`,
        value: formatPesos(row.tax.amount),
      })),
    { label: 'Total', value: formatPesos(summary.total.amount), strong: true },
  ];

  return (
    <>
      <Heading subtitle={`Turno abierto desde las ${formatTime(new Date(shift.shift.openedAt))}`} />

      <div className="flex flex-col gap-2">
        <FormField
          id={SEARCH}
          label="Buscar o leer un código"
          value={query}
          onChange={setQuery}
          onKeyDown={onKeyDown}
          inputMode="search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Nombre, código o escanéalo"
        />
        <p role="status" className="text-sm text-fg-muted">
          {searchMessage(settled, found.length)}
        </p>
        {found.length > 0 && (
          <ul aria-label="Resultados de la búsqueda" className="flex flex-col">
            {found.map((product) => {
              const stock = stockOf(product.id);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => {
                      addProduct(product);
                    }}
                    className="flex min-h-touch w-full items-center justify-between gap-3 border-b border-border py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="text-base font-medium text-fg">{product.name}</span>
                      <span className="text-sm text-fg-muted">{detailOf(product, stock)}</span>
                    </span>
                    <span className="shrink-0 text-base font-semibold tabular-nums text-fg">
                      {formatPesos(product.unitPrice)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised p-4">
          <p className="text-base font-semibold text-fg">La venta está vacía</p>
          <p className="text-sm text-fg-muted">Busca un producto o lee su código para agregarlo.</p>
        </div>
      ) : (
        <section aria-labelledby="venta-titulo" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="venta-titulo" className="text-xl font-semibold text-fg">
              Venta en curso
            </h2>
            <span className="text-sm text-fg-muted">{productsLabel(lines.length)}</span>
            <button
              type="button"
              onClick={() => {
                setEmptying(true);
              }}
              className="inline-flex min-h-touch items-center rounded-md px-2 text-sm font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Vaciar la venta
            </button>
          </div>
          <ul aria-label="Venta en curso" className="flex flex-col gap-2">
            {lines.map((line) => (
              <CartLineRow
                key={line.productId}
                line={line}
                stockMilli={stockOf(line.productId)}
                onQuantity={setQuantity}
                onDiscount={setDiscount}
                onRemove={remove}
              />
            ))}
          </ul>
          <SummaryCard name="Totales de la venta" rows={rows} />
        </section>
      )}

      <ChargeBar count={lines.length} total={summary.total.amount} />

      {emptying && (
        <ConfirmDialog
          title="¿Vaciar la venta?"
          confirmLabel="Sí, vaciar"
          cancelLabel="Seguir con la venta"
          onConfirm={() => {
            clear();
            setEmptying(false);
          }}
          onCancel={() => {
            setEmptying(false);
          }}
        >
          {`Se quitan ${productsLabel(lines.length)} de la venta. No se puede deshacer.`}
        </ConfirmDialog>
      )}
    </>
  );
}
