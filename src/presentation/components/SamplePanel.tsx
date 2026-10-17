import { AnimatePresence, m } from 'framer-motion';
import { useReveal, useStagger } from '../motion/use-motion';
import { Skeleton } from './Skeleton';

export interface SampleItem {
  id: string;
  name: string;
  units: number;
  /** Precio en pesos colombianos. */
  price: number;
}

interface SamplePanelProps {
  items: readonly SampleItem[];
  loading: boolean;
}

const PANEL = 'rounded-lg border border-border/45 bg-surface-raised p-4 shadow-sm';
const ROW = 'flex items-center justify-between gap-4 py-3';

// Alto de cada linea de texto de la fila. El skeleton usa las mismas alturas que
// el contenido real: asi la pagina no salta cuando termina de cargar.
const NAME_LINE = 'flex h-6 items-center';
const DETAIL_LINE = 'flex h-5 items-center';

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function unitsLabel(units: number): string {
  return units === 1 ? '1 unidad' : `${units} unidades`;
}

/**
 * Panel de muestra del sistema de diseno: una lista de productos y su estado de
 * carga. El skeleton tiene una fila por producto, con la misma forma que la
 * fila real, y el cambio entre uno y otro es una entrada con Framer Motion.
 */
export function SamplePanel({ items, loading }: SamplePanelProps) {
  const reveal = useReveal();
  const stagger = useStagger();

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <m.div
          key="loading"
          role="status"
          aria-busy="true"
          className={PANEL}
          variants={reveal}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <span className="sr-only">Cargando el resumen…</span>
          <ul aria-hidden="true" className="divide-y divide-border/40">
            {items.map((item) => (
              <li key={item.id} className={ROW}>
                <div className="flex flex-col">
                  <div className={NAME_LINE}>
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className={DETAIL_LINE}>
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-16" />
              </li>
            ))}
          </ul>
        </m.div>
      ) : (
        <m.section
          key="content"
          aria-label="Resumen de ejemplo"
          className={PANEL}
          variants={reveal}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <m.ul variants={stagger} className="divide-y divide-border/40">
            {items.map((item) => (
              <m.li key={item.id} variants={reveal} className={ROW}>
                <div className="flex flex-col">
                  <span className={`${NAME_LINE} text-base font-medium text-fg`}>{item.name}</span>
                  {item.units === 0 ? (
                    <span className={DETAIL_LINE}>
                      <span className="rounded-sm border border-border px-2 text-xs text-fg-muted">
                        Agotado
                      </span>
                    </span>
                  ) : (
                    <span className={`${DETAIL_LINE} text-sm text-fg-muted`}>
                      {unitsLabel(item.units)}
                    </span>
                  )}
                </div>
                <span className="text-base font-medium text-fg tabular-nums">
                  {pesos.format(item.price)}
                </span>
              </m.li>
            ))}
          </m.ul>
        </m.section>
      )}
    </AnimatePresence>
  );
}
