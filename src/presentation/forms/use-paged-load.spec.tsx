import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Page } from '../../domain/model/page';
import { usePagedLoad } from './use-paged-load';

interface Asked {
  cursor: string | undefined;
  resolve: (page: Page<string>) => void;
  reject: (error: unknown) => void;
}

function Harness({ asked, term }: { asked: Asked[]; term?: string }) {
  const { state, reload } = usePagedLoad(
    (cursor) =>
      new Promise<Page<string>>((resolve, reject) => {
        asked.push({ cursor, resolve, reject });
      }),
    [term],
  );
  return (
    <div>
      <p data-testid="estado">{state.status}</p>
      <p data-testid="items">{state.status === 'ready' ? state.items.join(',') : ''}</p>
      <p data-testid="mas">{state.status === 'ready' ? String(state.hasMore) : ''}</p>
      <p data-testid="cargando-mas">{state.status === 'ready' ? String(state.loadingMore) : ''}</p>
      <p data-testid="problema-mas">
        {state.status === 'ready' ? (state.moreProblem?.message ?? '') : ''}
      </p>
      <button type="button" onClick={() => state.status === 'ready' && state.loadMore()}>
        más
      </button>
      <button type="button" onClick={reload}>
        otra vez
      </button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const page = (items: string[], nextCursor: string | null = null): Page<string> => ({
  items,
  nextCursor,
});

async function answer(entry: Asked | undefined, value: Page<string>) {
  await act(async () => {
    entry?.resolve(value);
    await Promise.resolve();
  });
}

describe('usePagedLoad', () => {
  it('asks for the first page with no cursor and shows it', async () => {
    const asked: Asked[] = [];
    render(<Harness asked={asked} />);
    expect(text('estado')).toBe('loading');

    await answer(asked[0], page(['a', 'b'], 'c1'));

    expect(asked.map((entry) => entry.cursor)).toEqual([undefined]);
    expect(text('estado')).toBe('ready');
    expect(text('items')).toBe('a,b');
    expect(text('mas')).toBe('true');
  });

  it('adds each page after the ones already shown, in the order they arrive', async () => {
    const asked: Asked[] = [];
    render(<Harness asked={asked} />);
    await answer(asked[0], page(['a'], 'c1'));

    fireEvent.click(screen.getByRole('button', { name: 'más' }));
    await answer(asked[1], page(['b'], 'c2'));
    fireEvent.click(screen.getByRole('button', { name: 'más' }));
    await answer(asked[2], page(['c'], null));

    expect(asked.map((entry) => entry.cursor)).toEqual([undefined, 'c1', 'c2']);
    expect(text('items')).toBe('a,b,c');
    expect(text('mas')).toBe('false');
  });

  it('says it is loading more while the next page is on its way, and only asks once', async () => {
    const asked: Asked[] = [];
    render(<Harness asked={asked} />);
    await answer(asked[0], page(['a'], 'c1'));

    fireEvent.click(screen.getByRole('button', { name: 'más' }));
    fireEvent.click(screen.getByRole('button', { name: 'más' }));

    expect(text('cargando-mas')).toBe('true');
    expect(asked).toHaveLength(2);
    await answer(asked[1], page(['b'], null));
    expect(text('cargando-mas')).toBe('false');
  });

  it('does not ask for more when there is no more', async () => {
    const asked: Asked[] = [];
    render(<Harness asked={asked} />);
    await answer(asked[0], page(['a'], null));

    fireEvent.click(screen.getByRole('button', { name: 'más' }));

    expect(asked).toHaveLength(1);
    expect(text('items')).toBe('a');
  });

  it('keeps what it has and says why when the next page does not arrive', async () => {
    const asked: Asked[] = [];
    render(<Harness asked={asked} />);
    await answer(asked[0], page(['a'], 'c1'));
    fireEvent.click(screen.getByRole('button', { name: 'más' }));

    await act(async () => {
      asked[1]?.reject(
        new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null }),
      );
      await Promise.resolve();
    });

    expect(text('items')).toBe('a');
    expect(text('mas')).toBe('true');
    expect(text('problema-mas')).not.toBe('');
    // Se puede volver a pedir la misma pagina.
    fireEvent.click(screen.getByRole('button', { name: 'más' }));
    expect(asked.map((entry) => entry.cursor)).toEqual([undefined, 'c1', 'c1']);
    expect(text('problema-mas')).toBe('');
  });

  it('forgets what it added when the first page is asked again', async () => {
    const asked: Asked[] = [];
    render(<Harness asked={asked} />);
    await answer(asked[0], page(['a'], 'c1'));
    fireEvent.click(screen.getByRole('button', { name: 'más' }));
    await answer(asked[1], page(['b'], null));
    expect(text('items')).toBe('a,b');

    fireEvent.click(screen.getByRole('button', { name: 'otra vez' }));
    await answer(asked[2], page(['z'], 'd1'));

    expect(text('items')).toBe('z');
    expect(text('mas')).toBe('true');
  });

  it('starts over when what is asked changes', async () => {
    const asked: Asked[] = [];
    const { rerender } = render(<Harness asked={asked} term="x" />);
    await answer(asked[0], page(['a'], 'c1'));
    fireEvent.click(screen.getByRole('button', { name: 'más' }));
    await answer(asked[1], page(['b'], null));

    rerender(<Harness asked={asked} term="y" />);

    expect(text('estado')).toBe('loading');
    await answer(asked[2], page(['n'], null));
    expect(text('items')).toBe('n');
  });
});
