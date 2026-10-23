import type { MonthlyReport } from '../../model/monthly-report';

/**
 * Puerto de entrada: los reportes (ADR 0035 del backend). Es de la gerencia y necesita conexion. Todo fallo es un `ApiError` con su
 * clase (ADR 0009).
 */
export interface Reports {
  /** El reporte de un mes (`AAAA-MM`, a hora de Bogota): las ventas por tarifa y tipo, las anulaciones aparte y lo cobrado por medio. */
  monthly(month: string): Promise<MonthlyReport>;
}
