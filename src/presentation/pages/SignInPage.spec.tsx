import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthError } from '../../domain/model/auth-failure';
import { createTestAuth } from '../../../test/support/auth';
import { createTestConnection } from '../../../test/support/connection';
import { renderScreen } from '../../../test/support/screens';
import { SignInPage } from './SignInPage';

function setup(options: { connection?: ReturnType<typeof createTestConnection> } = {}) {
  const auth = createTestAuth();
  const signIn = vi.spyOn(auth.sessions, 'signIn');
  const view = renderScreen(<SignInPage />, { path: '/ingresar', auth, ...options });
  return { ...view, signIn };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

describe('SignInPage', () => {
  it('asks for the email and the password, and says how to create an account', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeDefined();
    expect(screen.getByLabelText('Correo')).toBeDefined();
    expect(screen.getByLabelText('Contraseña')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Crear una' }).getAttribute('href')).toBe(
      '/registrarse',
    );
  });

  it('lets the browser and the password manager help: the right kind of field and the right hint', () => {
    setup();

    const email = screen.getByLabelText<HTMLInputElement>('Correo');
    const password = screen.getByLabelText<HTMLInputElement>('Contraseña');
    expect(email.type).toBe('email');
    expect(email.autocomplete).toBe('username');
    expect(email.inputMode).toBe('email');
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('current-password');
  });

  it('has the theme button on the band, so it can be changed before signing in', () => {
    setup();

    expect(screen.getByRole('button', { name: /Cambiar a tema/ })).toBeDefined();
  });

  it('asks for what is missing, naming it, and does not call the service for nothing', () => {
    const { signIn } = setup();

    submit();

    expect(screen.getByText('Escribe tu correo.')).toBeDefined();
    expect(screen.getByText('Escribe tu contraseña.')).toBeDefined();
    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBe('true');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('takes a blank email for a missing one', () => {
    const { signIn } = setup();

    type('Correo', '   ');
    type('Contraseña', 'clave-larga');
    submit();

    expect(screen.getByText('Escribe tu correo.')).toBeDefined();
    expect(screen.queryByText('Escribe tu contraseña.')).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with the email without the spaces around it and the password exactly as typed', async () => {
    const { signIn } = setup();

    type('Correo', '  ana@ejemplo.co ');
    type('Contraseña', ' mi clave ');
    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(signIn).toHaveBeenCalledWith('ana@ejemplo.co', ' mi clave ');
  });

  it('is sent with the Enter key, as any form', async () => {
    const { signIn } = setup();
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga');

    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: 'Ingresar' }).closest('form') as HTMLFormElement,
      );
      await Promise.resolve();
    });

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('says the credentials do not match, and marks the password, without saying which one is wrong', async () => {
    const { signIn } = setup();
    signIn.mockRejectedValueOnce(new AuthError('invalid-credentials'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'equivocada');

    await act(async () => {
      submit();
      await Promise.resolve();
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('No pudimos ingresarte');
    expect(alert.textContent).toContain('El correo o la contraseña no coinciden.');
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('Revisa que la contraseña esté bien escrita.')).toBeDefined();
  });

  it('says what went wrong when it is not the fault of the person, and does not blame the password', async () => {
    const { signIn } = setup();
    signIn.mockRejectedValueOnce(new AuthError('unavailable'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga');

    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'El servicio de acceso no está disponible ahora.',
    );
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBeNull();
  });

  it('never shows what the person typed in an error', async () => {
    const { signIn } = setup();
    signIn.mockRejectedValueOnce(new AuthError('invalid-credentials'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'secreta-123');

    await act(async () => {
      submit();
      await Promise.resolve();
    });

    expect(screen.getByRole('alert').textContent).not.toContain('secreta-123');
  });

  it('says it is sending, and does not send twice, while the answer comes', async () => {
    const { signIn } = setup();
    let finish: (value: never) => void = () => undefined;
    signIn.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve as typeof finish)),
    );
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga');

    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Enviando…' }));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText<HTMLInputElement>('Correo').disabled).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Contraseña').disabled).toBe(true);
    await act(async () => {
      finish(undefined as never);
      await Promise.resolve();
    });
  });

  it('forgets the error when the person starts typing again', async () => {
    const { signIn } = setup();
    signIn.mockRejectedValueOnce(new AuthError('invalid-credentials'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'equivocada');
    await act(async () => {
      submit();
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).not.toBeNull();

    type('Contraseña', 'equivocada2');

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBeNull();
  });

  it('says there is no connection when the server does not answer, because signing in needs it', async () => {
    const connection = createTestConnection();
    setup({ connection });

    await act(async () => {
      await connection.health.fail();
    });

    expect(screen.getByRole('status').textContent).toContain('Sin conexión');
  });

  it('says nothing about the connection while it is fine', async () => {
    const connection = createTestConnection();
    setup({ connection });

    await act(async () => {
      await connection.health.succeed();
    });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('puts the cursor on the first thing that is missing', () => {
    setup();

    submit();
    expect(document.activeElement?.id).toBe('correo');
    type('Correo', 'ana@ejemplo.co');
    submit();

    expect(document.activeElement?.id).toBe('contrasena');
  });

  it('takes away what was missing as soon as the person starts to fix any of it', () => {
    setup();
    submit();
    expect(screen.getByText('Escribe tu correo.')).toBeDefined();
    expect(screen.getByText('Escribe tu contraseña.')).toBeDefined();

    type('Correo', 'a');

    expect(screen.queryByText('Escribe tu correo.')).toBeNull();
    expect(screen.queryByText('Escribe tu contraseña.')).toBeNull();
  });

  it('puts the cursor on the first thing that is missing', () => {
    setup();

    submit();
    expect(document.activeElement?.id).toBe('correo');
    type('Correo', 'ana@ejemplo.co');
    submit();

    expect(document.activeElement?.id).toBe('contrasena');
  });

  it('takes away what was missing as soon as the person starts to fix any of it', () => {
    setup();
    submit();
    expect(screen.getByText('Escribe tu correo.')).toBeDefined();
    expect(screen.getByText('Escribe tu contraseña.')).toBeDefined();

    type('Correo', 'a');

    expect(screen.queryByText('Escribe tu correo.')).toBeNull();
    expect(screen.queryByText('Escribe tu contraseña.')).toBeNull();
  });
});
