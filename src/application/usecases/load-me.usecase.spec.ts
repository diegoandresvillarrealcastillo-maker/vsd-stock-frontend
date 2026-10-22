// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { ApiGateway, ApiRequest, ApiResponse } from '../../domain/ports/out/api-gateway';
import { LoadMeUseCase } from './load-me.usecase';

const ID = '9b2f6c1e-0d5a-4c1b-8f3e-2a7d6e5c4b3a';

const member = {
  identity: { id: ID, email: 'ana@example.com' },
  membership: {
    userId: '11111111-1111-4111-8111-111111111111',
    businessId: '22222222-2222-4222-8222-222222222222',
    businessName: 'Tienda La Esquina',
    role: 'owner',
    fullName: 'Ana Gómez',
  },
};

function gatewayAnswering(answer: object | string | null | Error) {
  const sent: ApiRequest[] = [];
  const gateway: ApiGateway = {
    send: <T>(request: ApiRequest): Promise<ApiResponse<T>> => {
      sent.push(request);
      return answer instanceof Error
        ? Promise.reject(answer)
        : Promise.resolve({ status: 200, body: answer as T, replayed: false });
    },
  };
  return { gateway, sent };
}

describe('LoadMeUseCase', () => {
  it('asks who the person is and where they work', async () => {
    const { gateway, sent } = gatewayAnswering(member);

    const me = await new LoadMeUseCase(gateway).execute();

    expect(sent).toEqual([{ method: 'GET', path: '/v1/me' }]);
    expect(me).toEqual(member);
  });

  it('hands back a person with no business as such, which is a normal step and not an error', async () => {
    const { gateway } = gatewayAnswering({ identity: { id: ID, email: null }, membership: null });

    const me = await new LoadMeUseCase(gateway).execute();

    expect(me.membership).toBeNull();
  });

  it('lets the failure of the API through, with its class', async () => {
    const failure = new ApiError({
      class: 'session',
      status: 401,
      problem: null,
      retryAfterMs: null,
    });
    const { gateway } = gatewayAnswering(failure);

    await expect(new LoadMeUseCase(gateway).execute()).rejects.toBe(failure);
  });

  it('refuses an answer that is not the contract, as a transient failure: it is not our server', async () => {
    const { gateway } = gatewayAnswering({ hola: 'mundo' });

    const error = await new LoadMeUseCase(gateway).execute().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure).toEqual({
      class: 'transient',
      status: 200,
      problem: null,
      retryAfterMs: null,
    });
  });

  it('refuses a role this client does not know, instead of giving the person the wrong menu', async () => {
    const { gateway } = gatewayAnswering({
      ...member,
      membership: { ...member.membership, role: 'rey' },
    });

    await expect(new LoadMeUseCase(gateway).execute()).rejects.toBeInstanceOf(ApiError);
  });
});
