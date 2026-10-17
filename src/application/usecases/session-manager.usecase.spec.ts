// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AuthError, type AuthFailureKind } from '../../domain/model/auth-failure';
import type { Session } from '../../domain/model/session';
import type { Clock } from '../../domain/ports/out/clock';
import type { IdentityService } from '../../domain/ports/out/identity-service';
import type { SessionStore } from '../../domain/ports/out/session-store';
import { SessionManagerUseCase } from './session-manager.usecase';

const T0 = new Date('2026-10-17T12:00:00.000Z');
const HOUR = 3_600_000;

const sessionFor = (
  token: string,
  expiresInMs: number,
  refreshToken: string | null = `r-${token}`,
): Session => ({
  accessToken: token,
  refreshToken,
  expiresAt: new Date(T0.getTime() + expiresInMs),
  user: { id: '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a', email: 'ana@example.com' },
});

/** El servicio de identidad y la memoria de mentira, con la hora a la mano. */
function setup(options: { stored?: Session | null } = {}) {
  let now = T0;
  const clock: Clock = { now: () => now };
  let held: Session | null = options.stored ?? null;
  const listeners = new Set<() => void>();
  const changes: (string | null)[] = [];
  const store: SessionStore = {
    get: () => held,
    set: (session) => {
      held = session;
      changes.push(session.accessToken);
      listeners.forEach((l) => l());
    },
    clear: () => {
      held = null;
      changes.push(null);
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const calls: string[] = [];
  const plan = {
    signIn: sessionFor('in', HOUR) as Session | AuthFailureKind,
    signUp: sessionFor('up', HOUR) as Session | null | AuthFailureKind,
    refresh: sessionFor('renovado', HOUR) as Session | AuthFailureKind,
    signOut: 'ok' as 'ok' | AuthFailureKind,
  };
  let refreshGate: Promise<void> | null = null;
  const identity: IdentityService = {
    signIn: (email, password) => {
      calls.push(`signIn ${email} ${password}`);
      return typeof plan.signIn === 'string'
        ? Promise.reject(new AuthError(plan.signIn))
        : Promise.resolve(plan.signIn);
    },
    signUp: (email, password) => {
      calls.push(`signUp ${email} ${password}`);
      return typeof plan.signUp === 'string'
        ? Promise.reject(new AuthError(plan.signUp))
        : Promise.resolve(plan.signUp);
    },
    refresh: async (refreshToken) => {
      calls.push(`refresh ${refreshToken}`);
      if (refreshGate) await refreshGate;
      if (typeof plan.refresh === 'string') throw new AuthError(plan.refresh);
      return plan.refresh;
    },
    signOut: (accessToken) => {
      calls.push(`signOut ${accessToken}`);
      return plan.signOut === 'ok'
        ? Promise.resolve()
        : Promise.reject(new AuthError(plan.signOut));
    },
  };
  const manager = new SessionManagerUseCase({ identity, store, clock });
  return {
    manager,
    store,
    calls,
    changes,
    plan,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    gateRefresh: () => {
      let open!: () => void;
      refreshGate = new Promise<void>((resolve) => (open = resolve));
      return open;
    },
  };
}

describe('SessionManagerUseCase', () => {
  describe('signing in', () => {
    it('keeps the session the service gave and hands it back', async () => {
      const { manager, store, calls } = setup();

      const session = await manager.signIn('ana@example.com', 'S3cretoLargo123');

      expect(session.accessToken).toBe('in');
      expect(store.get()).toBe(session);
      expect(manager.current()).toBe(session);
      expect(calls).toEqual(['signIn ana@example.com S3cretoLargo123']);
    });

    it('keeps nothing when the service refuses, and says why', async () => {
      const { manager, store, plan } = setup();
      plan.signIn = 'invalid-credentials';

      await expect(manager.signIn('ana@example.com', 'mal')).rejects.toMatchObject({
        kind: 'invalid-credentials',
      });
      expect(store.get()).toBeNull();
    });

    it('replaces a session that was already there', async () => {
      const { manager } = setup({ stored: sessionFor('viejo', HOUR) });

      await manager.signIn('ana@example.com', 'x');

      expect(manager.current()?.accessToken).toBe('in');
    });
  });

  describe('signing up', () => {
    it('keeps the session when the service gives one', async () => {
      const { manager } = setup();

      const session = await manager.signUp('ana@example.com', 'S3cretoLargo123');

      expect(session?.accessToken).toBe('up');
      expect(manager.current()?.accessToken).toBe('up');
    });

    it('keeps nothing when the service asks to confirm the email first', async () => {
      const { manager, plan } = setup();
      plan.signUp = null;

      await expect(manager.signUp('ana@example.com', 'x')).resolves.toBeNull();
      expect(manager.current()).toBeNull();
    });

    it('keeps nothing when the service refuses', async () => {
      const { manager, plan } = setup();
      plan.signUp = 'email-taken';

      await expect(manager.signUp('ana@example.com', 'x')).rejects.toMatchObject({
        kind: 'email-taken',
      });
      expect(manager.current()).toBeNull();
    });
  });

  describe('signing out', () => {
    it('closes the session on the server and forgets it', async () => {
      const { manager, calls } = setup({ stored: sessionFor('abierto', HOUR) });

      await manager.signOut();

      expect(calls).toEqual(['signOut abierto']);
      expect(manager.current()).toBeNull();
    });

    it('forgets it even when the server does not answer: leaving must always work', async () => {
      const { manager, plan } = setup({ stored: sessionFor('abierto', HOUR) });
      plan.signOut = 'network';

      await expect(manager.signOut()).resolves.toBeUndefined();
      expect(manager.current()).toBeNull();
    });

    it('does nothing when there is no session', async () => {
      const { manager, calls, changes } = setup();

      await manager.signOut();

      expect(calls).toEqual([]);
      expect(changes).toEqual([]);
    });
  });

  describe('the access token', () => {
    it('is null without a session', async () => {
      const { manager, calls } = setup();

      await expect(manager.accessToken()).resolves.toBeNull();
      expect(calls).toEqual([]);
    });

    it('is the current one while it has time left', async () => {
      const { manager, calls } = setup({ stored: sessionFor('vigente', HOUR) });

      await expect(manager.accessToken()).resolves.toBe('vigente');
      expect(calls).toEqual([]);
    });

    it('asks for a new one when it is about to expire, and keeps it', async () => {
      const { manager, calls } = setup({ stored: sessionFor('por-vencer', 30_000) });

      await expect(manager.accessToken()).resolves.toBe('renovado');
      expect(calls).toEqual(['refresh r-por-vencer']);
      expect(manager.current()?.accessToken).toBe('renovado');
    });

    it('asks for a new one once it expired', async () => {
      const { manager, advance } = setup({ stored: sessionFor('vencido', 10_000) });
      advance(20_000);

      await expect(manager.accessToken()).resolves.toBe('renovado');
    });

    it('shares ONE renewal between all the callers that arrive while it runs', async () => {
      const { manager, calls, gateRefresh } = setup({ stored: sessionFor('por-vencer', 1_000) });
      const open = gateRefresh();

      const pending = Promise.all([
        manager.accessToken(),
        manager.accessToken(),
        manager.accessToken(),
      ]);
      open();

      await expect(pending).resolves.toEqual(['renovado', 'renovado', 'renovado']);
      expect(calls).toEqual(['refresh r-por-vencer']);
    });

    it('renews again later, once the new one is about to expire too', async () => {
      const { manager, calls, plan, advance } = setup({ stored: sessionFor('uno', 1_000) });
      await manager.accessToken();
      plan.refresh = sessionFor('dos', HOUR);
      advance(HOUR);

      await expect(manager.accessToken()).resolves.toBe('dos');
      expect(calls).toEqual(['refresh r-uno', 'refresh r-renovado']);
    });

    it('forgets the session when the service rejects the renewal token: there is no way back but the password', async () => {
      const { manager, plan } = setup({ stored: sessionFor('por-vencer', 1_000) });
      plan.refresh = 'invalid-credentials';

      await expect(manager.accessToken()).resolves.toBeNull();
      expect(manager.current()).toBeNull();
    });

    it('forgets the session for any failure that is not the network, the service or the rate limit', async () => {
      const { manager, plan } = setup({ stored: sessionFor('por-vencer', 1_000) });
      plan.refresh = 'unknown';

      await expect(manager.accessToken()).resolves.toBeNull();
      expect(manager.current()).toBeNull();
    });

    it.each(['network', 'unavailable', 'rate-limited'] as const)(
      'keeps the session when the renewal fails with %s, and still serves a token that has not expired',
      async (kind) => {
        const { manager, plan } = setup({ stored: sessionFor('por-vencer', 30_000) });
        plan.refresh = kind;

        await expect(manager.accessToken()).resolves.toBe('por-vencer');
        expect(manager.current()?.accessToken).toBe('por-vencer');
      },
    );

    it.each(['network', 'unavailable', 'rate-limited'] as const)(
      'keeps the session but serves no token when the renewal fails with %s and it already expired',
      async (kind) => {
        const { manager, plan, advance } = setup({ stored: sessionFor('vencido', 10_000) });
        advance(20_000);
        plan.refresh = kind;

        await expect(manager.accessToken()).resolves.toBeNull();
        expect(manager.current()?.accessToken).toBe('vencido');
      },
    );

    it('serves a token that has not expired yet, and forgets one that has, when there is nothing to renew with', async () => {
      const live = setup({ stored: sessionFor('sin-renovacion', 30_000, null) });
      await expect(live.manager.accessToken()).resolves.toBe('sin-renovacion');
      expect(live.calls).toEqual([]);

      const dead = setup({ stored: sessionFor('sin-renovacion', 10_000, null) });
      dead.advance(20_000);
      await expect(dead.manager.accessToken()).resolves.toBeNull();
      expect(dead.manager.current()).toBeNull();
    });

    it('can renew again after a renewal failed: a failure does not leave the shared renewal stuck', async () => {
      const { manager, plan, calls } = setup({ stored: sessionFor('por-vencer', 30_000) });
      plan.refresh = 'network';
      await manager.accessToken();
      plan.refresh = sessionFor('renovado', HOUR);

      await expect(manager.accessToken()).resolves.toBe('renovado');
      expect(calls).toEqual(['refresh r-por-vencer', 'refresh r-por-vencer']);
    });
  });

  describe('a renewal that finishes after the person left', () => {
    it('does not bring the session back', async () => {
      const { manager, gateRefresh } = setup({ stored: sessionFor('por-vencer', 1_000) });
      const open = gateRefresh();

      const pending = manager.accessToken();
      await manager.signOut();
      open();

      await expect(pending).resolves.toBeNull();
      expect(manager.current()).toBeNull();
    });

    it('does not step on a session that began meanwhile', async () => {
      const { manager, gateRefresh } = setup({ stored: sessionFor('por-vencer', 1_000) });
      const open = gateRefresh();

      const pending = manager.accessToken();
      await manager.signIn('otra@example.com', 'x');
      open();

      await expect(pending).resolves.toBeNull();
      expect(manager.current()?.accessToken).toBe('in');
    });
  });

  describe('listening', () => {
    it('tells about every change of session, and stops when asked', async () => {
      const { manager } = setup();
      let heard = 0;
      const stop = manager.subscribe(() => {
        heard += 1;
      });

      await manager.signIn('ana@example.com', 'x');
      await manager.signOut();
      stop();
      await manager.signIn('ana@example.com', 'x');

      expect(heard).toBe(2);
    });
  });
});
