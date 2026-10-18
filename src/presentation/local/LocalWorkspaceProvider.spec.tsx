import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { deferred } from '../../../test/support/deferred';
import { createTestLocal, type TestLocal } from '../../../test/support/local';
import { AuthProvider } from '../auth/AuthProvider';
import { LocalWorkspaceProvider, useLocal } from './LocalWorkspaceProvider';

function Probe() {
  const local = useLocal();
  return (
    <>
      <p data-testid="setup">{local.setup.status}</p>
      <p data-testid="pending">
        {local.setup.status === 'lost-key' ? String(local.setup.pending) : '-'}
      </p>
      <p data-testid="active">{local.active?.profile.fullName ?? 'nadie'}</p>
      <p data-testid="code">{local.active?.deviceCode ?? 'sin codigo'}</p>
      <p data-testid="device">{local.device}</p>
      <button type="button" onClick={local.registerDevice}>
        Reintentar
      </button>
      <button type="button" onClick={() => void local.discard()}>
        Descartar
      </button>
    </>
  );
}

function mount({
  auth = createTestAuth(),
  local = createTestLocal(),
}: { auth?: ReturnType<typeof createTestAuth>; local?: TestLocal } = {}) {
  render(
    <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
      <LocalWorkspaceProvider workspace={local.workspace}>
        <Probe />
      </LocalWorkspaceProvider>
    </AuthProvider>,
  );
  return { auth, local };
}

const signedIn = () => {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'cashier'));
  return auth;
};

const text = (id: string) => screen.getByTestId(id).textContent;

describe('LocalWorkspaceProvider', () => {
  it('does nothing while nobody has entered: no base is opened', () => {
    const { local } = mount();

    expect(text('setup')).toBe('idle');
    expect(text('active')).toBe('nadie');
    expect(local.stores.opened).toEqual([]);
  });

  it('opens the base of the person once the server says who they are, and registers the device', async () => {
    const { local } = mount({ auth: signedIn() });

    await waitFor(() => {
      expect(text('code')).toBe('AA');
    });

    expect(text('setup')).toBe('ready');
    expect(text('active')).toBe('Ana Gómez');
    expect(text('device')).toBe('idle');
    expect(local.stores.opened).toEqual(['ana']);
    expect(local.pointer.get()).toBe('ana');
    expect(local.registry.calls).toHaveLength(1);
  });

  it('is starting while the base opens', async () => {
    const local = createTestLocal();
    const release = deferred<undefined>();
    local.stores.holdOpen = release.promise.then(() => undefined);
    mount({ auth: signedIn(), local });
    await waitFor(() => {
      expect(text('setup')).toBe('starting');
    });
    expect(text('active')).toBe('nadie');

    local.stores.holdOpen = null;
    release.resolve(undefined);

    await waitFor(() => {
      expect(text('setup')).toBe('ready');
    });
  });

  it('does not open anything for someone who has no business yet', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer({ identity: { id: 'ana', email: 'ana@example.com' }, membership: null });
    const { local } = mount({ auth });

    await waitFor(() => {
      expect(auth.loads).toEqual(['ana']);
    });

    expect(text('setup')).toBe('idle');
    expect(local.stores.opened).toEqual([]);
  });

  it('does not ask the server for the device again when this person already had its code', async () => {
    const local = createTestLocal();
    local.stores.dataOf('ana').device = { id: 'dev-1', code: 'AB' };
    mount({ auth: signedIn(), local });

    await waitFor(() => {
      expect(text('code')).toBe('AB');
    });

    expect(local.registry.calls).toEqual([]);
  });

  describe('when the device can not be registered', () => {
    it('says so, and lets the person try again', async () => {
      const local = createTestLocal();
      local.registry.failNext = new ApiError({
        class: 'network',
        status: null,
        problem: null,
        retryAfterMs: null,
      });
      mount({ auth: signedIn(), local });
      await waitFor(() => {
        expect(text('device')).toBe('failed');
      });
      expect(text('code')).toBe('sin codigo');
      expect(text('active')).toBe('Ana Gómez');

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      await waitFor(() => {
        expect(text('code')).toBe('AA');
      });
      expect(text('device')).toBe('idle');
    });
  });

  describe('when the base can not be opened', () => {
    it('says the browser can not keep encrypted data, and nobody works with a base', async () => {
      const local = createTestLocal();
      local.stores.failOpen = new Error('sin IndexedDB');
      mount({ auth: signedIn(), local });

      await waitFor(() => {
        expect(text('setup')).toBe('unavailable');
      });

      expect(text('active')).toBe('nadie');
    });

    it('asks the person what to do when the key was lost with operations waiting, and starts over if they say so', async () => {
      const local = createTestLocal();
      local.stores.dataOf('ana').pending = 4;
      local.stores.keyLostFor = 'ana';
      mount({ auth: signedIn(), local });
      await waitFor(() => {
        expect(text('setup')).toBe('lost-key');
      });
      expect(text('pending')).toBe('4');

      local.stores.keyLostFor = null;
      fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));

      await waitFor(() => {
        expect(text('setup')).toBe('ready');
      });
      expect(local.stores.forgotten).toEqual(['ana']);
      expect(text('code')).toBe('AA');
    });
  });

  describe('when the session ends', () => {
    it('lets go of the base but keeps everything saved, and remembers who it was', async () => {
      const { auth, local } = mount({ auth: signedIn() });
      await waitFor(() => {
        expect(text('code')).toBe('AA');
      });

      await act(async () => {
        await auth.sessions.signOut();
      });

      expect(text('active')).toBe('nadie');
      expect(local.stores.forgotten).toEqual([]);
      expect(local.stores.people.has('ana')).toBe(true);
      expect(local.pointer.get()).toBe('ana');
      expect(local.stores.lastStore.closed).toBe(true);
    });

    it('does not close a counter that was resumed without a connection: it never came from a session', async () => {
      const local = createTestLocal();
      local.stores.dataOf('ana').profile = {
        authUserId: 'ana',
        email: 'ana@example.com',
        userId: 'u-ana',
        businessId: 'b-1',
        businessName: 'Tienda La Esquina',
        role: 'cashier',
        fullName: 'Ana Gómez',
        verifiedAt: '2026-10-17T10:00:00.000Z',
      };
      local.pointer.set('ana');
      mount({ local });

      await act(async () => {
        await local.workspace.resume();
      });

      expect(text('active')).toBe('Ana Gómez');
      expect(local.stores.lastStore.closed).toBe(false);
    });
  });

  it('throws a clear error when used outside of the provider', () => {
    expect(() => render(<Probe />)).toThrow(/LocalWorkspaceProvider/);
  });
});
