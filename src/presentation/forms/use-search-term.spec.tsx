import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSearchTerm } from './use-search-term';

function Harness({ delayMs }: { delayMs?: number }) {
  const { term, setTerm, search, submit } = useSearchTerm(delayMs);
  return (
    <div>
      <input aria-label="texto" value={term} onChange={(event) => setTerm(event.target.value)} />
      <p data-testid="busqueda">[{search}]</p>
      <button type="button" onClick={submit}>
        buscar ya
      </button>
    </div>
  );
}

const searched = () => screen.getByTestId('busqueda').textContent;
const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('texto'), { target: { value } });
const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('useSearchTerm', () => {
  it('starts with nothing to search', () => {
    render(<Harness />);

    expect(searched()).toBe('[]');
  });

  it('searches what was typed once the person stops typing for 300 ms, trimmed', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    type('  arroz ');
    await wait(299);
    expect(searched()).toBe('[]');
    await wait(1);

    expect(searched()).toBe('[arroz]');
  });

  it('waits the delay it is given', async () => {
    vi.useFakeTimers();
    render(<Harness delayMs={1000} />);

    type('a');
    await wait(999);
    expect(searched()).toBe('[]');
    await wait(1);

    expect(searched()).toBe('[a]');
  });

  it('searches only the last thing typed: every key starts the wait again', async () => {
    vi.useFakeTimers();
    render(<Harness />);

    type('a');
    await wait(200);
    type('ac');
    await wait(200);
    expect(searched()).toBe('[]');
    await wait(100);

    expect(searched()).toBe('[ac]');
  });

  it('searches right away when the person sends the search', () => {
    vi.useFakeTimers();
    render(<Harness />);
    type('  aceite ');

    fireEvent.click(screen.getByRole('button', { name: 'buscar ya' }));

    expect(searched()).toBe('[aceite]');
  });

  it('keeps what was searched when the timer fires after sending it', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    type('aceite');
    fireEvent.click(screen.getByRole('button', { name: 'buscar ya' }));

    await wait(400);

    expect(searched()).toBe('[aceite]');
  });
});
