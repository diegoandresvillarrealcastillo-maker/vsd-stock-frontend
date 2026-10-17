import { describe, expect, it } from 'vitest';
import { createIconSwap, createPulse, createReveal, createStagger, createTap } from './presets';
import { durations, eases } from './tokens';

// ADR 0008: solo se anima transform y opacity (x, y, scale y rotate son
// transform en Framer), y con movimiento reducido se cambia por un fundido o
// por nada. Estas pruebas fijan esas dos reglas para todo lo que salga de aqui.
const ANIMATABLE = new Set(['opacity', 'x', 'y', 'scale', 'rotate']);

/** Propiedades que un estado anima, sin contar la configuracion de la transicion. */
function animatedProperties(state: object): string[] {
  return Object.keys(state).filter((key) => key !== 'transition');
}

describe('createReveal', () => {
  describe('with full motion', () => {
    const reveal = createReveal(false);

    it('enters rising a few pixels while it fades in', () => {
      expect(reveal.hidden).toMatchObject({ opacity: 0 });
      expect(reveal.visible).toMatchObject({ opacity: 1, y: 0 });
      expect(reveal.hidden).toHaveProperty('y');
      expect((reveal.hidden as { y: number }).y).toBeGreaterThan(0);
    });

    it('leaves fading out', () => {
      expect(reveal.exit).toMatchObject({ opacity: 0 });
    });

    it('uses the base duration and the standard curve of the design tokens', () => {
      expect(reveal.visible).toMatchObject({
        transition: { duration: durations.base, ease: [...eases.standard] },
      });
    });
  });

  describe('with reduced motion', () => {
    const reveal = createReveal(true);

    it('replaces the rise with a plain fade: it only animates opacity', () => {
      expect(animatedProperties(reveal.hidden as object)).toEqual(['opacity']);
      expect(animatedProperties(reveal.visible as object)).toEqual(['opacity']);
      expect(animatedProperties(reveal.exit as object)).toEqual(['opacity']);
    });

    it('uses the fast duration, so the change is still visible but quick', () => {
      expect(reveal.visible).toMatchObject({ transition: { duration: durations.fast } });
    });
  });

  it.each([false, true])(
    'only animates transform and opacity (reduced motion: %s)',
    (reducedMotion) => {
      const reveal = createReveal(reducedMotion);

      for (const state of [reveal.hidden, reveal.visible, reveal.exit]) {
        const outsideTheRule = animatedProperties(state as object).filter(
          (property) => !ANIMATABLE.has(property),
        );
        expect(outsideTheRule).toEqual([]);
      }
    },
  );
});

describe('createPulse', () => {
  it('fades the skeleton in and out forever with full motion', () => {
    const pulse = createPulse(false);

    expect(pulse).toBeDefined();
    expect(animatedProperties(pulse!)).toEqual(['opacity']);
    expect(pulse).toMatchObject({ transition: { repeat: Infinity, duration: durations.pulse } });
  });

  it('does not animate the skeleton with reduced motion', () => {
    expect(createPulse(true)).toBeUndefined();
  });
});

describe('createTap', () => {
  it('presses the element slightly with full motion', () => {
    const tap = createTap(false);

    expect(tap).toBeDefined();
    expect(animatedProperties(tap!)).toEqual(['scale']);
    expect((tap as { scale: number }).scale).toBeLessThan(1);
  });

  it('does nothing with reduced motion', () => {
    expect(createTap(true)).toBeUndefined();
  });
});

describe('createIconSwap', () => {
  describe('with full motion', () => {
    const swap = createIconSwap(false);

    it('enters turning and growing while it fades in, and leaves turning the other way', () => {
      const hidden = swap.hidden as { opacity: number; rotate: number; scale: number };
      const visible = swap.visible as { opacity: number; rotate: number; scale: number };
      const exit = swap.exit as { opacity: number; rotate: number; scale: number };

      expect(hidden.opacity).toBe(0);
      expect(hidden.rotate).toBeLessThan(0);
      expect(hidden.scale).toBeLessThan(1);
      expect(visible).toMatchObject({ opacity: 1, rotate: 0, scale: 1 });
      expect(exit.opacity).toBe(0);
      expect(exit.rotate).toBeGreaterThan(0);
    });

    it('is quick: the base duration at most, so the toggle never feels slow', () => {
      const transition = (swap.visible as { transition: { duration: number } }).transition;

      expect(transition.duration).toBeLessThanOrEqual(durations.base);
    });
  });

  it('only fades with reduced motion: no turning, no scaling', () => {
    const swap = createIconSwap(true);

    for (const state of [swap.hidden, swap.visible, swap.exit]) {
      expect(animatedProperties(state as object)).toEqual(['opacity']);
    }
  });

  it.each([false, true])(
    'only animates transform and opacity (reduced motion: %s)',
    (reducedMotion) => {
      const swap = createIconSwap(reducedMotion);

      for (const state of [swap.hidden, swap.visible, swap.exit]) {
        const outsideTheRule = animatedProperties(state as object).filter(
          (property) => !ANIMATABLE.has(property),
        );
        expect(outsideTheRule).toEqual([]);
      }
    },
  );
});

describe('createStagger', () => {
  it('delays each child a little after the previous one with full motion', () => {
    const stagger = createStagger(false);
    const transition = (stagger.visible as { transition: { staggerChildren: number } }).transition;

    expect(transition.staggerChildren).toBeGreaterThan(0);
  });

  it('keeps the whole list quick: three rows must not take more than a base duration to start', () => {
    const stagger = createStagger(false);
    const { staggerChildren } = (stagger.visible as { transition: { staggerChildren: number } })
      .transition;

    expect(staggerChildren * 3).toBeLessThanOrEqual(durations.base);
  });

  it('does not stagger with reduced motion: everything fades together', () => {
    const stagger = createStagger(true);
    const transition = (stagger.visible as { transition: { staggerChildren: number } }).transition;

    expect(transition.staggerChildren).toBe(0);
  });

  it.each([false, true])(
    'does not animate any property by itself (reduced motion: %s)',
    (reducedMotion) => {
      const stagger = createStagger(reducedMotion);

      for (const state of [stagger.hidden, stagger.visible, stagger.exit]) {
        expect(animatedProperties(state as object)).toEqual([]);
      }
    },
  );
});
