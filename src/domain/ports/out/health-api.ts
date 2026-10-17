import type { HealthReport } from '../../model/health-report';

/** Pregunta al servidor si esta en pie (`GET /health`). */
export interface HealthApi {
  /**
   * Devuelve el informe del servidor. Se rechaza si el servidor no responde a
   * tiempo, responde con un error o responde algo que no es un informe de
   * salud: en esos casos la aplicacion no puede darse por conectada.
   */
  fetchHealth(): Promise<HealthReport>;
}
