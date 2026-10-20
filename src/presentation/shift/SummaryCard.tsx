export interface SummaryRow {
  readonly label: string;
  readonly value: string;
  /** La fila que importa (lo esperado en la caja, la diferencia): va separada y con mas peso. */
  readonly strong?: boolean;
}

/**
 * Una tarjeta de cuentas: cada fila es un termino y su monto. Se lee como una lista de definiciones y el grupo tiene nombre, asi
 * que un lector de pantalla dice de que cuentas se trata antes de leerlas.
 */
export function SummaryCard({ name, rows }: { name: string; rows: readonly SummaryRow[] }) {
  return (
    <div
      role="group"
      aria-label={name}
      className="rounded-lg border border-border bg-surface-raised p-4"
    >
      <dl className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`flex items-baseline justify-between gap-3 ${row.strong === true ? 'border-t border-border pt-2' : ''}`}
          >
            <dt
              className={`text-base ${row.strong === true ? 'font-semibold text-fg' : 'text-fg-muted'}`}
            >
              {row.label}
            </dt>
            <dd className="text-base font-semibold tabular-nums text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
