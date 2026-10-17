import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { ApiGateway, ApiRequest, ApiResponse } from '../../domain/ports/out/api-gateway';
import { BusinessPeopleUseCase } from './business-people.usecase';

const wirePerson = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  fullName: `Persona ${id}`,
  email: null,
  role: 'cashier',
  status: 'active',
  invitationExpiresAt: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  ...overrides,
});

const wireInvitation = (id = 'p1') => ({
  person: wirePerson(id, { status: 'pending' }),
  invitation: { code: 'ABCD-EFGH-JKMN-PQRS', expiresAt: '2026-10-24T12:00:00.000Z' },
});

const membership = {
  userId: 'u1',
  businessId: 'b1',
  businessName: 'Tienda',
  role: 'owner',
  fullName: 'Ana',
};

/** Una API de mentira: responde lo que se prepare, en orden, y anota lo que se le pidio. */
function setup(...answers: (object | string | null | Error)[]) {
  const sent: ApiRequest[] = [];
  const queue = [...answers];
  const api: ApiGateway = {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      const next = queue.shift();
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve({ status: 200, body: next as T, replayed: false });
    },
  };
  return { sent, useCase: new BusinessPeopleUseCase(api) };
}

const failedWith = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('BusinessPeopleUseCase', () => {
  describe('creating a business', () => {
    it('sends the names of the business and of its owner, trimmed', async () => {
      const { sent, useCase } = setup(membership);

      await useCase.createBusiness({
        businessName: '  Tienda La Esquina ',
        ownerName: ' Ana Gómez ',
      });

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/businesses',
          body: { businessName: 'Tienda La Esquina', ownerName: 'Ana Gómez' },
        },
      ]);
    });

    it('does not believe an answer that is not what the contract says', async () => {
      const { useCase } = setup({ algo: 'raro' });

      const error = await failedWith(useCase.createBusiness({ businessName: 'T', ownerName: 'A' }));

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).failure.class).toBe('transient');
    });

    it('lets a failure of the API through, as it is', async () => {
      const failure = new ApiError({
        class: 'conflict',
        status: 409,
        problem: null,
        retryAfterMs: null,
      });
      const { useCase } = setup(failure);

      await expect(useCase.createBusiness({ businessName: 'T', ownerName: 'A' })).rejects.toBe(
        failure,
      );
    });
  });

  describe('redeeming an invitation', () => {
    it('sends the code the person typed, without the spaces around it', async () => {
      const { sent, useCase } = setup(membership);

      await useCase.redeemInvitation('  abcd-efgh-jkmn-pqrs ');

      expect(sent).toEqual([
        { method: 'POST', path: '/v1/invitations/redeem', body: { code: 'abcd-efgh-jkmn-pqrs' } },
      ]);
    });

    it('does not believe an answer that is not what the contract says', async () => {
      const { useCase } = setup(null);

      const error = await failedWith(useCase.redeemInvitation('ABCD'));

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('listing people', () => {
    it('asks for a page and reads it', async () => {
      const { sent, useCase } = setup({
        items: [wirePerson('a'), wirePerson('b')],
        nextCursor: 'siguiente',
      });

      const page = await useCase.listPeople();

      expect(sent).toEqual([{ method: 'GET', path: '/v1/users', query: { limit: 50 } }]);
      expect(page.items.map((p) => p.id)).toEqual(['a', 'b']);
      expect(page.nextCursor).toBe('siguiente');
    });

    it('follows the cursor it was given', async () => {
      const { sent, useCase } = setup({ items: [], nextCursor: null });

      await useCase.listPeople('abc');

      expect(sent[0]?.query).toEqual({ limit: 50, cursor: 'abc' });
    });

    it('does not believe a page that is not what the contract says', async () => {
      const { useCase } = setup({ items: [{ id: 5 }], nextCursor: null });

      const error = await failedWith(useCase.listPeople());

      expect((error as ApiError).failure.class).toBe('transient');
    });

    it('reads every page of the business when asked for everyone', async () => {
      const { sent, useCase } = setup(
        { items: [wirePerson('a')], nextCursor: 'c1' },
        { items: [wirePerson('b')], nextCursor: 'c2' },
        { items: [wirePerson('c')], nextCursor: null },
      );

      const everyone = await useCase.listEveryone();

      expect(everyone.map((p) => p.id)).toEqual(['a', 'b', 'c']);
      expect(sent.map((r) => r.query)).toEqual([
        { limit: 200 },
        { limit: 200, cursor: 'c1' },
        { limit: 200, cursor: 'c2' },
      ]);
    });

    it('stops after a few pages instead of asking forever of a server that never ends', async () => {
      const pages = Array.from({ length: 30 }, () => ({
        items: [wirePerson('a')],
        nextCursor: 'otra',
      }));
      const { sent, useCase } = setup(...pages);

      const everyone = await useCase.listEveryone();

      expect(sent).toHaveLength(10);
      expect(everyone).toHaveLength(10);
    });
  });

  describe('inviting', () => {
    it('sends the name and the role, and the email only when there is one', async () => {
      const { sent, useCase } = setup(wireInvitation(), wireInvitation());

      await useCase.invite({ fullName: ' Daniel Mora ', role: 'cashier', email: '  ' });
      await useCase.invite({ fullName: 'Eva', role: 'admin', email: ' EVA@Ejemplo.co ' });

      expect(sent).toEqual([
        {
          method: 'POST',
          path: '/v1/invitations',
          body: { fullName: 'Daniel Mora', role: 'cashier' },
        },
        {
          method: 'POST',
          path: '/v1/invitations',
          body: { fullName: 'Eva', role: 'admin', email: 'EVA@Ejemplo.co' },
        },
      ]);
    });

    it('hands back the code and when it expires', async () => {
      const { useCase } = setup(wireInvitation('nueva'));

      const invitation = await useCase.invite({ fullName: 'Daniel', role: 'cashier' });

      expect(invitation.code).toBe('ABCD-EFGH-JKMN-PQRS');
      expect(invitation.person.id).toBe('nueva');
    });

    it('does not believe an answer without a code', async () => {
      const { useCase } = setup({ person: wirePerson('x'), invitation: {} });

      const error = await failedWith(useCase.invite({ fullName: 'D', role: 'cashier' }));

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('changing a person', () => {
    it('sends only what changed', async () => {
      const { sent, useCase } = setup(wirePerson('p1'), wirePerson('p1'), wirePerson('p1'));

      await useCase.updatePerson('p1', { fullName: ' Nuevo ' });
      await useCase.updatePerson('p1', { role: 'admin' });
      await useCase.updatePerson('p1', { active: false });

      expect(sent.map((r) => [r.method, r.path, r.body])).toEqual([
        ['PATCH', '/v1/users/p1', { fullName: 'Nuevo' }],
        ['PATCH', '/v1/users/p1', { role: 'admin' }],
        ['PATCH', '/v1/users/p1', { active: false }],
      ]);
    });

    it('sends the identifier of the person as a path, never as something that could escape it', async () => {
      const { sent, useCase } = setup(wirePerson('x'));

      await useCase.updatePerson('a/b?c', { active: true });

      expect(sent[0]?.path).toBe('/v1/users/a%2Fb%3Fc');
    });

    it('hands back the person as the server left them', async () => {
      const { useCase } = setup(wirePerson('p1', { status: 'inactive' }));

      const person = await useCase.updatePerson('p1', { active: false });

      expect(person.status).toBe('inactive');
    });

    it('does not believe an answer that is not what the contract says', async () => {
      const { useCase } = setup({ id: 5 });

      const error = await failedWith(useCase.updatePerson('p1', { active: false }));

      expect((error as ApiError).failure.class).toBe('transient');
    });
  });

  describe('renewing an invitation', () => {
    it('asks for a new code for a person with an invitation pending', async () => {
      const { sent, useCase } = setup(wireInvitation('p9'));

      const invitation = await useCase.renewInvitation('p9');

      expect(sent).toEqual([{ method: 'POST', path: '/v1/users/p9/invitation' }]);
      expect(invitation.code).toBe('ABCD-EFGH-JKMN-PQRS');
    });
  });
});
