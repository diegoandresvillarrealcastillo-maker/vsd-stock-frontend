import { createContext, useContext, type ReactNode } from 'react';
import type { Reports } from '../../domain/ports/in/reports';

const ReportsContext = createContext<Reports | null>(null);

/** Entrega el caso de uso de los reportes (ya cableado desde `infrastructure/`) a las pantallas que lo usan. */
export function ReportsProvider({ reports, children }: { reports: Reports; children: ReactNode }) {
  return <ReportsContext value={reports}>{children}</ReportsContext>;
}

/** Los reportes. Solo funciona dentro de `ReportsProvider`. */
export function useReports(): Reports {
  const value = useContext(ReportsContext);
  if (value === null) {
    throw new Error('useReports debe usarse dentro de <ReportsProvider>');
  }
  return value;
}
