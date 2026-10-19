import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { FakeShifts, openState } from '../../../test/support/shifts';
import { ShiftProvider, useShift } from './ShiftProvider';

function Probe() {
  const { state, open, close, refresh } = useShift();
  return (
    <>
      <p data-testid="estado">{state.status}</p>
      <button type="button" onClick={() => void open(50_000)}>
        abrir
      </button>
      <button type="button" onClick={() => void close(48_000)}>
        cerrar
      </button>
      <button type="button" onClick={refresh}>
        releer
      </button>
    </>
  );
}

const mount = (shifts: FakeShifts, strict = false) => {
  const tree = (
    <ShiftProvider shifts={shifts}>
      <Probe />
    </ShiftProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe('ShiftProvider', () => {
  it('starts the shift when the interface appears and stops it when it goes away', () => {
    const shifts = new FakeShifts();

    const { unmount } = mount(shifts);
    expect(shifts.starts).toBe(1);
    expect(shifts.stops).toBe(0);

    unmount();
    expect(shifts.stops).toBe(1);
  });

  it('can be started twice in a row (the development double mount) and ends up with one watch', () => {
    const shifts = new FakeShifts();

    mount(shifts, true);

    expect(shifts.starts - shifts.stops).toBe(1);
    expect(shifts.subscribers).toBe(1);
  });

  it('shows what the shift says and every change at once', () => {
    const shifts = new FakeShifts();
    mount(shifts);
    expect(screen.getByTestId('estado').textContent).toBe('none');

    act(() => {
      shifts.set(openState());
    });

    expect(screen.getByTestId('estado').textContent).toBe('open');
  });

  it('opens and closes with what it is given, and reads again when asked', () => {
    const shifts = new FakeShifts();
    mount(shifts);

    act(() => {
      screen.getByRole('button', { name: 'abrir' }).click();
      screen.getByRole('button', { name: 'cerrar' }).click();
      screen.getByRole('button', { name: 'releer' }).click();
    });

    expect(shifts.opened).toEqual([50_000]);
    expect(shifts.closed).toEqual([48_000]);
    expect(shifts.refreshes).toBe(1);
  });

  it('stops listening to the shift when it goes away', () => {
    const shifts = new FakeShifts();
    const { unmount } = mount(shifts);
    expect(shifts.subscribers).toBe(1);

    unmount();

    expect(shifts.subscribers).toBe(0);
  });

  it('refuses to be used outside the provider, saying where it goes', () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow('useShift debe usarse dentro de <ShiftProvider>');
    } finally {
      console.error = quiet;
    }
  });
});
