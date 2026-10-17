import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { createTestAuth, testSession } from '../../../test/support/auth';
import { AuthProvider } from '../auth/AuthProvider';
import { useLoad } from './use-load';

interface Pending {
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}

function Harness({ pending, term }: { pending: Pending[]; term?: string }) {
  const { state, reload } = useLoad(
    () =>
      new Promise<string>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    [term],
  );
  return (
    <div>
      <p data-testid="estado">{state.status}</p>
      <p data-testid="dato">{state.status === 'ready' ? state.data : ''}</p>
      <p data-testid="mensaje">{state.status === 'failed' ? state.problem.message : ''}</p>
      <button type="button" onClick={reload}>
        otra vez
      </button>
    </div>
  );
}

function Searching({ pending }: { pending: Pending[] }) {
  const [term, setTerm] = useState('a');
  return (
    <div>
      <button type="button" onClick={() => setTerm('b')}>
        cambiar
      </button>
      <Harness pending={pending} term={term} />
    </div>
  );
}

const state = () => screen.getByTestId('estado').textContent;
const failure = (cls: 'network' | 'session' | 'transient') =>
  new ApiError({
    class: cls,
    status: cls === 'session' ? 401 : null,
    problem: null,
    retryAfterMs: null,
  });

describe('useLoad', () => {
  it('starts loading and shows what arrives', async () => {
    const pending: Pending[] = [];
    render(<Harness pending={pending} />);
    expect(state()).toBe('loading');

    await act(async () => {
      pending[0]?.resolve('listo');
      await Promise.resolve();
    });

    expect(state()).toBe('ready');
    expect(screen.getByTestId('dato').textContent).toBe('listo');
  });

  it('says what went wrong, in a sentence, when it fails', async () => {
    const pending: Pending[] = [];
    render(<Harness pending={pending} />);

    await act(async () => {
      pending[0]?.reject(failure('network'));
      await Promise.resolve();
    });

    expect(state()).toBe('failed');
    expect(screen.getByTestId('mensaje').textContent).toBe(
      'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
    );
  });

  it('loads again when asked, going back to loading while it does', async () => {
    const pending: Pending[] = [];
    render(<Harness pending={pending} />);
    await act(async () => {
      pending[0]?.reject(failure('network'));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('otra vez'));
    expect(state()).toBe('loading');
    await act(async () => {
      pending[1]?.resolve('ahora si');
      await Promise.resolve();
    });

    expect(pending).toHaveLength(2);
    expect(screen.getByTestId('dato').textContent).toBe('ahora si');
  });

  it('loads again when what it depends on changes', () => {
    const pending: Pending[] = [];
    render(<Searching pending={pending} />);

    fireEvent.click(screen.getByText('cambiar'));

    expect(pending).toHaveLength(2);
    expect(state()).toBe('loading');
  });

  it('does not show a late answer for something that is no longer asked for', async () => {
    const pending: Pending[] = [];
    render(<Searching pending={pending} />);
    fireEvent.click(screen.getByText('cambiar'));

    await act(async () => {
      pending[1]?.resolve('de b');
      await Promise.resolve();
    });
    await act(async () => {
      pending[0]?.resolve('de a');
      await Promise.resolve();
    });

    expect(screen.getByTestId('dato').textContent).toBe('de b');
  });

  it('does not touch the screen after it was left', async () => {
    const pending: Pending[] = [];
    const view = render(<Harness pending={pending} />);
    view.unmount();

    await act(() => {
      pending[0]?.resolve('tarde');
      return Promise.resolve();
    });

    expect(pending).toHaveLength(1);
  });

  it('closes the session when the API says it no longer counts, instead of leaving the person stuck', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer({ identity: { id: 'ana', email: null }, membership: null });
    const pending: Pending[] = [];
    render(
      <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
        <Harness pending={pending} />
      </AuthProvider>,
    );

    await act(async () => {
      pending[0]?.reject(failure('session'));
      await Promise.resolve();
    });

    expect(auth.sessions.current()).toBeNull();
  });

  it('keeps the session when the failure is only the network', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer({ identity: { id: 'ana', email: null }, membership: null });
    const pending: Pending[] = [];
    render(
      <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
        <Harness pending={pending} />
      </AuthProvider>,
    );

    await act(async () => {
      pending[0]?.reject(failure('network'));
      await Promise.resolve();
    });

    expect(auth.sessions.current()).not.toBeNull();
  });
});
