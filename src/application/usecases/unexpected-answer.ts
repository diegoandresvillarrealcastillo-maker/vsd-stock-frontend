import { ApiError } from '../../domain/model/api-error';

/** Un 200 que no es el contrato no es nuestro servidor (un proxy, otra version): no se le cree y se trata como un fallo pasajero. */
export function unexpectedAnswer(status: number): ApiError {
  return new ApiError({ class: 'transient', status, problem: null, retryAfterMs: null });
}
