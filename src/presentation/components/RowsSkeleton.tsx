import { Skeleton } from './Skeleton';

/**
 * Las filas de una lista mientras carga. Es decoracion: quien no ve la pantalla oye el aviso «Cargando…» del contenedor
 * (`role="status"`), no los bloques.
 */
export function RowsSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">{label}</p>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}
