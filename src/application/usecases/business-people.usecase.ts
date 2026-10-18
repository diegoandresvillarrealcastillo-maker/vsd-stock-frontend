import { ApiError } from '../../domain/model/api-error';
import {
  parseInvitation,
  parsePerson,
  parsePersonPage,
  type Invitation,
  type Person,
  type PersonPage,
} from '../../domain/model/people';
import { isRole, type Role } from '../../domain/model/permissions';
import type { BusinessPeople } from '../../domain/ports/in/business-people';
import type { ApiGateway } from '../../domain/ports/out/api-gateway';

/** Cuantas personas se piden por pagina, y cuantas paginas se leen como maximo para «todas» (un negocio de barrio tiene pocas). */
const PAGE_SIZE = 50;
const EVERYONE_PAGE_SIZE = 200;
const MAX_EVERYONE_PAGES = 10;

/** Un 200 que no es el contrato no es nuestro servidor (un proxy, otra version): no se le cree. */
function unexpected(status: number): ApiError {
  return new ApiError({ class: 'transient', status, problem: null, retryAfterMs: null });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** La respuesta de abrir un negocio o canjear una invitacion es el lugar de la persona (`MeMembershipDto`). */
function isMembership(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['userId'] === 'string' &&
    typeof value['businessId'] === 'string' &&
    typeof value['businessName'] === 'string' &&
    typeof value['fullName'] === 'string' &&
    isRole(value['role'])
  );
}

/** Casos de uso de negocio y personas (ADR 0023) sobre la API. */
export class BusinessPeopleUseCase implements BusinessPeople {
  constructor(private readonly api: ApiGateway) {}

  async createBusiness(input: { businessName: string; ownerName: string }): Promise<void> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/businesses',
      body: { businessName: input.businessName.trim(), ownerName: input.ownerName.trim() },
    });
    if (!isMembership(response.body)) throw unexpected(response.status);
  }

  async redeemInvitation(code: string): Promise<void> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/invitations/redeem',
      body: { code: code.trim() },
    });
    if (!isMembership(response.body)) throw unexpected(response.status);
  }

  async listPeople(cursor?: string): Promise<PersonPage> {
    return this.readPage(PAGE_SIZE, cursor);
  }

  async listEveryone(): Promise<Person[]> {
    const everyone: Person[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < MAX_EVERYONE_PAGES; pages += 1) {
      const page = await this.readPage(EVERYONE_PAGE_SIZE, cursor);
      everyone.push(...page.items);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    return everyone;
  }

  async invite(input: {
    fullName: string;
    role: Exclude<Role, 'owner'>;
    email?: string;
  }): Promise<Invitation> {
    const email = input.email?.trim() ?? '';
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: '/v1/invitations',
      body: {
        fullName: input.fullName.trim(),
        role: input.role,
        ...(email === '' ? {} : { email }),
      },
    });
    return this.invitationOf(response.body, response.status);
  }

  async updatePerson(
    personId: string,
    change: { fullName?: string; role?: Role; active?: boolean },
  ): Promise<Person> {
    const response = await this.api.send<unknown>({
      method: 'PATCH',
      path: `/v1/users/${encodeURIComponent(personId)}`,
      body: {
        ...(change.fullName === undefined ? {} : { fullName: change.fullName.trim() }),
        ...(change.role === undefined ? {} : { role: change.role }),
        ...(change.active === undefined ? {} : { active: change.active }),
      },
    });
    const person = parsePerson(response.body);
    if (person === null) throw unexpected(response.status);
    return person;
  }

  async renewInvitation(personId: string): Promise<Invitation> {
    const response = await this.api.send<unknown>({
      method: 'POST',
      path: `/v1/users/${encodeURIComponent(personId)}/invitation`,
    });
    return this.invitationOf(response.body, response.status);
  }

  private async readPage(limit: number, cursor: string | undefined): Promise<PersonPage> {
    const response = await this.api.send<unknown>({
      method: 'GET',
      path: '/v1/users',
      query: { limit, ...(cursor === undefined ? {} : { cursor }) },
    });
    const page = parsePersonPage(response.body);
    if (page === null) throw unexpected(response.status);
    return page;
  }

  private invitationOf(body: unknown, status: number): Invitation {
    const invitation = parseInvitation(body);
    if (invitation === null) throw unexpected(status);
    return invitation;
  }
}
