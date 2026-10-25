import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createTestMascotsPreference } from '../../../test/support/mascots';
import { MascotasProvider, useMascotas } from './MascotasProvider';

function setup(options?: Parameters<typeof createTestMascotsPreference>[0]) {
  const { preference } = createTestMascotsPreference(options);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MascotasProvider preference={preference}>{children}</MascotasProvider>
  );
  return { preference, ...renderHook(() => useMascotas(), { wrapper }) };
}

describe('useMascotas', () => {
  it('says the mascots are on when the person never chose', () => {
    const { result } = setup();

    expect(result.current.activas).toBe(true);
  });

  it('says they are off when the person turned them off', () => {
    const { result } = setup({ saved: false });

    expect(result.current.activas).toBe(false);
  });

  it('turns them off with alternar and renders again with the new value', () => {
    const { result } = setup();

    act(() => {
      result.current.alternar();
    });

    expect(result.current.activas).toBe(false);
  });

  it('renders again when the value changes from outside the interface', () => {
    const { result, preference } = setup();

    act(() => {
      preference.toggle();
    });

    expect(result.current.activas).toBe(false);
  });

  it('fails with a clear message when it is used outside the provider', () => {
    expect(() => renderHook(() => useMascotas())).toThrow(/MascotasProvider/);
  });
});
