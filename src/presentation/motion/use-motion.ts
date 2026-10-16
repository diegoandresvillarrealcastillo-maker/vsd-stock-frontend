import { useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';
import { createPulse, createReveal, createTap } from './presets';

// Hooks que unen la preferencia de movimiento de la persona con los presets.
// Toda animacion de la interfaz pasa por aqui, por eso `useReducedMotion` se
// respeta siempre (ADR 0008) sin que cada componente se acuerde de pedirlo.

/**
 * La persona pidio menos movimiento en su sistema. Framer devuelve `null` solo
 * cuando no puede consultar al navegador (renderizado en servidor), caso en
 * que no hay preferencia conocida y se usa el movimiento normal.
 */
function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

/** Variantes de entrada y salida, ya adaptadas a la preferencia de movimiento. */
export function useReveal() {
  const reducedMotion = usePrefersReducedMotion();
  return useMemo(() => createReveal(reducedMotion), [reducedMotion]);
}

/** Animacion del pulso del skeleton, o `undefined` si la persona pidio menos movimiento. */
export function usePulse() {
  const reducedMotion = usePrefersReducedMotion();
  return useMemo(() => createPulse(reducedMotion), [reducedMotion]);
}

/** Gesto de presionar, o `undefined` si la persona pidio menos movimiento. */
export function useTap() {
  const reducedMotion = usePrefersReducedMotion();
  return useMemo(() => createTap(reducedMotion), [reducedMotion]);
}
