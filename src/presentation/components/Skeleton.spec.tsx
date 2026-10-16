import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setPrefersReducedMotion } from '../../../test/support/match-media';
import { renderWithMotion } from '../../../test/support/render';
import { Skeleton } from './Skeleton';

function renderSkeleton(): HTMLElement {
  renderWithMotion(<Skeleton className="h-4 w-24" />);
  // El bloque no tiene rol ni texto: se hace invisible a los lectores de pantalla.
  return document.querySelector('[aria-hidden="true"]') as HTMLElement;
}

describe('Skeleton', () => {
  it('is hidden from screen readers: it is decoration, the loading message is read elsewhere', () => {
    const block = renderSkeleton();

    expect(block).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the size classes that the screen gives it, so it reproduces the real layout', () => {
    const block = renderSkeleton();

    expect(block.className).toContain('h-4');
    expect(block.className).toContain('w-24');
  });

  it('pulses by fading in and out when the person allows motion', async () => {
    const block = renderSkeleton();

    await waitFor(() => {
      expect(Number(block.style.opacity)).toBeLessThan(1);
    });
  });

  it('stays still when the person asked for reduced motion', async () => {
    setPrefersReducedMotion(true);
    const block = renderSkeleton();

    // Un pulso completo tarda mas que esta espera: si pulsara, ya habria bajado de 1.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(block.style.opacity).toBe('');
  });
});
