import { HttpApiGateway } from '../adapters/out/api/http-api-gateway';
import { HttpIdentityService } from '../adapters/out/identity/http-identity-service';
import { UnconfiguredIdentityService } from '../adapters/out/identity/unconfigured-identity-service';
import { MemorySessionStore } from '../adapters/out/session/memory-session-store';
import { LoadMeUseCase } from '../application/usecases/load-me.usecase';
import { SessionManagerUseCase } from '../application/usecases/session-manager.usecase';
import type { LoadMe } from '../domain/ports/in/load-me';
import type { SessionManager } from '../domain/ports/in/session-manager';
import type { ApiGateway } from '../domain/ports/out/api-gateway';
import type { Clock } from '../domain/ports/out/clock';
import type { AuthConfig } from './auth-config';

interface Environment {
  /** El servicio de identidad, o `null` si la aplicacion se compilo sin uno. */
  auth: AuthConfig | null;
  /** Direccion de la API, o vacia si esta en el mismo origen. */
  apiBaseUrl: string;
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  now: () => Date;
}

export interface Auth {
  readonly sessions: SessionManager;
  readonly loadMe: LoadMe;
  /** La API con el token de la sesion puesto: de aqui salen los demas casos de uso que hablan con ella. */
  readonly api: ApiGateway;
}

/**
 * Arma la sesion de la persona y la pregunta «quien soy» con los adaptadores del navegador (ADR 0002). La sesion vive solo
 * en memoria; el navegador habla con el servicio de identidad directamente y con la API usando el token de la sesion.
 */
export function createAuth(env: Environment): Auth {
  const clock: Clock = { now: env.now };
  const store = new MemorySessionStore();
  const identity =
    env.auth === null
      ? new UnconfiguredIdentityService()
      : new HttpIdentityService({
          authUrl: env.auth.authUrl,
          publishableKey: env.auth.publishableKey,
          clock,
          fetch: env.fetch,
        });
  const sessions = new SessionManagerUseCase({ identity, store, clock });
  const api = new HttpApiGateway({
    baseUrl: env.apiBaseUrl,
    sessions,
    fetch: env.fetch,
    now: () => env.now().getTime(),
  });
  return { sessions, loadMe: new LoadMeUseCase(api), api };
}
