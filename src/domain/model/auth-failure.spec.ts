import { describe, expect, it } from 'vitest';
import { AuthError, authFailureOf } from './auth-failure';

describe('why the identity service said no', () => {
  it.each([
    [
      400,
      { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' },
      'invalid-credentials',
    ],
    [
      422,
      { code: 422, error_code: 'user_already_exists', msg: 'User already registered' },
      'email-taken',
    ],
    [
      422,
      { code: 422, error_code: 'email_exists', msg: 'Email address already registered' },
      'email-taken',
    ],
    [
      422,
      { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' },
      'weak-password',
    ],
    [
      400,
      { code: 400, error_code: 'email_address_invalid', msg: 'Email address is invalid' },
      'invalid-email',
    ],
    [
      400,
      { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' },
      'email-not-confirmed',
    ],
    [
      422,
      { code: 422, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' },
      'signup-disabled',
    ],
    [
      429,
      { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' },
      'rate-limited',
    ],
    [
      429,
      { code: 429, error_code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded' },
      'rate-limited',
    ],
  ])('reads the %i answer %j as %s', (status, body, kind) => {
    expect(authFailureOf(status, body)).toBe(kind);
  });

  it('calls the lack of an answer a network failure', () => {
    expect(authFailureOf(null, undefined)).toBe('network');
  });

  it('calls any 5xx the service being unavailable, whatever it said', () => {
    expect(authFailureOf(500, { error_code: 'invalid_credentials' })).toBe('unavailable');
    expect(authFailureOf(503, 'Service Unavailable')).toBe('unavailable');
    expect(authFailureOf(502, null)).toBe('unavailable');
  });

  it('calls the status 429 a rate limit even when the body says nothing', () => {
    expect(authFailureOf(429, undefined)).toBe('rate-limited');
    expect(authFailureOf(429, 'Too Many Requests')).toBe('rate-limited');
  });

  it.each([
    [400, { error_code: 'algo_nuevo' }],
    [400, {}],
    [400, 'texto'],
    [400, null],
    [400, { error_code: 7 }],
    [403, undefined],
    [418, { error_code: 'toString' }],
  ])('does not guess: the %i answer %j is unknown', (status, body) => {
    expect(authFailureOf(status, body)).toBe('unknown');
  });

  it('does not take an inherited name for a known error code', () => {
    expect(authFailureOf(400, { error_code: 'constructor' })).toBe('unknown');
    expect(authFailureOf(400, { error_code: '__proto__' })).toBe('unknown');
  });
});

describe('AuthError', () => {
  it('carries the kind and says it in its message, without anything the person typed', () => {
    const error = new AuthError('invalid-credentials');

    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe('invalid-credentials');
    expect(error.message).toContain('invalid-credentials');
    expect(error.name).toBe('AuthError');
  });
});
