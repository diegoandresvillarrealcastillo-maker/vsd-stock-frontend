import { vi, type Mock } from 'vitest';
import type { Invitation, Person } from '../../src/domain/model/people';
import type { BusinessPeople } from '../../src/domain/ports/in/business-people';

export function testPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'persona-1',
    fullName: 'Ana Gómez',
    email: 'ana@example.com',
    role: 'owner',
    status: 'active',
    invitationExpiresAt: null,
    createdAt: new Date('2026-10-17T12:00:00.000Z'),
    ...overrides,
  };
}

export function testInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    person: testPerson({
      id: 'invitada',
      fullName: 'Daniel Mora',
      role: 'cashier',
      status: 'pending',
    }),
    code: 'ABCD-EFGH-JKMN-PQRS',
    expiresAt: new Date('2026-10-24T12:00:00.000Z'),
    ...overrides,
  };
}

/** Cada metodo es un doble de Vitest: la prueba prepara lo que contesta y mira con que se le llamo. */
export type FakePeople = { [K in keyof BusinessPeople]: Mock<BusinessPeople[K]> };

/** Un caso de uso de personas de mentira, que por omision contesta bien y con datos de prueba. */
export function createFakePeople(initial: Person[] = [testPerson()]): FakePeople {
  return {
    createBusiness: vi.fn<BusinessPeople['createBusiness']>().mockResolvedValue(undefined),
    redeemInvitation: vi.fn<BusinessPeople['redeemInvitation']>().mockResolvedValue(undefined),
    listPeople: vi
      .fn<BusinessPeople['listPeople']>()
      .mockResolvedValue({ items: initial, nextCursor: null }),
    listEveryone: vi.fn<BusinessPeople['listEveryone']>().mockResolvedValue(initial),
    invite: vi.fn<BusinessPeople['invite']>().mockResolvedValue(testInvitation()),
    updatePerson: vi.fn<BusinessPeople['updatePerson']>().mockImplementation((id, change) =>
      Promise.resolve(
        testPerson({
          ...(initial.find((p) => p.id === id) ?? {}),
          ...(change.fullName === undefined ? {} : { fullName: change.fullName }),
          ...(change.role === undefined ? {} : { role: change.role }),
          ...(change.active === undefined
            ? {}
            : { status: change.active ? ('active' as const) : ('inactive' as const) }),
        }),
      ),
    ),
    renewInvitation: vi.fn<BusinessPeople['renewInvitation']>().mockResolvedValue(testInvitation()),
  };
}
