/** Lo que el servidor dice cuando esta en pie. */
export interface HealthReport {
  /** Instante, segun el reloj del servidor, en que comprobo su propio estado. */
  readonly reportedAt: Date;
}
