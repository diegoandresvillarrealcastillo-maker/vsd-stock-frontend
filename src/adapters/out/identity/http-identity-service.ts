import { AuthError, authFailureOf } from '../../../domain/model/auth-failure';
import type { Session } from '../../../domain/model/session';
import type { Clock } from '../../../domain/ports/out/clock';
import type { IdentityService } from '../../../domain/ports/out/identity-service';

/** Un servicio que tarda mas que esto se da por caido. */
const DEFAULT_TIMEOUT_MS = 10_000;

interface Options {
  /** La direccion de Supabase Auth, por ejemplo `https://REF.supabase.co/auth/v1`. */
  authUrl: string;
  /** La clave PUBLICABLE del proyecto (`sb_publishable_...`): es publica por diseno, no una credencial. */
  publishableKey: string;
  clock: Clock;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Habla con Supabase Auth (GoTrue) por HTTP, con `fetch` y sin biblioteca (ADR 0022 y 0024). El navegador va directo al
 * servicio, no a traves de nuestra API: los limites de uso de Supabase se cuentan por IP, y detras de un proxy todas las
 * personas compartirian la de la API. Nada de lo que la persona escribe se guarda ni se repite en un error.
 */
export class HttpIdentityService implements IdentityService {
  private readonly authUrl: string;
  private readonly publishableKey: string;
  private readonly clock: Clock;
  private readonly fetch: Options['fetch'];
  private readonly timeoutMs: number;

  constructor({ authUrl, publishableKey, clock, fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: Options) {
    this.authUrl = authUrl.replace(/\/+$/, '');
    this.publishableKey = publishableKey;
    this.clock = clock;
    this.fetch = fetch;
    this.timeoutMs = timeoutMs;
  }

  async signIn(email: string, password: string): Promise<Session> {
    const body = await this.post('/token?grant_type=password', { email, password });
    return this.sessionOf(body) ?? this.unexpected();
  }

  async signUp(email: string, password: string): Promise<Session | null> {
    const body = await this.post('/signup', { email, password });
    // Sin confirmar el correo no hay sesion: el servicio solo devuelve a la persona creada.
    return this.sessionOf(body);
  }

  async refresh(refreshToken: string): Promise<Session> {
    const body = await this.post('/token?grant_type=refresh_token', {
      refresh_token: refreshToken,
    });
    return this.sessionOf(body) ?? this.unexpected();
  }

  async signOut(accessToken: string): Promise<void> {
    await this.post('/logout', undefined, accessToken);
  }

  /** Hace la peticion y devuelve el cuerpo ya leido (o `undefined` si no lo hay). Lanza `AuthError`. */
  private async post(path: string, payload: unknown, accessToken?: string): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      apikey: this.publishableKey,
    };
    if (payload !== undefined) headers['Content-Type'] = 'application/json';
    if (accessToken !== undefined) headers['Authorization'] = `Bearer ${accessToken}`;

    // Se saca a una variable para llamarla suelta: algunos navegadores lanzan "Illegal invocation" si `fetch` se
    // invoca como metodo de otro objeto.
    const { fetch } = this;
    let response: Response;
    try {
      response = await fetch(`${this.authUrl}${path}`, {
        method: 'POST',
        headers,
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        // Ni cache ni cookies: la respuesta lleva credenciales de la persona.
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new AuthError('network');
    }

    const text = await response.text().catch(() => '');
    let parsed: unknown;
    try {
      parsed = text === '' ? undefined : JSON.parse(text);
    } catch {
      parsed = undefined;
    }
    if (!response.ok) throw new AuthError(authFailureOf(response.status, parsed));
    return parsed;
  }

  /** La sesion de una respuesta del servicio, o `null` si la respuesta no trae una (el correo sin confirmar). */
  private sessionOf(body: unknown): Session | null {
    if (!isRecord(body) || body['access_token'] === undefined) return null;
    const accessToken = body['access_token'];
    const user = body['user'];
    if (typeof accessToken !== 'string' || accessToken === '') this.unexpected();
    if (!isRecord(user) || typeof user['id'] !== 'string' || user['id'] === '') this.unexpected();

    const refreshToken = body['refresh_token'];
    const email = user['email'];
    return {
      accessToken,
      refreshToken: typeof refreshToken === 'string' && refreshToken !== '' ? refreshToken : null,
      expiresAt: this.expiryOf(body),
      user: { id: user['id'], email: typeof email === 'string' && email !== '' ? email : null },
    };
  }

  private expiryOf(body: Record<string, unknown>): Date {
    const seconds = body['expires_in'];
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
      // Relativo a la hora de este dispositivo: asi no depende de que su reloj coincida con el del servicio.
      return new Date(this.clock.now().getTime() + seconds * 1000);
    }
    const unix = body['expires_at'];
    if (typeof unix === 'number' && Number.isFinite(unix) && unix > 0) {
      return new Date(unix * 1000);
    }
    return this.unexpected();
  }

  private unexpected(): never {
    // El servicio respondio algo que no es lo que dice su contrato: no se inventa una sesion.
    throw new AuthError('unknown');
  }
}
