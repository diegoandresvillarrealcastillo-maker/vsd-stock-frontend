import type { Me } from '../../model/me';

/** Pregunta a la API quien es la persona de la sesion y donde trabaja. Lanza `ApiError`. */
export interface LoadMe {
  execute(): Promise<Me>;
}
