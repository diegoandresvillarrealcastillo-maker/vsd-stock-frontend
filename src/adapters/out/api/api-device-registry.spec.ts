import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../domain/model/api-error';
import { createFakeApi, reply } from '../../../../test/support/fake-api';
import { ApiDeviceRegistry } from './api-device-registry';

const ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const registered = {
  id: ID,
  code: 'AA',
  name: null,
  enrolledByUserId: '11111111-1111-4111-8111-111111111111',
  enrolledAt: '2026-10-19T12:00:00.000Z',
  revokedAt: null,
};

describe('ApiDeviceRegistry', () => {
  it('registers the device with the identifier it invented and gives back the code the server dealt', async () => {
    const { api, sent } = createFakeApi(reply(registered, 201));

    const device = await new ApiDeviceRegistry(api).register(ID);

    expect(sent).toEqual([{ method: 'POST', path: '/v1/devices', body: { id: ID } }]);
    expect(device).toEqual({ id: ID, code: 'AA' });
  });

  it('gets the same device when the server repeats the answer of a registration it already made', async () => {
    const { api } = createFakeApi(reply(registered, 200, true));

    expect(await new ApiDeviceRegistry(api).register(ID)).toEqual({ id: ID, code: 'AA' });
  });

  it('reads the code as the server writes it, in upper case', async () => {
    const { api } = createFakeApi(reply({ ...registered, code: 'k7' }, 201));

    expect((await new ApiDeviceRegistry(api).register(ID)).code).toBe('K7');
  });

  it.each([
    ['nothing', undefined],
    ['text', 'hola'],
    ['a list', []],
    ['no code', { id: ID }],
    ['no id', { code: 'AA' }],
    ['a code that is not a number', { id: ID, code: 7 }],
    ['a code the server never deals', { id: ID, code: 'A0' }],
    ['a code that is too long', { id: ID, code: 'ABCDE' }],
  ])('does not believe an answer with %s: it is a failure that may pass', async (_name, body) => {
    const { api } = createFakeApi(reply(body, 200));

    const failure = await new ApiDeviceRegistry(api).register(ID).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).failure).toEqual({
      class: 'transient',
      status: 200,
      problem: null,
      retryAfterMs: null,
    });
  });

  it('lets the failure of the API go up as it came', async () => {
    const failure = new ApiError({
      class: 'session',
      status: 401,
      problem: null,
      retryAfterMs: null,
    });
    const { api } = createFakeApi(failure);

    await expect(new ApiDeviceRegistry(api).register(ID)).rejects.toBe(failure);
  });
});
