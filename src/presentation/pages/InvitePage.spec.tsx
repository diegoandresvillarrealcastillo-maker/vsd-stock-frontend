import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakePeople, testInvitation } from '../../../test/support/people';
import { renderScreen } from '../../../test/support/screens';
import { InvitePage } from './InvitePage';

function setup(role: Role = 'owner') {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const people = createFakePeople();
  const view = renderScreen(<InvitePage />, { path: '/personas/nueva', auth, people });
  return { ...view, people };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
    await Promise.resolve();
  });
};

const failure = (code: string, errors?: { pointer: string; code: string; detail: string }[]) =>
  new ApiError({
    class: 'permanent',
    status: code === 'forbidden' ? 403 : 400,
    retryAfterMs: null,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status: 400,
      detail: 'd',
      instance: '/v1/invitations',
      code,
      traceId: 'x',
      ...(errors === undefined ? {} : { errors }),
    },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InvitePage', () => {
  it('asks for the name, an optional email and the role', async () => {
    setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Invitar a alguien' }),
    ).toBeDefined();
    expect(screen.getByLabelText('Nombre de la persona')).toBeDefined();
    expect(screen.getByLabelText('Correo (opcional)')).toBeDefined();
    expect(screen.getByLabelText('Rol')).toBeDefined();
  });

  it('lets an owner invite administrators and cashiers, cashier first as the usual case', async () => {
    setup('owner');
    await screen.findByLabelText('Rol');

    const options = screen
      .getAllByRole('option')
      .map((o) => [o.getAttribute('value'), o.textContent]);

    expect(options).toEqual([
      ['cashier', 'Cajero'],
      ['admin', 'Administrador'],
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>('Rol').value).toBe('cashier');
  });

  it('lets an administrator invite only cashiers', async () => {
    setup('admin');
    await screen.findByLabelText('Rol');

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Cajero']);
  });

  it('has a way back to the list', async () => {
    setup();

    expect(await screen.findByRole('link', { name: 'Volver a personas' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver a personas' }).getAttribute('href')).toBe(
      '/personas',
    );
  });

  it('asks for the name when it is missing and sends nothing', async () => {
    const { people } = setup();
    await screen.findByLabelText('Rol');

    await submit();

    expect(screen.getByText('Escribe el nombre de la persona.')).toBeDefined();
    expect(people.invite).not.toHaveBeenCalled();
  });

  it('sends the name, the role and the email that was typed', async () => {
    const { people } = setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', ' Daniel Mora ');
    type('Correo (opcional)', 'daniel@ejemplo.co');
    type('Rol', 'admin');

    await submit();

    expect(people.invite).toHaveBeenCalledWith({
      fullName: ' Daniel Mora ',
      role: 'admin',
      email: 'daniel@ejemplo.co',
    });
  });

  it('sends no email when none was typed', async () => {
    const { people } = setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');

    await submit();

    expect(people.invite).toHaveBeenCalledWith({ fullName: 'Daniel', role: 'cashier' });
  });

  it('shows the code once it is made, with when it expires, and says it will not be shown again', async () => {
    setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel Mora');

    await submit();

    expect(screen.getByRole('heading', { level: 1, name: 'Invitación creada' })).toBeDefined();
    expect(screen.getByText('ABCD-EFGH-JKMN-PQRS')).toBeDefined();
    expect(screen.getByText(/Pásale este código a Daniel Mora/)).toBeDefined();
    expect(screen.getByText(/vence el 24 de octubre de 2026/)).toBeDefined();
    expect(screen.getByText('Cópialo ahora')).toBeDefined();
    expect(screen.queryByLabelText('Nombre de la persona')).toBeNull();
  });

  it('copies the code when asked, and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');
    await submit();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('ABCD-EFGH-JKMN-PQRS');
    expect(screen.getByRole('status').textContent).toContain('Código copiado');
  });

  it('says to copy it by hand when the device does not let the page copy', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denegado'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');
    await submit();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('status').textContent).toContain('No pudimos copiarlo');
  });

  it('says to copy it by hand when there is no clipboard at all', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');
    await submit();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar código' }));
      await Promise.resolve();
    });

    expect(screen.getByRole('status').textContent).toContain('No pudimos copiarlo');
  });

  it('goes back to the list from «Listo»', async () => {
    setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');
    await submit();

    expect(screen.getByRole('link', { name: 'Listo' }).getAttribute('href')).toBe('/personas');
  });

  it('puts the problems the server finds under their fields', async () => {
    const { people } = setup();
    people.invite.mockRejectedValueOnce(
      failure('validation-failed', [
        {
          pointer: '/fullName',
          code: 'too-long',
          detail: 'El nombre no puede pasar de 120 caracteres.',
        },
        { pointer: '/email', code: 'invalid-email', detail: 'El correo no parece válido.' },
      ]),
    );
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'x');
    type('Correo (opcional)', 'mal');

    await submit();

    expect(screen.getByText('El nombre no puede pasar de 120 caracteres.')).toBeDefined();
    expect(screen.getByText('El correo no parece válido.')).toBeDefined();
    expect(screen.getByLabelText('Nombre de la persona').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Correo (opcional)').getAttribute('aria-invalid')).toBe('true');
  });

  it('says the role does not allow it, and keeps what was typed', async () => {
    const { people } = setup('admin');
    people.invite.mockRejectedValueOnce(failure('forbidden'));
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');

    await submit();

    expect(screen.getByRole('alert').textContent).toContain('Tu rol no permite hacer esto.');
    expect(screen.getByLabelText<HTMLInputElement>('Nombre de la persona').value).toBe('Daniel');
  });

  it('does not show the code again after the person leaves and comes back', async () => {
    const first = setup();
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'Daniel');
    await submit();
    first.unmount();

    setup();

    expect(await screen.findByLabelText('Nombre de la persona')).toBeDefined();
    expect(screen.queryByText('ABCD-EFGH-JKMN-PQRS')).toBeNull();
  });

  it('shows the person invited, from what the server answers and not from what was typed', async () => {
    const { people } = setup();
    people.invite.mockResolvedValueOnce(
      testInvitation({ person: { ...testInvitation().person, fullName: 'Daniel A. Mora' } }),
    );
    await screen.findByLabelText('Rol');
    type('Nombre de la persona', 'daniel');

    await submit();

    expect(screen.getByText(/Pásale este código a Daniel A. Mora/)).toBeDefined();
  });

  it('puts the cursor on the name when it is missing', async () => {
    setup();

    await submit();

    expect(document.activeElement?.id).toBe('nombre');
  });

  it('takes away what was missing as soon as the person starts to write', async () => {
    setup();
    await submit();
    expect(screen.getByText('Escribe el nombre de la persona.')).toBeDefined();

    type('Nombre de la persona', 'D');

    expect(screen.queryByText('Escribe el nombre de la persona.')).toBeNull();
  });

  it('puts what the server says about the role under the role', async () => {
    const { people } = setup();
    people.invite.mockRejectedValue(
      failure('validation-failed', [
        { pointer: '/role', code: 'invalid', detail: 'Ese rol no existe.' },
      ]),
    );
    type('Nombre de la persona', 'Daniel');

    await submit();

    expect(screen.getByText('Ese rol no existe.')).toBeDefined();
    expect(screen.getByLabelText('Rol').getAttribute('aria-invalid')).toBe('true');
  });

  it('does not let the person change the email while the invitation is being made', async () => {
    const { people } = setup();
    people.invite.mockReturnValue(new Promise(() => undefined));
    type('Nombre de la persona', 'Daniel');

    await submit();

    expect(screen.getByLabelText('Correo (opcional)').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Nombre de la persona').hasAttribute('disabled')).toBe(true);
  });
});
