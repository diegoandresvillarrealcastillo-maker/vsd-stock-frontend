export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequest {
  readonly method: HttpMethod;
  /** La ruta de la API, siempre con `/` delante: `/v1/users`. Nunca una direccion completa. */
  readonly path: string;
  /** Parametros de la URL; los `undefined` se omiten. */
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  /** El cuerpo JSON, si la operacion lo lleva. */
  readonly body?: unknown;
}

export interface ApiResponse<T> {
  readonly status: number;
  /** El cuerpo ya leido; `undefined` si la respuesta no trae (un 204). */
  readonly body: T;
  /** `true` si el servidor repitio la respuesta de una operacion que ya habia aplicado (`Idempotent-Replayed`, ADR 0019). */
  readonly replayed: boolean;
}

/**
 * Puerto de salida: la API de VSD Stock. Pone el token de la sesion en cada peticion; si no hay sesion ni siquiera sale. Todo
 * fallo es un `ApiError` con su clase (ADR 0009): el llamador decide por la clase y por el `code` del problema, nunca por el
 * texto.
 */
export interface ApiGateway {
  send<T>(request: ApiRequest): Promise<ApiResponse<T>>;
}
