import { describe, expect, it } from 'vitest';
import type { Me } from './me';
import {
  CLOCK_TOLERANCE_MS,
  COUNTER_RESUME_WINDOW_MS,
  counterAccess,
  parseProfile,
  profileOf,
  type LocalProfile,
} from './local-profile';

const VERIFIED = new Date('2026-10-19T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

const profile: LocalProfile = {
  authUserId: '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a',
  email: 'ana@ejemplo.co',
  userId: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  businessName: 'Tienda La Esquina',
  role: 'cashier',
  fullName: 'Ana Gómez',
  verifiedAt: VERIFIED.toISOString(),
};

const me: Me = {
  identity: { id: profile.authUserId, email: profile.email },
  membership: {
    userId: profile.userId,
    businessId: profile.businessId,
    businessName: profile.businessName,
    role: 'cashier',
    fullName: profile.fullName,
  },
};

describe('the window in which the counter can be resumed without a connection', () => {
  it('is seventy-two hours, the same limit after which an operation is called stale (ADR 0022 and 0016)', () => {
    expect(COUNTER_RESUME_WINDOW_MS).toBe(72 * HOUR);
  });

  it('is open right after the last verification, with all the time left', () => {
    expect(counterAccess(profile, VERIFIED)).toEqual({
      state: 'open',
      remainingMs: COUNTER_RESUME_WINDOW_MS,
    });
  });

  it('is open with less time left as the hours pass', () => {
    const later = new Date(VERIFIED.getTime() + 30 * HOUR);

    expect(counterAccess(profile, later)).toEqual({ state: 'open', remainingMs: 42 * HOUR });
  });

  it('is still open one millisecond before the seventy-two hours', () => {
    const almost = new Date(VERIFIED.getTime() + COUNTER_RESUME_WINDOW_MS - 1);

    expect(counterAccess(profile, almost)).toEqual({ state: 'open', remainingMs: 1 });
  });

  it('locks at the seventy-two hours and stays locked', () => {
    const exactly = new Date(VERIFIED.getTime() + COUNTER_RESUME_WINDOW_MS);
    const later = new Date(VERIFIED.getTime() + COUNTER_RESUME_WINDOW_MS + 5 * HOUR);

    expect(counterAccess(profile, exactly)).toEqual({ state: 'locked', reason: 'expired' });
    expect(counterAccess(profile, later)).toEqual({ state: 'locked', reason: 'expired' });
  });

  it('forgives a clock that is a few minutes behind the verification, because clocks drift', () => {
    const slightlyBefore = new Date(VERIFIED.getTime() - CLOCK_TOLERANCE_MS);

    expect(counterAccess(profile, slightlyBefore)).toEqual({
      state: 'open',
      remainingMs: COUNTER_RESUME_WINDOW_MS,
    });
  });

  it('does not trust a verification from the future: the clock was set back to stretch the window', () => {
    const before = new Date(VERIFIED.getTime() - CLOCK_TOLERANCE_MS - 1);

    expect(counterAccess(profile, before)).toEqual({ state: 'locked', reason: 'clock-behind' });
  });

  it('is locked when the verification is not a date it can read', () => {
    expect(counterAccess({ ...profile, verifiedAt: 'ayer' }, VERIFIED)).toEqual({
      state: 'locked',
      reason: 'unreadable',
    });
  });
});

describe('the profile kept for the counter', () => {
  it('is made of who the person is, where they work, with what role and when the server last confirmed it', () => {
    expect(profileOf(me, VERIFIED)).toEqual(profile);
  });

  it('does not exist for someone without a business: there is no counter for them', () => {
    expect(profileOf({ ...me, membership: null }, VERIFIED)).toBeNull();
  });

  it('keeps a person without an email', () => {
    expect(
      profileOf({ ...me, identity: { id: me.identity.id, email: null } }, VERIFIED)?.email,
    ).toBeNull();
  });
});

describe('reading a profile back from what was stored', () => {
  it('reads what was written', () => {
    expect(parseProfile(JSON.parse(JSON.stringify(profile)))).toEqual(profile);
  });

  it('never throws and gives nothing for what is not a profile, because stored data is not to be trusted either', () => {
    for (const broken of [
      null,
      undefined,
      'texto',
      42,
      [],
      {},
      { ...profile, role: 'superuser' },
      { ...profile, authUserId: 7 },
      { ...profile, email: 5 },
      { ...profile, verifiedAt: undefined },
      { ...profile, businessName: null },
      { ...profile, fullName: undefined },
      { ...profile, userId: undefined },
      { ...profile, businessId: undefined },
    ]) {
      expect(parseProfile(broken)).toBeNull();
    }
  });

  it('drops anything extra it did not ask for', () => {
    expect(parseProfile({ ...profile, password: 'secreto' })).toEqual(profile);
  });
});
