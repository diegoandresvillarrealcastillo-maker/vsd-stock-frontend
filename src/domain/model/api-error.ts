import type { FailureClass, Problem } from './problem';

/** Lo que se sabe de un fallo de la API: de que clase es (ADR 0009), que estado dio y que dijo el servidor. */
export interface ApiFailure {
  readonly class: FailureClass;
  /** `null` si no hubo respuesta (red) o no se llego a pedir (no hay sesion). */
  readonly status: number | null;
  /** El cuerpo `application/problem+json`, o `null` si no lo traia con la forma del contrato. */
  readonly problem: Problem | null;
  /** Cuanto pidio esperar el servidor antes de reintentar, o `null`. */
  readonly retryAfterMs: number | null;
}

export class ApiError extends Error {
  constructor(readonly failure: ApiFailure) {
    // El detalle del servidor es para quien programa; no se mezcla con lo que la interfaz le diga a la persona.
    super(
      `API request failed: ${failure.class}${failure.problem ? ` (${failure.problem.code})` : ''}`,
    );
    this.name = 'ApiError';
  }

  /** El codigo estable del problema, o `undefined` si el servidor no lo dio. */
  get code(): string | undefined {
    return this.failure.problem?.code;
  }
}
