import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { createTestAuth, testSession } from '../../../test/support/auth';
import { createFakePeople } from '../../../test/support/people';
import { renderScreen } from '../../../test/support/screens';
import { RedeemPage } from './RedeemPage';

const lone = { identity: { id: 'ana', email: 'ana@example.com' }, membership: null };

function setup() {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(lone, lone);
  const people = createFakePeople();
  const view = renderScreen(<RedeemPage />, { path: '/invitacion', auth, people });
  return { ...view, auth, people };
}

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('Código de invitación'), { target: { value } });
const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Unirme' }));
    await Promise.resolve();
  });
};

const failure = (code: string, status = 404) =>
  new ApiError({
    class: status === 409 ? 'conflict' : 'permanent',
    status,
    retryAfterMs: null,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status,
      detail: 'd',
      instance: '/v1/invitations/redeem',
      code,
      traceId: 'x',
    },
  });

describe('RedeemPage', () => {
  it('asks for the code and says how it is written and that it is used once', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Unirme a un negocio' })).toBeDefined();
    expect(screen.getByText(/Cada código sirve una sola vez/)).toBeDefined();
    expect(screen.getByText('Son 16 letras y números, en grupos de cuatro.')).toBeDefined();
  });

  it('writes the code as the person says it, in capitals, and does not let the keyboard correct it', () => {
    setup();

    const field = screen.getByLabelText<HTMLInputElement>('Código de invitación');
    expect(field.autocomplete).toBe('off');
    expect(field.getAttribute('autocapitalize')).toBe('characters');
    expect(field.getAttribute('spellcheck')).toBe('false');
  });

  it('offers to open a business of their own instead', () => {
    setup();

    expect(screen.getByRole('link', { name: 'Crear uno' }).getAttribute('href')).toBe('/empezar');
  });

  it('asks for the code when it is missing and sends nothing', async () => {
    const { people } = setup();

    await submit();

    expect(screen.getByText('Escribe el código que te dieron.')).toBeDefined();
    expect(people.redeemInvitation).not.toHaveBeenCalled();
  });

  it('redeems the code and asks again who the person is, so the application opens', async () => {
    const { people, auth } = setup();
    await screen.findByLabelText('Código de invitación');
    type('abcd-efgh-jkmn-pqrs');

    await submit();

    expect(people.redeemInvitation).toHaveBeenCalledWith('abcd-efgh-jkmn-pqrs');
    expect(auth.loads).toEqual(['ana', 'ana']);
  });

  it.each([
    ['invitation-not-found', 'Ese código no existe o ya se usó. Revísalo o pide uno nuevo.'],
    ['invitation-expired', 'Ese código venció. Pídele uno nuevo a quien te invitó.'],
  ])('says %s under the code, where the person can fix it', async (code, words) => {
    const { people } = setup();
    people.redeemInvitation.mockRejectedValueOnce(
      failure(code, code === 'invitation-expired' ? 410 : 404),
    );
    type('abcd-efgh-jkmn-pqrs');

    await submit();

    expect(screen.getByText(words, { selector: 'p[id]' })).toBeDefined();
    expect(screen.getByLabelText('Código de invitación').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('says a person already works in a business, without marking the code', async () => {
    const { people } = setup();
    people.redeemInvitation.mockRejectedValueOnce(failure('already-member', 409));
    type('abcd-efgh-jkmn-pqrs');

    await submit();

    expect(screen.getByRole('alert').textContent).toContain(
      'Esa persona ya trabaja en un negocio.',
    );
    expect(screen.getByLabelText('Código de invitación').getAttribute('aria-invalid')).toBeNull();
  });

  it('does not ask again who the person is when the code did not work', async () => {
    const { people, auth } = setup();
    people.redeemInvitation.mockRejectedValueOnce(failure('invitation-not-found'));
    type('abcd');

    await submit();

    expect(auth.loads).toEqual(['ana']);
  });
});
