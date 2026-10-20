import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { can } from '../../domain/model/permissions';
import type { SalesHistory } from '../../domain/ports/in/sales-history';
import { useOptionalAccount } from '../auth/AuthProvider';
import { useLocal } from '../local/LocalWorkspaceProvider';
import { useSync } from '../sync/SyncProvider';

/** Cuántas ventas piden atención: hasta un tope, y `more` dice que hay más de las que se cuentan. */
export interface AttentionCount {
  readonly count: number;
  readonly more: boolean;
}

interface SalesContextValue {
  readonly history: SalesHistory;
  /** Cuántas piden atención, o `null` si no se sabe (no es de la gerencia, no hay conexión o el servidor no contestó). */
  readonly attention: AttentionCount | null;
  /** Vuelve a contarlas: lo llama quien acaba de revisar o anular una venta. */
  readonly refreshAttention: () => void;
}

const SalesContext = createContext<SalesContextValue | null>(null);

/**
 * Entrega las ventas que el servidor ya tiene (C3-13) a toda la interfaz y lleva la cuenta de las que piden atención para el número
 * del menú. Solo la gerencia, con conexión, la pregunta; se vuelve a preguntar cuando el equipo envía algo (así llega una venta a la
 * bandeja) o cuando una pantalla dice que cambió lo que hay en ella.
 */
export function SalesProvider({
  history,
  children,
}: {
  history: SalesHistory;
  children: ReactNode;
}) {
  const { active } = useLocal();
  const account = useOptionalAccount();
  const { state: sync } = useSync();
  const role = active?.profile.role ?? null;
  const watching = role !== null && can(role, 'sale:view-all') && account?.state.status === 'ready';
  const [attention, setAttention] = useState<AttentionCount | null>(null);
  const [asked, setAsked] = useState(0);
  const lastSyncedAt = sync.lastSyncedAt?.getTime() ?? 0;

  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    history.attentionCount().then(
      (count) => {
        if (!cancelled) setAttention(count);
      },
      // Es un adorno del menú: si no se pudo contar, el menú no lleva número y la pantalla de ventas dice lo que pasó.
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [history, watching, lastSyncedAt, asked]);

  const value = useMemo<SalesContextValue>(
    () => ({
      history,
      attention: watching ? attention : null,
      refreshAttention: () => {
        setAsked((times) => times + 1);
      },
    }),
    [history, watching, attention],
  );

  return <SalesContext value={value}>{children}</SalesContext>;
}

/** Las ventas del servidor y cuántas piden atención. Solo funciona dentro de `SalesProvider`. */
export function useSales(): SalesContextValue {
  const value = useContext(SalesContext);
  if (value === null) {
    throw new Error('useSales debe usarse dentro de <SalesProvider>');
  }
  return value;
}
