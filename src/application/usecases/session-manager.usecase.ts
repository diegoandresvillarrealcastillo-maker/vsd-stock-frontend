import { AuthError, type AuthFailureKind } from '../../domain/model/auth-failure';
import { isExpired, needsRefresh, type Session } from '../../domain/model/session';
import type { SessionManager } from '../../domain/ports/in/session-manager';
import type { Clock } from '../../domain/ports/out/clock';
import type { IdentityService } from '../../domain/ports/out/identity-service';
import type { SessionStore } from '../../domain/ports/out/session-store';

/** Fallos de la renovacion que no dicen nada de la sesion: no hubo respuesta, el servicio esta caido o limita el uso. */
const TRANSIENT: ReadonlySet<AuthFailureKind> = new Set(['network', 'unavailable', 'rate-limited']);

interface Dependencies {
  readonly identity: IdentityService;
  readonly store: SessionStore;
  readonly clock: Clock;
}

/**
 * Caso de uso: la sesion de la persona (ADR 0022). Entra, sale y entrega un token de acceso que sirva ahora, renovandolo
 * antes de que venza. La sesion vive solo en memoria.
 */
export class SessionManagerUseCase implements SessionManager {
  private readonly identity: IdentityService;
  private readonly store: SessionStore;
  private readonly clock: Clock;
  /** La renovacion en curso: quien llega mientras corre la espera en vez de pedir otra. */
  private renewing: Promise<string | null> | null = null;

  constructor({ identity, store, clock }: Dependencies) {
    this.identity = identity;
    this.store = store;
    this.clock = clock;
  }

  current(): Session | null {
    return this.store.get();
  }

  subscribe(listener: () => void): () => void {
    return this.store.subscribe(listener);
  }

  async signIn(email: string, password: string): Promise<Session> {
    const session = await this.identity.signIn(email, password);
    this.store.set(session);
    return session;
  }

  async signUp(email: string, password: string): Promise<Session | null> {
    const session = await this.identity.signUp(email, password);
    if (session !== null) this.store.set(session);
    return session;
  }

  async signOut(): Promise<void> {
    const session = this.store.get();
    if (session === null) return;
    // Primero se olvida: salir tiene que funcionar aunque el servidor no responda.
    this.store.clear();
    try {
      await this.identity.signOut(session.accessToken);
    } catch (error) {
      // El servidor puede no responder; si el fallo es otro, es un defecto y no se esconde.
      if (!(error instanceof AuthError)) throw error;
    }
  }

  accessToken(): Promise<string | null> {
    const session = this.store.get();
    if (session === null) return Promise.resolve(null);

    const now = this.clock.now();
    if (!needsRefresh(session, now)) return Promise.resolve(session.accessToken);
    if (session.refreshToken === null) {
      // Sin con que renovar: sirve mientras no venza y despues no queda mas que la contrasena.
      if (isExpired(session, now)) {
        this.store.clear();
        return Promise.resolve(null);
      }
      return Promise.resolve(session.accessToken);
    }
    this.renewing ??= this.renew(session, session.refreshToken).finally(() => {
      this.renewing = null;
    });
    return this.renewing;
  }

  private async renew(session: Session, refreshToken: string): Promise<string | null> {
    let next: Session;
    try {
      next = await this.identity.refresh(refreshToken);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      if (TRANSIENT.has(error.kind)) {
        // No se pudo preguntar: la sesion sigue siendo la misma, y su token sirve mientras no venza.
        return isExpired(session, this.clock.now()) ? null : session.accessToken;
      }
      // El servicio rechazo el token de renovacion: no hay camino de vuelta sin la contrasena.
      if (this.store.get() === session) this.store.clear();
      return null;
    }
    // Si mientras tanto la persona salio o entro de nuevo, esa sesion ya no es esta: no se le pisa.
    if (this.store.get() !== session) return null;
    this.store.set(next);
    return next.accessToken;
  }
}
