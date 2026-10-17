import { Link, useLocation, useParams } from 'react-router';
import { unitShort } from '../../domain/model/catalog';
import { movementLabel, type StockMovement } from '../../domain/model/inventory';
import { formatMoment } from '../../domain/model/moment';
import { can } from '../../domain/model/permissions';
import { formatQuantity, formatSignedQuantity } from '../../domain/model/quantity';
import { useMembership } from '../auth/AuthProvider';
import { FormAlert } from '../components/FormAlert';
import { LinkButton } from '../components/LinkButton';
import { LoadFailed } from '../components/LoadFailed';
import { RowsSkeleton } from '../components/RowsSkeleton';
import { SubmitButton } from '../components/SubmitButton';
import { useLoad } from '../forms/use-load';
import { usePagedLoad } from '../forms/use-paged-load';
import { useInventory } from '../inventory/InventoryProvider';

function Back() {
  return (
    <Link to="/inventario" className="text-sm font-medium text-primary underline">
      Volver a existencias
    </Link>
  );
}

function Row({ movement, unit }: { movement: StockMovement; unit: string | null }) {
  const when = formatMoment(movement.createdAt);
  const detail = movement.reason === null ? when : `${movement.reason} · ${when}`;
  const amount = formatSignedQuantity(movement.deltaMilli);
  return (
    <li className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-medium text-fg">{movementLabel(movement.kind)}</span>
        <span className="text-sm text-fg-muted">{detail}</span>
      </span>
      <span
        className={`shrink-0 text-base font-semibold ${movement.deltaMilli < 0 ? 'text-accent-text' : 'text-fg'}`}
      >
        {unit === null ? amount : `${amount} ${unit}`}
      </span>
    </li>
  );
}

/** El historial de un producto (ADR 0013): cada fila es algo que paso y no se borra; un error se corrige con otro movimiento. */
export function StockHistoryPage() {
  const { productId = '' } = useParams();
  const inventory = useInventory();
  const membership = useMembership();
  const location = useLocation();
  const notice = (location.state as { notice?: unknown } | null)?.notice;
  const stock = useLoad(() => inventory.findStock(productId), [productId]);
  const history = usePagedLoad(
    (cursor) =>
      cursor === undefined
        ? inventory.listMovements(productId)
        : inventory.listMovements(productId, cursor),
    [productId],
  );

  if (stock.state.status === 'failed' && stock.state.problem.code === 'product-not-found') {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <h1 className="text-3xl font-semibold text-fg">No encontramos ese producto</h1>
        <p className="text-base text-fg-muted">
          Puede que la dirección esté mal escrita. Vuelve a las existencias para ver tus productos.
        </p>
      </section>
    );
  }
  if (stock.state.status === 'failed') {
    return (
      <section className="flex flex-col gap-4">
        <Back />
        <LoadFailed
          title="No pudimos cargar el producto"
          message={stock.state.problem.message}
          onRetry={stock.reload}
        />
      </section>
    );
  }

  const item = stock.state.status === 'ready' ? stock.state.data : null;
  const unit = item === null ? null : unitShort(item.unit);
  const intro = 'Cada fila es algo que pasó y no se borra.';
  const canAdjust = membership !== null && can(membership.role, 'stock:adjust');

  return (
    <section className="flex flex-col gap-4">
      <Back />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-fg">
          {stock.state.status === 'loading'
            ? 'Cargando…'
            : (item?.name ?? 'Historial del producto')}
        </h1>
        <p className="text-base text-fg-muted">
          {item === null
            ? intro
            : `Hay ${formatQuantity(item.quantityMilli)} ${unit ?? ''}. ${intro}`}
        </p>
      </div>
      {typeof notice === 'string' && (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      )}
      {canAdjust && (
        <LinkButton to={`/inventario/${encodeURIComponent(productId)}/ajustar`}>
          Ajustar existencia
        </LinkButton>
      )}
      {history.state.status === 'loading' && <RowsSkeleton label="Cargando el historial…" />}
      {history.state.status === 'failed' && (
        <LoadFailed
          title="No pudimos cargar el historial"
          message={history.state.problem.message}
          onRetry={history.reload}
        />
      )}
      {history.state.status === 'ready' && (
        <>
          {history.state.items.length === 0 ? (
            <p className="text-base text-fg-muted">Este producto todavía no tiene movimientos.</p>
          ) : (
            <ul aria-label="Historial" className="flex flex-col">
              {history.state.items.map((movement) => (
                <Row key={movement.id} movement={movement} unit={unit} />
              ))}
            </ul>
          )}
          {history.state.moreProblem !== null && (
            <FormAlert title="No pudimos cargar más">{history.state.moreProblem.message}</FormAlert>
          )}
          {history.state.hasMore && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (history.state.status === 'ready') history.state.loadMore();
              }}
            >
              <SubmitButton pending={history.state.loadingMore} variant="accent">
                Cargar más
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </section>
  );
}
