import { describe, expect, it } from 'vitest';
import { AuthError } from '../../../domain/model/auth-failure';
import { UnconfiguredIdentityService } from './unconfigured-identity-service';

describe('UnconfiguredIdentityService', () => {
  const service = new UnconfiguredIdentityService();

  it.each([
    ['sign in', () => service.signIn('ana@example.com', 'clave-larga-1')],
    ['sign up', () => service.signUp('ana@example.com', 'clave-larga-1')],
    ['refresh', () => service.refresh('renovacion')],
  ])(
    'says the service is unavailable when asked to %s, never that the credentials are wrong',
    async (_name, call) => {
      const failure = await call().catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(AuthError);
      expect((failure as AuthError).kind).toBe('unavailable');
    },
  );

  it('closes a session without asking anyone: there is no one to ask', async () => {
    await expect(service.signOut('acceso')).resolves.toBeUndefined();
  });
});
