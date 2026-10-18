import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { AuthError } from '../../domain/model/auth-failure';
import { createTestAuth, testSession } from '../../../test/support/auth';
import { AuthProvider } from '../auth/AuthProvider';
import { useSubmit } from './use-submit';

interface Deferred {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** Un boton que corre una accion que el test resuelve o rechaza cuando quiere. */
function Harness({ calls, deferred }: { calls: { count: number }; deferred: Deferred[] }) {
  const { pending, problem, submit, clear } = useSubmit();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void submit(
            () =>
              new Promise<void>((resolve, reject) => {
                calls.count += 1;
                deferred.push({ resolve, reject });
              }),
          )
        }
      >
        enviar
      </button>
      <button type="button" onClick={clear}>
        limpiar
      </button>
      <p data-testid="estado">{pending ? 'enviando' : 'libre'}</p>
      <p data-testid="mensaje">{problem?.message ?? ''}</p>
      <p data-testid="campos">{JSON.stringify(problem?.fields ?? {})}</p>
    </div>
  );
}

function setup() {
  const calls = { count: 0 };
  const deferred: Deferred[] = [];
  const view = render(<Harness calls={calls} deferred={deferred} />);
  return { calls, deferred, view };
}

const state = () => screen.getByTestId('estado').textContent;
const message = () => screen.getByTestId('mensaje').textContent;

describe('useSubmit', () => {
  it('is free and quiet at the start', () => {
    setup();

    expect(state()).toBe('libre');
    expect(message()).toBe('');
  });

  it('says it is sending while the action runs, and is free again when it succeeds', async () => {
    const { deferred } = setup();

    fireEvent.click(screen.getByText('enviar'));
    expect(state()).toBe('enviando');
    await act(async () => {
      deferred[0]?.resolve();
      await Promise.resolve();
    });

    expect(state()).toBe('libre');
    expect(message()).toBe('');
  });

  it('does not run the action a second time while the first one is still going', () => {
    const { calls } = setup();

    fireEvent.click(screen.getByText('enviar'));
    fireEvent.click(screen.getByText('enviar'));
    fireEvent.click(screen.getByText('enviar'));

    expect(calls.count).toBe(1);
  });

  it('shows what went wrong as a sentence, and is free to try again', async () => {
    const { deferred } = setup();
    fireEvent.click(screen.getByText('enviar'));

    await act(async () => {
      deferred[0]?.reject(new AuthError('invalid-credentials'));
      await Promise.resolve();
    });

    expect(state()).toBe('libre');
    expect(message()).toBe('El correo o la contraseña no coinciden.');
  });

  it('shows the problem of each field a failure of the API names', async () => {
    const { deferred } = setup();
    fireEvent.click(screen.getByText('enviar'));

    await act(async () => {
      deferred[0]?.reject(
        new ApiError({
          class: 'permanent',
          status: 400,
          retryAfterMs: null,
          problem: {
            type: 'urn:vsd-stock:problem:validation-failed',
            title: 't',
            status: 400,
            detail: 'd',
            instance: '/v1/x',
            code: 'validation-failed',
            traceId: 'x',
            errors: [
              {
                pointer: '/fullName',
                code: 'blank',
                detail: 'El nombre no puede quedar en blanco.',
              },
            ],
          },
        }),
      );
      await Promise.resolve();
    });

    expect(screen.getByTestId('campos').textContent).toBe(
      '{"/fullName":"El nombre no puede quedar en blanco."}',
    );
  });

  it('forgets the last problem when it tries again', async () => {
    const { deferred } = setup();
    fireEvent.click(screen.getByText('enviar'));
    await act(async () => {
      deferred[0]?.reject(new AuthError('network'));
      await Promise.resolve();
    });
    expect(message()).not.toBe('');

    fireEvent.click(screen.getByText('enviar'));

    expect(message()).toBe('');
  });

  it('can be cleared by the screen', async () => {
    const { deferred } = setup();
    fireEvent.click(screen.getByText('enviar'));
    await act(async () => {
      deferred[0]?.reject(new AuthError('network'));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('limpiar'));

    expect(message()).toBe('');
  });

  it('does not touch the screen when it was left before the answer arrived', async () => {
    const { deferred, view } = setup();
    fireEvent.click(screen.getByText('enviar'));
    view.unmount();

    await act(async () => {
      deferred[0]?.reject(new AuthError('network'));
      await Promise.resolve();
    });

    expect(deferred).toHaveLength(1);
  });

  it('tells the screen whether the action went through', async () => {
    const results: boolean[] = [];
    function Probe() {
      const { submit } = useSubmit();
      return (
        <div>
          <button
            type="button"
            onClick={() => void submit(() => Promise.resolve()).then((ok) => results.push(ok))}
          >
            bien
          </button>
          <button
            type="button"
            onClick={() =>
              void submit(() => Promise.reject(new AuthError('network'))).then((ok) =>
                results.push(ok),
              )
            }
          >
            mal
          </button>
        </div>
      );
    }
    render(<Probe />);

    await act(async () => {
      fireEvent.click(screen.getByText('bien'));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(screen.getByText('mal'));
      await Promise.resolve();
    });

    expect(results).toEqual([true, false]);
  });

  it('closes the session when the API says it no longer counts, and keeps it for any other failure', async () => {
    const auth = createTestAuth({ stored: testSession('ana') });
    auth.answer({ identity: { id: 'ana', email: null }, membership: null });
    const results: boolean[] = [];
    function Probe() {
      const { submit } = useSubmit();
      return (
        <div>
          <button
            type="button"
            onClick={() =>
              void submit(() =>
                Promise.reject(
                  new ApiError({
                    class: 'network',
                    status: null,
                    problem: null,
                    retryAfterMs: null,
                  }),
                ),
              ).then((ok) => results.push(ok))
            }
          >
            red
          </button>
          <button
            type="button"
            onClick={() =>
              void submit(() =>
                Promise.reject(
                  new ApiError({
                    class: 'session',
                    status: 401,
                    problem: null,
                    retryAfterMs: null,
                  }),
                ),
              ).then((ok) => results.push(ok))
            }
          >
            sesion
          </button>
        </div>
      );
    }
    render(
      <AuthProvider sessions={auth.sessions} loadMe={auth.loadMe}>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('red'));
      await Promise.resolve();
    });
    expect(auth.sessions.current()).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText('sesion'));
      await Promise.resolve();
    });

    expect(auth.sessions.current()).toBeNull();
    expect(results).toEqual([false, false]);
  });
});
