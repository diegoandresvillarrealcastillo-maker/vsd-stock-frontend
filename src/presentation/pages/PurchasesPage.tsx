import { Link, useLocation } from 'react-router';
import { formatDay } from '../../domain/model/moment';
import type { PurchaseSummary } from '../../domain/model/purchasing';
import { FormAlert } from '../components/FormAlert';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { useLoad } from '../forms/use-load';
import { usePagedLoad } from '../forms/use-paged-load';
import { usePurchasing } from '../purchasing/PurchasingProvider';

function Row({
  purchase,
  supplierName,
}: {
  purchase: PurchaseSummary;
  /** El nombre del proveedor, o `undefined` si todavia no se sabe. */
  supplierName: string | undefined;
}) {
  const day = formatDay(purchase.createdAt);
  const title = supplierName === undefined ? day : `${day} · ${supplierName}`;
  const products = `${String(purchase.lineCount)} ${purchase.lineCount === 1 ? 'producto' : 'productos'}`;
  return (
    <li className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
      <p className="text-base font-medium text-fg">{title}</p>
      <p className="text-sm text-fg-muted">
        {purchase.note === null ? products : `${products} · ${purchase.note}`}
      </p>
    </li>
  );
}

/** Las compras del negocio (ADR 0019): la mercancia que entro a la bodega, la mas nueva primero. */
export function PurchasesPage() {
  const purchasing = usePurchasing();
  const location = useLocation();
  const notice = (location.state as { notice?: unknown } | null)?.notice;
  const { state, reload } = usePagedLoad(
    (cursor) =>
      cursor === undefined ? purchasing.listPurchases() : purchasing.listPurchases(cursor),
    [],
  );
  // Los nombres de los proveedores son un adorno de cada fila: si no llegan, la lista se muestra igual.
  const suppliers = useLoad(() => purchasing.listAllSuppliers(), []);
  const supplierNames =
    suppliers.state.status === 'ready'
      ? new Map(suppliers.state.data.map((supplier) => [supplier.id, supplier.name]))
      : null;

  function supplierNameOf(purchase: PurchaseSummary): string | undefined {
    if (purchase.supplierId === null) return 'Sin proveedor';
    return supplierNames?.get(purchase.supplierId);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">Compras</h1>
        <p className="text-base text-fg-muted">La mercancía que entró a tu bodega.</p>
      </div>
      {typeof notice === 'string' && (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      )}
      <LinkButton to="/compras/nueva">Nueva compra</LinkButton>
      {state.status === 'loading' && <RowsSkeleton label="Cargando compras…" />}
      {state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar las compras"
          message={state.problem.message}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && (
        <>
          {state.items.length === 0 ? (
            <p className="text-base text-fg-muted">Todavía no registraste compras.</p>
          ) : (
            <ul aria-label="Compras" className="flex flex-col">
              {state.items.map((purchase) => (
                <Row
                  key={purchase.id}
                  purchase={purchase}
                  supplierName={supplierNameOf(purchase)}
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
      <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3">
        <p className="text-base font-medium text-fg">Proveedores</p>
        <p className="text-sm text-fg-muted">
          Lleva la lista de a quién le compras.{' '}
          <Link to="/compras/proveedores" className="font-medium text-primary underline">
            Ver y cambiar proveedores
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
