import { describe, expect, it } from 'vitest';
import { createPulse, createReveal, createTap } from './presets';
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
