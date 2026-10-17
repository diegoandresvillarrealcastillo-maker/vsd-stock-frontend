import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { createTestAuth, testSession } from '../../../test/support/auth';
import { createFakePeople } from '../../../test/support/people';
import { renderScreen } from '../../../test/support/screens';
import { OnboardingPage } from './OnboardingPage';

const lone = { identity: { id: 'ana', email: 'ana@example.com' }, membership: null };

function setup() {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(lone, lone);
  const people = createFakePeople();
  const view = renderScreen(<OnboardingPage />, { path: '/empezar', auth, people });
  return { ...view, auth, people };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Crear negocio' }));
    await Promise.resolve();
  });
};

const failure = (code: string, errors?: { pointer: string; code: string; detail: string }[]) =>
  new ApiError({
    class: code === 'already-member' ? 'conflict' : 'permanent',
    status: code === 'already-member' ? 409 : 400,
    retryAfterMs: null,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status: 400,
      detail: 'd',
      instance: '/v1/businesses',
      code,
      traceId: 'x',
      ...(errors === undefined ? {} : { errors }),
    },
  });

describe('OnboardingPage', () => {
  it('asks for the name of the business and the name of its owner, and says what comes next', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Crea tu negocio' })).toBeDefined();
    expect(screen.getByLabelText('Nombre del negocio')).toBeDefined();
    expect(screen.getByLabelText('Tu nombre')).toBeDefined();
    expect(screen.getByText('Así te verán las personas de tu equipo.')).toBeDefined();
  });

  it('offers the other way in: the code of an invitation', async () => {
    setup();

    expect(await screen.findByRole('link', { name: 'Usar mi código' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Usar mi código' }).getAttribute('href')).toBe(
      '/invitacion',
    );
  });

  it('lets the person sign out: someone without a business has nowhere else to go', async () => {
    const { auth } = setup();
    await screen.findByRole('heading', { level: 1, name: 'Crea tu negocio' });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
      await Promise.resolve();
    });

    expect(auth.sessions.current()).toBeNull();
  });

  it('asks for what is missing, naming it, and sends nothing', async () => {
    const { people } = setup();
    await screen.findByLabelText('Tu nombre');

    await submit();

    expect(screen.getByText('Escribe el nombre de tu negocio.')).toBeDefined();
    expect(screen.getByText('Escribe tu nombre.')).toBeDefined();
    expect(people.createBusiness).not.toHaveBeenCalled();
  });

  it('creates the business with both names and asks again who the person is, to enter the application', async () => {
    const { people, auth } = setup();
    await screen.findByLabelText('Tu nombre');
    type('Nombre del negocio', ' Tienda La Esquina ');
    type('Tu nombre', 'Ana Gómez');

    await submit();

    expect(people.createBusiness).toHaveBeenCalledWith({
      businessName: ' Tienda La Esquina ',
      ownerName: 'Ana Gómez',
    });
    expect(auth.loads).toEqual(['ana', 'ana']);
  });

  it('puts each problem the server finds under its own field', async () => {
    const { people } = setup();
    people.createBusiness.mockRejectedValueOnce(
      failure('validation-failed', [
        {
          pointer: '/businessName',
          code: 'too-long',
          detail: 'El nombre no puede pasar de 120 caracteres.',
        },
        { pointer: '/ownerName', code: 'blank', detail: 'El nombre no puede quedar en blanco.' },
      ]),
    );
    await screen.findByLabelText('Tu nombre');
    type('Nombre del negocio', 'x');
    type('Tu nombre', 'y');

    await submit();

    expect(screen.getByText('El nombre no puede pasar de 120 caracteres.')).toBeDefined();
    expect(screen.getByText('El nombre no puede quedar en blanco.')).toBeDefined();
    expect(screen.getByLabelText('Nombre del negocio').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Tu nombre').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Revisa los datos marcados.');
  });

  it('says a person already works in a business, without marking any field', async () => {
    const { people, auth } = setup();
    people.createBusiness.mockRejectedValueOnce(failure('already-member'));
    await screen.findByLabelText('Tu nombre');
    type('Nombre del negocio', 'Tienda');
    type('Tu nombre', 'Ana');

    await submit();

    expect(screen.getByRole('alert').textContent).toContain(
      'Esa persona ya trabaja en un negocio.',
    );
    expect(screen.getByLabelText('Tu nombre').getAttribute('aria-invalid')).toBeNull();
    expect(auth.loads).toEqual(['ana']);
  });

  it('does not ask who the person is again when the business could not be created', async () => {
    const { people, auth } = setup();
    people.createBusiness.mockRejectedValueOnce(failure('validation-failed'));
    await screen.findByLabelText('Tu nombre');
    type('Nombre del negocio', 'Tienda');
    type('Tu nombre', 'Ana');

    await submit();

    expect(auth.loads).toEqual(['ana']);
  });
});
