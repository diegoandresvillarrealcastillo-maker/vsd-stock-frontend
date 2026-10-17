import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Me } from '../../domain/model/me';
import {
  createTestAuth,
  testApiError,
  testMe,
  testSession,
  type TestAuth,
} from '../../../test/support/auth';
import { AuthProvider, useAccount } from './AuthProvider';

function Probe() {
  const account = useAccount();
  const state = account.state;
  const [confirm, setConfirm] = useState('');
  return (
    <div>
      <p data-testid="confirmar">{confirm}</p>
      <button
        onClick={() =>
          void account
            .signUp('nueva@example.com', 'x')
            .then((created) => setConfirm(created.confirmEmail ? 'si' : 'no'))
        }
      >
        registrar
      </button>
      <p data-testid="status">{state.status}</p>
      <p data-testid="role">
        {state.status === 'ready' ? (state.me.membership?.role ?? 'sin-negocio') : ''}
      </p>
      <p data-testid="failure">{state.status === 'failed' ? state.failure.class : ''}</p>
      <button onClick={() => void account.signIn('ana@example.com', 'x')}>entrar</button>
      <button onClick={() => void account.signIn('luis@example.com', 'x')}>entrar como luis</button>
      <button onClick={() => void account.signOut()}>salir</button>
      <button onClick={() => account.reload()}>reintentar</button>
    </div>
  );
}

const mount = (env: TestAuth) =>
  render(
    <AuthProvider sessions={env.sessions} loadMe={env.loadMe}>
      <Probe />
    </AuthProvider>,
  );

const status = () => screen.getByTestId('status').textContent;

describe('AuthProvider', () => {
  it('is signed out without a session, and asks the API nothing', () => {
    const env = createTestAuth();
    mount(env);

    expect(status()).toBe('signed-out');
    expect(env.loads).toEqual([]);
  });

  it('loads who the person is when there already is a session, and shows the role it finds', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    env.answer(testMe('ana', 'cashier'));
    mount(env);

    expect(status()).toBe('loading');
    await waitFor(() => expect(status()).toBe('ready'));
    expect(screen.getByTestId('role').textContent).toBe('cashier');
    expect(env.loads).toEqual(['ana']);
  });

  it('signs in, and then loads who the person is', async () => {
    const env = createTestAuth();
    env.answer(testMe('ana'));
    mount(env);

    fireEvent.click(screen.getByText('entrar'));

    await waitFor(() => expect(status()).toBe('ready'));
    expect(env.loads).toEqual(['ana']);
  });

  it('tells apart a person who signed in but has no business yet', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    env.answer({ identity: { id: 'ana', email: null }, membership: null });
    mount(env);

    await waitFor(() => expect(status()).toBe('ready'));
    expect(screen.getByTestId('role').textContent).toBe('sin-negocio');
  });

  it('signs out, and forgets who the person was', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    env.answer(testMe('ana'));
    mount(env);
    await waitFor(() => expect(status()).toBe('ready'));

    fireEvent.click(screen.getByText('salir'));

    await waitFor(() => expect(status()).toBe('signed-out'));
    expect(env.store.get()).toBeNull();
  });

  it('closes the session when the API says it is no longer valid', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    env.answer(testApiError('session'));
    mount(env);

    await waitFor(() => expect(status()).toBe('signed-out'));
    expect(env.store.get()).toBeNull();
  });

  it('keeps the session and says it could not load when the network fails, and tries again on request', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    env.answer(testApiError('network'), testMe('ana'));
    mount(env);

    await waitFor(() => expect(status()).toBe('failed'));
    expect(screen.getByTestId('failure').textContent).toBe('network');
    expect(env.store.get()).not.toBeNull();

    fireEvent.click(screen.getByText('reintentar'));

    await waitFor(() => expect(status()).toBe('ready'));
    expect(env.loads).toEqual(['ana', 'ana']);
  });

  it('does not load again when the same person only got a new token', async () => {
    const env = createTestAuth({ stored: testSession('ana', 'uno') });
    env.answer(testMe('ana'));
    mount(env);
    await waitFor(() => expect(status()).toBe('ready'));

    act(() => env.store.set(testSession('ana', 'dos')));

    expect(status()).toBe('ready');
    expect(env.loads).toEqual(['ana']);
  });

  it('loads again when a different person signs in', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    env.answer(testMe('ana'), testMe('luis', 'cashier'));
    mount(env);
    await waitFor(() => expect(status()).toBe('ready'));

    fireEvent.click(screen.getByText('entrar como luis'));

    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('cashier'));
    expect(env.loads).toEqual(['ana', 'luis']);
  });

  it('does not show the answer for a person who left while it was loading', async () => {
    const env = createTestAuth({ stored: testSession('ana') });
    let finish!: (me: Me) => void;
    env.loadMe.execute = () => new Promise<Me>((resolve) => (finish = resolve));
    mount(env);

    fireEvent.click(screen.getByText('salir'));
    await act(() => {
      finish(testMe('ana'));
      return Promise.resolve();
    });

    expect(status()).toBe('signed-out');
  });

  it('says the email has to be confirmed when signing up does not let the person in yet', async () => {
    const env = createTestAuth();
    mount(env);

    fireEvent.click(screen.getByText('registrar'));

    await waitFor(() => expect(screen.getByTestId('confirmar').textContent).toBe('si'));
    expect(status()).toBe('signed-out');
  });

  it('says nothing has to be confirmed when signing up already let the person in, and loads who they are', async () => {
    const env = createTestAuth({ signUpGivesSession: true });
    env.answer({ identity: { id: 'nueva', email: 'nueva@example.com' }, membership: null });
    mount(env);

    fireEvent.click(screen.getByText('registrar'));

    await waitFor(() => expect(screen.getByTestId('confirmar').textContent).toBe('no'));
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('sin-negocio'));
    expect(env.loads).toEqual(['nueva']);
  });

  it('refuses to be used outside the provider', () => {
    const quiet = console.error;
    console.error = () => undefined;
    try {
      expect(() => render(<Probe />)).toThrow(/AuthProvider/);
    } finally {
      console.error = quiet;
    }
  });
});
