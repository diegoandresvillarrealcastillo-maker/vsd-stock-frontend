import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Me } from '../../domain/model/me';
import { createTestAuth, testMe, testSession, type TestAuth } from '../../../test/support/auth';
import { AuthProvider, useAccount } from '../auth/AuthProvider';
import { RequireAction } from './RequireAction';

function Where() {
  const { state } = useAccount();
  return <p data-testid="cuenta">{state.status}</p>;
}

function mount(auth: TestAuth, action: 'sale:create' | 'purchase:create') {
  render(
    <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
      <MemoryRouter>
        <Where />
        <RequireAction action={action}>
          <p>Contenido protegido</p>
        </RequireAction>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const account = () => screen.getByTestId('cuenta').textContent;

describe('RequireAction', () => {
  it('shows nothing, not even the protected content, to someone who has not signed in', () => {
    mount(createTestAuth(), 'sale:create');

    expect(account()).toBe('signed-out');
    expect(screen.queryByText('Contenido protegido')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('shows nothing while it still does not know who the person is', () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testMe('ana', 'owner'));
    mount(auth, 'sale:create');

    expect(account()).toBe('loading');
    expect(screen.queryByText('Contenido protegido')).toBeNull();
  });

  it('shows nothing to someone who has an account but no business', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    const withoutBusiness: Me = {
      identity: { id: 'ana', email: 'ana@example.com' },
      membership: null,
    };
    auth.answer(withoutBusiness);
    mount(auth, 'sale:create');

    await waitFor(() => expect(account()).toBe('ready'));
    expect(screen.queryByText('Contenido protegido')).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('shows the content to a role that can do the action', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testMe('ana', 'cashier'));
    mount(auth, 'sale:create');

    expect(await screen.findByText('Contenido protegido')).toBeDefined();
  });

  it('tells a role that can not do the action that it has no access, and shows nothing of the content', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer(testMe('ana', 'cashier'));
    mount(auth, 'purchase:create');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No tienes acceso' }),
    ).toBeDefined();
    expect(screen.queryByText('Contenido protegido')).toBeNull();
  });
});
