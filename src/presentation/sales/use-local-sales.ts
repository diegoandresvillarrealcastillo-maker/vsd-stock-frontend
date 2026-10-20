import { useEffect, useState } from 'react';
import { localSaleOf, type LocalSale } from '../../domain/model/sales-history';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { useSync } from '../sync/SyncProvider';

/** Las ventas que todavía están en este equipo: las que esperan a enviarse y las que el servidor no aceptó. Las más nuevas primero. */
export interface LocalSales {
  readonly waiting: readonly LocalSale[];
  readonly rejected: readonly LocalSale[];
}

const NONE: LocalSales = { waiting: [], rejected: [] };

/** Cuántas de las que esperan se leen como máximo: más de eso no cabe en una pantalla y el envío las va sacando. */
const WAITING_LIMIT = 200;

const newestFirst = (a: LocalSale, b: LocalSale) => b.at.getTime() - a.at.getTime();

/**
 * Lo que la cola de este equipo guarda de ventas, para mostrarlo en la lista aunque no haya conexión. Se vuelve a leer cuando el
 * envío dice que algo se movió (cuántas esperan, cuántas piden atención o cuándo fue el último envío).
 */
export function useLocalSales(): LocalSales {
  const { workspace, active } = useLocal();
  const { state: sync } = useSync();
  const [sales, setSales] = useState<LocalSales>(NONE);
  const moved = `${String(sync.pending)}/${String(sync.attention)}/${String(sync.lastSyncedAt?.getTime() ?? 0)}`;

  useEffect(() => {
    let cancelled = false;
    // Se pide dentro de una promesa: si nadie trabaja, `outbox()` lanza y eso no debe romper la pantalla.
    void Promise.resolve()
      .then(async () => {
        const outbox = workspace.outbox();
        const [waiting, rejected] = await Promise.all([
          outbox.pending(WAITING_LIMIT),
          outbox.attention(),
        ]);
        const sales = (operations: typeof waiting) =>
          operations.flatMap((operation) => localSaleOf(operation) ?? []).sort(newestFirst);
        return { waiting: sales(waiting), rejected: sales(rejected) };
      })
      .then(
        (found) => {
          if (!cancelled) setSales(found);
        },
        // Nadie trabaja ya, o no se pudo leer: no se dice nada en vez de decir algo que no se sabe.
        () => undefined,
      );
    return () => {
      cancelled = true;
    };
  }, [workspace, active, moved]);

  return sales;
}
