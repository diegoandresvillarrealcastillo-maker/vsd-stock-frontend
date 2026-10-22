import { Link } from 'react-router';
import { formatPesos } from '../../domain/model/quantity';

/** Cuantos productos hay, dicho en singular o plural: `1 producto`, `3 productos`. */
export function productsLabel(count: number): string {
  return count === 1 ? '1 producto' : `${String(count)} productos`;
}

/**
 * La barra de cobro (el componente «Barra de cobro» del diseno): pegada al borde de abajo, dice el total (o que no hay venta), y
 * lleva a cobrar. Sin venta, el boton esta apagado. Se alcanza con el pulgar.
 */
export function ChargeBar({ count, total }: { count: number; total: number }) {
  const label =
    'flex min-h-touch items-center justify-center rounded-md px-6 text-base font-semibold';
  return (
    <section
      aria-label="Cobro"
      className="sticky bottom-0 -mx-gutter flex items-center justify-between gap-3 border-t border-border bg-surface-raised px-gutter py-3 shadow-sm"
    >
      <div className="flex flex-col">
        <span className="text-sm text-fg-muted">{count === 0 ? 'Sin venta' : 'Total'}</span>
        <span className="text-xl font-semibold tabular-nums text-fg">{formatPesos(total)}</span>
      </div>
      {count === 0 ? (
        <button
          type="button"
          disabled
          className={`${label} cursor-not-allowed bg-primary text-on-primary opacity-45`}
        >
          Cobrar
        </button>
      ) : (
        <Link
          to="/mostrador/cobrar"
          className={`${label} bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
        >
          Cobrar
        </Link>
      )}
    </section>
  );
}
