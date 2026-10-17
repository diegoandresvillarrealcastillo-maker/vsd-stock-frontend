import { AuthError } from '../../../domain/model/auth-failure';
import type { Session } from '../../../domain/model/session';
import type { IdentityService } from '../../../domain/ports/out/identity-service';

/**
 * El servicio de identidad cuando la aplicacion se compilo sin uno (ADR 0022): la aplicacion arranca y, al intentar entrar,
 * dice que el servicio no esta disponible; no acusa a la persona de haber escrito mal su clave.
 */
export class UnconfiguredIdentityService implements IdentityService {
  signIn(_email: string, _password: string): Promise<Session> {
    return Promise.reject(new AuthError('unavailable'));
  }

  signUp(_email: string, _password: string): Promise<Session | null> {
    return Promise.reject(new AuthError('unavailable'));
  }

  refresh(_refreshToken: string): Promise<Session> {
    return Promise.reject(new AuthError('unavailable'));
  }

  signOut(_accessToken: string): Promise<void> {
    return Promise.resolve();
  }
}
