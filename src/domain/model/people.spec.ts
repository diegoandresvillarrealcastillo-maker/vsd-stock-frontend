import { describe, expect, it } from 'vitest';
import {
  activeOwners,
  invitableRoles,
  parseInvitation,
  parsePerson,
  parsePersonPage,
  roleLabel,
  type Person,
} from './people';

const wire = (overrides: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Ana Gómez',
  email: 'ana@example.com',
  role: 'owner',
  status: 'active',
  invitationExpiresAt: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  ...overrides,
});

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 'p',
  fullName: 'Ana',
  email: null,
  role: 'cashier',
  status: 'active',
  invitationExpiresAt: null,
  createdAt: new Date(0),
  ...overrides,
});

describe('reading a person', () => {
  it('reads what the API sends', () => {
    expect(parsePerson(wire())).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      fullName: 'Ana Gómez',
      email: 'ana@example.com',
      role: 'owner',
      status: 'active',
      invitationExpiresAt: null,
      createdAt: new Date('2026-10-17T12:00:00.000Z'),
    });
  });

  it('reads the moment an invitation expires, and a person with no email', () => {
    const read = parsePerson(
      wire({ email: null, status: 'pending', invitationExpiresAt: '2026-10-24T12:00:00.000Z' }),
    );

    expect(read?.email).toBeNull();
    expect(read?.invitationExpiresAt).toEqual(new Date('2026-10-24T12:00:00.000Z'));
  });

  it.each([
    ['not an object', 'texto'],
    ['null', null],
    ['an array', []],
    ['no id', wire({ id: undefined })],
    ['a numeric id', wire({ id: 5 })],
    ['no name', wire({ fullName: undefined })],
    ['an email that is a number', wire({ email: 5 })],
    ['a role this client does not know', wire({ role: 'superadmin' })],
    ['a status this client does not know', wire({ status: 'dormida' })],
    ['an invitation date that is not a date', wire({ invitationExpiresAt: 'pronto' })],
    ['a creation date that is not a date', wire({ createdAt: 'ayer' })],
    ['no creation date', wire({ createdAt: undefined })],
  ])('refuses %s: what the network brings is not to be trusted', (_name, body) => {
    expect(parsePerson(body)).toBeNull();
  });
});

describe('reading a page of people', () => {
  it('reads the people and where the next page starts', () => {
    const page = parsePersonPage({
      items: [wire(), wire({ id: 'x'.repeat(8) })],
      nextCursor: 'abc',
    });

    expect(page?.items).toHaveLength(2);
    expect(page?.nextCursor).toBe('abc');
  });

  it('reads the last page', () => {
    expect(parsePersonPage({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it.each([
    ['no items', { nextCursor: null }],
    ['items that is not a list', { items: 'x', nextCursor: null }],
    ['a person that is not valid', { items: [wire(), { id: 5 }], nextCursor: null }],
    ['a cursor that is a number', { items: [], nextCursor: 5 }],
    ['no cursor', { items: [] }],
    ['not an object', null],
  ])('refuses %s', (_name, body) => {
    expect(parsePersonPage(body)).toBeNull();
  });
});

describe('reading an invitation', () => {
  const invitation = (overrides: Record<string, unknown> = {}) => ({
    person: wire({ status: 'pending', role: 'cashier' }),
    invitation: { code: 'ABCD-EFGH-JKMN-PQRS', expiresAt: '2026-10-24T12:00:00.000Z' },
    ...overrides,
  });

  it('reads the person and the code, which is shown only once', () => {
    const read = parseInvitation(invitation());

    expect(read?.code).toBe('ABCD-EFGH-JKMN-PQRS');
    expect(read?.expiresAt).toEqual(new Date('2026-10-24T12:00:00.000Z'));
    expect(read?.person.status).toBe('pending');
  });

  it.each([
    ['no code', invitation({ invitation: { expiresAt: '2026-10-24T12:00:00.000Z' } })],
    [
      'an empty code',
      invitation({ invitation: { code: '', expiresAt: '2026-10-24T12:00:00.000Z' } }),
    ],
    [
      'a code that is a number',
      invitation({ invitation: { code: 5, expiresAt: '2026-10-24T12:00:00.000Z' } }),
    ],
    ['no expiry', invitation({ invitation: { code: 'ABCD' } })],
    ['an expiry that is not a date', invitation({ invitation: { code: 'ABCD', expiresAt: 'x' } })],
    ['a person that is not valid', invitation({ person: { id: 5 } })],
    ['no invitation', { person: wire() }],
    ['not an object', 'x'],
  ])('refuses %s', (_name, body) => {
    expect(parseInvitation(body)).toBeNull();
  });
});

describe('what a role is called', () => {
  it.each([
    ['owner', 'Dueño'],
    ['admin', 'Administrador'],
    ['cashier', 'Cajero'],
  ] as const)('calls %s «%s»', (role, label) => {
    expect(roleLabel(role)).toBe(label);
  });
});

describe('who can be invited by whom (ADR 0017)', () => {
  it('lets an owner invite administrators and cashiers', () => {
    expect(invitableRoles('owner')).toEqual(['admin', 'cashier']);
  });

  it('lets an administrator invite only cashiers', () => {
    expect(invitableRoles('admin')).toEqual(['cashier']);
  });

  it('lets a cashier invite no one', () => {
    expect(invitableRoles('cashier')).toEqual([]);
  });
});

describe('the owners of a business', () => {
  it('counts only the owners who are active', () => {
    const people = [
      person({ id: 'a', role: 'owner' }),
      person({ id: 'b', role: 'owner', status: 'inactive' }),
      person({ id: 'c', role: 'owner', status: 'pending' }),
      person({ id: 'd', role: 'admin' }),
    ];

    expect(activeOwners(people).map((p) => p.id)).toEqual(['a']);
  });

  it('is empty when there is none', () => {
    expect(activeOwners([person()])).toEqual([]);
  });
});
