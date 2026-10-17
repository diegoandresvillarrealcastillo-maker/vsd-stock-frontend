import { describe, expect, it } from 'vitest';
import { parseMe } from './me';

const ID = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';
const BUSINESS = '22222222-2222-4222-8222-222222222222';
const USER = '11111111-1111-4111-8111-111111111111';

const full = {
  identity: { id: ID, email: 'ana@example.com' },
  membership: {
    userId: USER,
    businessId: BUSINESS,
    businessName: 'Tienda La Esquina',
    role: 'admin',
    fullName: 'Ana Gómez',
  },
};

describe('parseMe', () => {
  it('reads a person who works in a business', () => {
    expect(parseMe(full)).toEqual(full);
  });

  it('reads a person who signed in and has no business yet', () => {
    const lone = { identity: { id: ID, email: null }, membership: null };

    expect(parseMe(lone)).toEqual(lone);
  });

  it('ignores what it does not know', () => {
    expect(parseMe({ ...full, extra: 1 })).toEqual(full);
  });

  it.each(['owner', 'admin', 'cashier'])('accepts the role %s', (role) => {
    const me = parseMe({ ...full, membership: { ...full.membership, role } });

    expect(me?.membership?.role).toBe(role);
  });

  it.each([
    ['not an object', 'hola'],
    ['null', null],
    ['an array', []],
    ['no identity', { membership: null }],
    ['an identity without id', { identity: { email: null }, membership: null }],
    [
      'an email that is neither text nor null',
      { identity: { id: ID, email: 5 }, membership: null },
    ],
    ['no membership key', { identity: { id: ID, email: null } }],
    ['a membership that is not an object', { identity: { id: ID, email: null }, membership: 'x' }],
    [
      'a role the client does not know',
      { ...full, membership: { ...full.membership, role: 'rey' } },
    ],
    [
      'an inherited role name',
      { ...full, membership: { ...full.membership, role: 'constructor' } },
    ],
    [
      'a membership without business name',
      { ...full, membership: { ...full.membership, businessName: undefined } },
    ],
    ['a membership without user id', { ...full, membership: { ...full.membership, userId: 7 } }],
  ])('refuses %s, because the server said something that is not the contract', (_name, body) => {
    expect(parseMe(body)).toBeNull();
  });
});
