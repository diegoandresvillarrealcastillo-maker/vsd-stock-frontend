import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setPrefersReducedMotion } from '../../../test/support/match-media';
import { useIconSwap, useStagger } from './use-motion';

// Los hooks son lo unico que consulta la preferencia de movimiento del sistema
// (ADR 0008). Se prueban con el matchMedia de test/support, que imita al del navegador.
describe('useIconSwap', () => {
  it('turns the icon with full motion', () => {
    const { result } = renderHook(() => useIconSwap());

    expect(result.current.hidden).toHaveProperty('rotate');
  });

  it('only fades the icon when the person asked for reduced motion', () => {
    setPrefersReducedMotion(true);
    const { result } = renderHook(() => useIconSwap());

    expect(Object.keys(result.current.hidden as object)).toEqual(['opacity']);
  });
});

describe('useStagger', () => {
  it('staggers the children with full motion', () => {
    const { result } = renderHook(() => useStagger());

    expect(
      (result.current.visible as { transition: { staggerChildren: number } }).transition
        .staggerChildren,
    ).toBeGreaterThan(0);
  });

  it('does not stagger when the person asked for reduced motion', () => {
    setPrefersReducedMotion(true);
    const { result } = renderHook(() => useStagger());

    expect(
      (result.current.visible as { transition: { staggerChildren: number } }).transition
        .staggerChildren,
    ).toBe(0);
  });
});
