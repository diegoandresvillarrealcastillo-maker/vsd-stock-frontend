import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import {
  createTestAuth,
  testApiError,
  testMe,
  testSession,
  type TestAuth,
} from '../../../test/support/auth';
import { AuthProvider } from '../auth/AuthProvider';
import { RequireMembership, RequireNoMembership, SignedOutOnly } from './AccountGate';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

/** Tres puertas: la de la aplicacion, la de «crear tu negocio» y la de entrar; cada una con una frase propia. */
function renderGates(auth: TestAuth, start: string) {
  return render(
    <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
      <MemoryRouter initialEntries={[start]}>
        <Where />
        <Routes>
          <Route
            path="/ingresar"
            element={
              <SignedOutOnly>
                <p>pantalla de entrar</p>
              </SignedOutOnly>
            }
          />
          <Route
            path="/empezar"
            element={
              <RequireNoMembership>
                <p>pantalla de empezar</p>
              </RequireNoMembership>
            }
          />
          <Route
            path="/"
            element={
              <RequireMembership>
                <p>la aplicacion</p>
              </RequireMembership>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent;

describe('AccountGate', () => {
  describe('without a session', () => {
    it('sends whoever asks for the application to sign in', async () => {
      renderGates(createTestAuth(), '/');

      await waitFor(() => expect(where()).toBe('/ingresar'));
      expect(screen.getByText('pantalla de entrar')).toBeDefined();
      expect(screen.queryByText('la aplicacion')).toBeNull();
    });

    it('sends whoever asks to create a business to sign in first', async () => {
      renderGates(createTestAuth(), '/empezar');

      await waitFor(() => expect(where()).toBe('/ingresar'));
    });

    it('shows the sign in screen to whoever has no session', () => {
      renderGates(createTestAuth(), '/ingresar');

      expect(screen.getByText('pantalla de entrar')).toBeDefined();
      expect(where()).toBe('/ingresar');
    });
  });

  describe('while the account is being loaded', () => {
    it('says so in every gate, without showing what is behind or asking for the person to sign in again', () => {
      for (const start of ['/', '/empezar', '/ingresar']) {
        const auth = createTestAuth({ stored: testSession('ana') });
        auth.answer(testMe('ana'));
        const { unmount } = renderGates(auth, start);

        expect(screen.getByRole('status').textContent).toContain('Cargando tu cuenta');
        expect(screen.queryByText('la aplicacion')).toBeNull();
        expect(screen.queryByText('pantalla de empezar')).toBeNull();
        expect(screen.queryByText('pantalla de entrar')).toBeNull();
        unmount();
      }
    });
  });

  describe('with a business', () => {
    it('lets the person into the application', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testMe('ana'));
      renderGates(auth, '/');

      expect(await screen.findByText('la aplicacion')).toBeDefined();
      expect(where()).toBe('/');
    });

    it('takes whoever already has a business away from «create your business» and from sign in', async () => {
      for (const start of ['/empezar', '/ingresar']) {
        const auth = createTestAuth({ stored: testSession('ana') });
        auth.answer(testMe('ana'));
        const { unmount } = renderGates(auth, start);

        await waitFor(() => expect(where()).toBe('/'));
        expect(await screen.findByText('la aplicacion')).toBeDefined();
        unmount();
      }
    });
  });

  describe('without a business yet', () => {
    const lone = () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer({ identity: { id: 'ana', email: 'ana@example.com' }, membership: null });
      return auth;
    };

    it('takes the person from the application to «create your business»', async () => {
      renderGates(lone(), '/');

      await waitFor(() => expect(where()).toBe('/empezar'));
      expect(screen.getByText('pantalla de empezar')).toBeDefined();
    });

    it('takes the person from sign in to «create your business»', async () => {
      renderGates(lone(), '/ingresar');

      await waitFor(() => expect(where()).toBe('/empezar'));
    });

    it('lets the person stay at «create your business»', async () => {
      renderGates(lone(), '/empezar');

      expect(await screen.findByText('pantalla de empezar')).toBeDefined();
      expect(where()).toBe('/empezar');
    });
  });

  describe('when the account could not be loaded', () => {
    it('says it and offers to try again, keeping the session, in every gate', async () => {
      for (const start of ['/', '/empezar', '/ingresar']) {
        const auth = createTestAuth({ stored: testSession('ana') });
        auth.answer(testApiError('network'), testMe('ana'));
        const { unmount } = renderGates(auth, start);

        expect(await screen.findByText('No pudimos cargar tu cuenta')).toBeDefined();
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDefined();
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeDefined();
        expect(auth.sessions.current()).not.toBeNull();
        expect(screen.queryByText('la aplicacion')).toBeNull();
        unmount();
      }
    });

    it('asks again when the person presses «Reintentar» and goes on when it works', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testApiError('transient'), testMe('ana'));
      renderGates(auth, '/');
      await screen.findByText('No pudimos cargar tu cuenta');

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('la aplicacion')).toBeDefined();
      expect(auth.loads).toEqual(['ana', 'ana']);
    });

    it('closes the session from «Cerrar sesión» and sends the person to sign in', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testApiError('network'));
      renderGates(auth, '/');
      await screen.findByText('No pudimos cargar tu cuenta');

      await act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
        return Promise.resolve();
      });

      await waitFor(() => expect(where()).toBe('/ingresar'));
      expect(auth.sessions.current()).toBeNull();
    });
  });

  it('sends the person to sign in when the API says the session no longer counts', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testApiError('session'));
    renderGates(auth, '/');

    await waitFor(() => expect(where()).toBe('/ingresar'));
    expect(auth.sessions.current()).toBeNull();
  });
});
