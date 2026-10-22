import { describe, expect, it } from 'vitest';
import { REFRESH_MARGIN_MS, isExpired, needsRefresh, type Session } from './session';

const NOW = new Date('2026-10-17T12:00:00.000Z');

const sessionExpiringIn = (ms: number): Session => ({
  accessToken: 'token',
  refreshToken: 'refresh',
  expiresAt: new Date(NOW.getTime() + ms),
  user: { id: '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a', email: 'ana@example.com' },
});

describe('when a session needs renewing', () => {
  it('asks for a minute of margin by default, so a request never leaves with a token about to die', () => {
    expect(REFRESH_MARGIN_MS).toBe(60_000);
  });

  it('is fine while it has more than the margin left', () => {
    expect(needsRefresh(sessionExpiringIn(REFRESH_MARGIN_MS + 1), NOW)).toBe(false);
    expect(needsRefresh(sessionExpiringIn(3_600_000), NOW)).toBe(false);
  });

  it('needs renewing at exactly the margin and below it', () => {
    expect(needsRefresh(sessionExpiringIn(REFRESH_MARGIN_MS), NOW)).toBe(true);
    expect(needsRefresh(sessionExpiringIn(1), NOW)).toBe(true);
  });

  it('needs renewing once it has expired', () => {
    expect(needsRefresh(sessionExpiringIn(0), NOW)).toBe(true);
    expect(needsRefresh(sessionExpiringIn(-5_000), NOW)).toBe(true);
  });

  it('takes the margin it is given', () => {
    expect(needsRefresh(sessionExpiringIn(5_000), NOW, 1_000)).toBe(false);
    expect(needsRefresh(sessionExpiringIn(1_000), NOW, 1_000)).toBe(true);
  });
});

describe('when a session has expired', () => {
  it('is expired at the moment of its expiry and after, not before', () => {
    expect(isExpired(sessionExpiringIn(1), NOW)).toBe(false);
    expect(isExpired(sessionExpiringIn(0), NOW)).toBe(true);
    expect(isExpired(sessionExpiringIn(-1), NOW)).toBe(true);
  });
});
