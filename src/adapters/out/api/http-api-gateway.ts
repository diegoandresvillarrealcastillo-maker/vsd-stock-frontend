import { ApiError, type ApiFailure } from '../../../domain/model/api-error';
import { classifyFailure, parseProblem, parseRetryAfter } from '../../../domain/model/problem';
import type { SessionManager } from '../../../domain/ports/in/session-manager';
import type { ApiGateway, ApiRequest, ApiResponse } from '../../../domain/ports/out/api-gateway';

/** Una peticion que tarda mas que esto se da por perdida. */
const DEFAULT_TIMEOUT_MS = 15_000;

interface Options {
  /** Direccion de la API, sin barra final. Vacia si esta en el mismo origen. */
  baseUrl: string;
  sessions: Pick<SessionManager, 'accessToken'>;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** La hora en milisegundos, para entender un `Retry-After` dado como fecha. */
  now: () => number;
  timeoutMs?: number;
}

/** Una ruta de la API: empieza con una sola barra, sin direccion completa, sin parametros y sin salir hacia arriba. */
function isApiPath(path: string): boolean {
  return (
    /^\/(?!\/)[^\s?#]*$/.test(path) && !path.split('/').includes('..') && !path.includes('://')
  );
}

function failure(parts: Partial<ApiFailure> & Pick<ApiFailure, 'class'>): ApiError {
  return new ApiError({ status: null, problem: null, retryAfterMs: null, ...parts });
}

/**
 * Habla con la API de VSD Stock por HTTP, con `fetch` y los tipos del contrato (ADR 0024). Pone el token de la sesion en
 * cada peticion y NUNCA envia ese token a una direccion que no sea la de la API: solo acepta rutas, no direcciones.
 */
export class HttpApiGateway implements ApiGateway {
  private readonly baseUrl: string;
  private readonly sessions: Options['sessions'];
  private readonly fetch: Options['fetch'];
  private readonly now: Options['now'];
  private readonly timeoutMs: number;

  constructor({ baseUrl, sessions, fetch, now, timeoutMs = DEFAULT_TIMEOUT_MS }: Options) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.sessions = sessions;
    this.fetch = fetch;
    this.now = now;
    this.timeoutMs = timeoutMs;
  }

  async send<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    if (!isApiPath(request.path)) {
      throw new RangeError(
        `An API path starts with a single slash and has no address: ${request.path}`,
      );
    }
    const token = await this.sessions.accessToken();
    // Sin sesion no hay a quien atender: ni siquiera sale la peticion.
    if (token === null) throw failure({ class: 'session' });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';

    // Se saca a una variable para llamarla suelta: algunos navegadores lanzan "Illegal invocation" si `fetch` se
    // invoca como metodo de otro objeto.
    const { fetch } = this;
    let response: Response;
    try {
      response = await fetch(this.urlOf(request), {
        method: request.method,
        headers,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        // Ni cache ni cookies: la API usa un token en una cabecera, no cookies (ADR 0012).
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw failure({ class: 'network' });
    }

    const text = await response.text().catch(() => '');
    if (!response.ok) throw this.failureOf(response, text);
    return this.successOf<T>(response, text);
  }

  private urlOf({ path, query }: ApiRequest): string {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.append(name, String(value));
    }
    const search = params.toString();
    return `${this.baseUrl}${path}${search === '' ? '' : `?${search}`}`;
  }

  private successOf<T>(response: Response, text: string): ApiResponse<T> {
    const replayed = response.headers.get('Idempotent-Replayed') === 'true';
    if (response.status === 204 || text === '') {
      return { status: response.status, body: undefined as T, replayed };
    }
    try {
      return { status: response.status, body: JSON.parse(text) as T, replayed };
    } catch {
      // Un 200 que no es JSON no es nuestra API (un hosting que devuelve su pagina para cualquier ruta): no hay con que seguir.
      throw failure({ class: 'transient', status: response.status });
    }
  }

  private failureOf(response: Response, text: string): ApiError {
    // Un estado que no es un error (una redireccion sin seguir) no se puede clasificar: se trata como pasajero.
    if (response.status < 400) return failure({ class: 'transient', status: response.status });
    let body: unknown;
    try {
      body = text === '' ? undefined : JSON.parse(text);
    } catch {
      body = undefined;
    }
    return failure({
      class: classifyFailure(response.status),
      status: response.status,
      problem: parseProblem(body),
      retryAfterMs: parseRetryAfter(response.headers.get('Retry-After'), this.now()),
    });
  }
}
