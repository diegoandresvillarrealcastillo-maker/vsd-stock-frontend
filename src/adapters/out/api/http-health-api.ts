import type { HealthReport } from '../../../domain/model/health-report';
import type { HealthApi } from '../../../domain/ports/out/health-api';
import type { paths } from './schema';

// La forma de la respuesta sale del contrato OpenAPI del backend (schema.d.ts,
// generado por `npm run contract:generate`): si el backend la cambia y se
// sincroniza el contrato, este archivo deja de compilar.
type HealthResponse = paths['/health']['get']['responses'][200]['content']['application/json'];

/** Un servidor que tarda mas que esto se da por caido. */
const DEFAULT_TIMEOUT_MS = 5_000;

interface Options {
  /** Direccion del servidor, sin barra final. Vacia si la API esta en el mismo origen. */
  baseUrl: string;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

// Los datos de la red no son de fiar aunque el contrato diga lo contrario: un
// servidor equivocado, un proxy o el index.html que algunos hosting devuelven
// con 200 para cualquier ruta tambien responden "bien". Se comprueba la forma.
function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) return false;
  const expectedStatus: HealthResponse['status'] = 'ok';
  return (
    'status' in value &&
    value.status === expectedStatus &&
    'timestamp' in value &&
    typeof value.timestamp === 'string'
  );
}

/** Pregunta `GET /health` al servidor por HTTP. */
export class HttpHealthApi implements HealthApi {
  private readonly url: string;
  private readonly fetch: Options['fetch'];
  private readonly timeoutMs: number;

  constructor({ baseUrl, fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: Options) {
    this.url = `${baseUrl.replace(/\/+$/, '')}/health`;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
  }

  async fetchHealth(): Promise<HealthReport> {
    // Se saca a una variable para llamarla suelta: algunos navegadores lanzan
    // "Illegal invocation" si `fetch` se invoca como metodo de otro objeto.
    const { fetch } = this;
    const response = await fetch(this.url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Sin cache: un /health guardado diria que hay conexion cuando ya no la hay.
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`GET /health respondió ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('GET /health no respondió JSON');
    }
    if (!isHealthResponse(body)) {
      throw new Error('GET /health respondió algo que no es el informe de salud del contrato');
    }

    const reportedAt = new Date(body.timestamp);
    if (Number.isNaN(reportedAt.getTime())) {
      throw new Error('GET /health respondió una fecha que no es válida');
    }
    return { reportedAt };
  }
}
