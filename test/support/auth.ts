import { MemorySessionStore } from '../../src/adapters/out/session/memory-session-store';
import { SessionManagerUseCase } from '../../src/application/usecases/session-manager.usecase';
import { ApiError } from '../../src/domain/model/api-error';
import { AuthError } from '../../src/domain/model/auth-failure';
import type { Me } from '../../src/domain/model/me';
import type { Role } from '../../src/domain/model/permissions';
import type { Session } from '../../src/domain/model/session';
import type { LoadMe } from '../../src/domain/ports/in/load-me';
import type { SessionManager } from '../../src/domain/ports/in/session-manager';
import type { IdentityService } from '../../src/domain/ports/out/identity-service';

// Dobles en memoria de la sesion y de la pregunta «quien soy». El caso de uso de la sesion es el REAL; solo se sustituye
// lo que hay detras (el servicio de identidad y la API). Los usan las pruebas de la interfaz.

export const TEST_NOW = new Date('2026-10-17T12:00:00.000Z');
const HOUR = 3_600_000;

export function testSession(userId: string, token = 'acceso'): Session {
  return {
    accessToken: token,
    refreshToken: 'renovacion',
    expiresAt: new Date(TEST_NOW.getTime() + HOUR),
    user: { id: userId, email: `${userId}@example.com` },
  };
}

export function testMe(
  userId: string,
  role: Role = 'owner',
  businessName = 'Tienda La Esquina',
): Me {
  return {
    identity: { id: userId, email: `${userId}@example.com` },
    membership: {
      userId: `u-${userId}`,
      businessId: 'b-1',
      businessName,
      role,
      fullName: 'Ana Gómez',
    },
  };
}

export function testApiError(kind: 'session' | 'network' | 'transient' = 'network'): ApiError {
  return new ApiError({
    class: kind,
    status: kind === 'session' ? 401 : kind === 'transient' ? 503 : null,
    problem: null,
    retryAfterMs: null,
  });
}

export interface TestAuth {
  sessions: SessionManager;
  store: MemorySessionStore;
  loadMe: LoadMe;
  /** A quien se le pregunto `GET /v1/me`, en orden. */
  loads: string[];
  /** Prepara las respuestas de `GET /v1/me`, una por pregunta. */
  answer: (...steps: (Me | ApiError)[]) => void;
}

/** Una sesion de verdad con un servicio de identidad que acepta a cualquiera, y una API que contesta lo que se prepare. */
export function createTestAuth(
  options: { stored?: Session; signUpGivesSession?: boolean } = {},
): TestAuth {
  const store = new MemorySessionStore();
  if (options.stored) store.set(options.stored);
  const identity: IdentityService = {
    signIn: (email) => Promise.resolve(testSession(email.split('@')[0] ?? 'x')),
    signUp: () =>
      Promise.resolve(options.signUpGivesSession === true ? testSession('nueva') : null),
    refresh: () => Promise.reject(new AuthError('network')),
    signOut: () => Promise.resolve(),
  };
  const sessions = new SessionManagerUseCase({ identity, store, clock: { now: () => TEST_NOW } });

  const loads: string[] = [];
  let plan: (() => Promise<Me>)[] = [];
  const loadMe: LoadMe = {
    execute: () => {
      loads.push(store.get()?.user.id ?? 'sin-sesion');
      const next = plan.shift();
      return next ? next() : Promise.reject(new Error('no hay respuesta preparada'));
    },
  };
  return {
    sessions,
    store,
    loadMe,
    loads,
    answer: (...steps) => {
      plan = steps.map(
        (step) => () => (step instanceof ApiError ? Promise.reject(step) : Promise.resolve(step)),
      );
    },
  };
}
