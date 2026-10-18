import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthError } from '../../domain/model/auth-failure';
import { createTestAuth, testSession } from '../../../test/support/auth';
import { renderScreen } from '../../../test/support/screens';
import { SignUpPage } from './SignUpPage';

function setup() {
  const auth = createTestAuth();
  const signUp = vi.spyOn(auth.sessions, 'signUp');
  const view = renderScreen(<SignUpPage />, { path: '/registrarse', auth });
  return { ...view, signUp };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
const send = async () => {
  await act(async () => {
    submit();
    await Promise.resolve();
  });
};

describe('SignUpPage', () => {
  it('asks for an email and a password and says how to go back to sign in', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeDefined();
    expect(screen.getByLabelText('Correo')).toBeDefined();
    expect(screen.getByLabelText('Contraseña')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ingresar' }).getAttribute('href')).toBe('/ingresar');
  });

  it('asks the password manager to make a new password, not to fill in an old one', () => {
    setup();

    expect(screen.getByLabelText<HTMLInputElement>('Contraseña').autocomplete).toBe('new-password');
    expect(screen.getByLabelText<HTMLInputElement>('Correo').autocomplete).toBe('username');
  });

  it('says what the password should be, before the person gets it wrong', () => {
    setup();

    expect(screen.getByText('Al menos 6 caracteres. Mejor si es larga y solo tuya.')).toBeDefined();
  });

  it('asks for what is missing, naming it, and does not call the service for nothing', () => {
    const { signUp } = setup();

    submit();

    expect(screen.getByText('Escribe tu correo.')).toBeDefined();
    expect(screen.getByText('Escribe una contraseña.')).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('signs up with the email without the spaces around it and the password as typed', async () => {
    const { signUp } = setup();
    type('Correo', ' ana@ejemplo.co ');
    type('Contraseña', 'clave-larga-1');

    await send();

    expect(signUp).toHaveBeenCalledWith('ana@ejemplo.co', 'clave-larga-1');
  });

  it('says the email is taken, and marks the email field, not the password', async () => {
    const { signUp } = setup();
    signUp.mockRejectedValueOnce(new AuthError('email-taken'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga-1');

    await send();

    expect(screen.getByRole('alert').textContent).toContain('Ese correo ya tiene una cuenta.');
    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBeNull();
  });

  it('says the password is too weak, and marks the password field', async () => {
    const { signUp } = setup();
    signUp.mockRejectedValueOnce(new AuthError('weak-password'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', '123456');

    await send();

    expect(screen.getByRole('alert').textContent).toContain('muy débil');
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBeNull();
  });

  it('says the email is not valid, and marks the email field', async () => {
    const { signUp } = setup();
    signUp.mockRejectedValueOnce(new AuthError('invalid-email'));
    type('Correo', 'ana@');
    type('Contraseña', 'clave-larga-1');

    await send();

    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBe('true');
  });

  it('marks no field when the failure is not about what was typed', async () => {
    const { signUp } = setup();
    signUp.mockRejectedValueOnce(new AuthError('network'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga-1');

    await send();

    expect(screen.getByRole('alert').textContent).toContain('No hay conexión');
    expect(screen.getByLabelText('Correo').getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByLabelText('Contraseña').getAttribute('aria-invalid')).toBeNull();
  });

  it('asks the person to confirm the email when the service asks for it, and offers to go back to sign in', async () => {
    const { signUp } = setup();
    signUp.mockResolvedValueOnce(null);
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga-1');

    await send();

    expect(screen.getByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeDefined();
    expect(screen.getByText(/Te enviamos un enlace para confirmar tu cuenta/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver a ingresar' }).getAttribute('href')).toBe(
      '/ingresar',
    );
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
  });

  it('does not ask for confirmation when the account is ready to use', async () => {
    const { signUp } = setup();
    signUp.mockResolvedValueOnce(testSession('ana'));
    type('Correo', 'ana@ejemplo.co');
    type('Contraseña', 'clave-larga-1');

    await send();

    expect(screen.queryByRole('heading', { level: 1, name: 'Revisa tu correo' })).toBeNull();
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
    expect(screen.getByText('Escribe una contraseña.')).toBeDefined();

    type('Correo', 'a');

    expect(screen.queryByText('Escribe tu correo.')).toBeNull();
    expect(screen.queryByText('Escribe una contraseña.')).toBeNull();
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
    expect(screen.getByText('Escribe una contraseña.')).toBeDefined();

    type('Correo', 'a');

    expect(screen.queryByText('Escribe tu correo.')).toBeNull();
    expect(screen.queryByText('Escribe una contraseña.')).toBeNull();
  });
});
