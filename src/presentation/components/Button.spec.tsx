import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithMotion } from '../../../test/support/render';
import { Button } from './Button';

describe('Button', () => {
  it('shows its label and is a real button, so the keyboard and screen readers work', () => {
    renderWithMotion(<Button onClick={() => undefined}>Cobrar</Button>);

    expect(screen.getByRole('button', { name: 'Cobrar' })).toBeDefined();
  });

  it('calls onClick when it is pressed', () => {
    const onClick = vi.fn();
    renderWithMotion(<Button onClick={onClick}>Cobrar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Cobrar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is at least 44 px tall and wide, the minimum touch target (ADR 0008)', () => {
    renderWithMotion(<Button onClick={() => undefined}>Ok</Button>);

    const classes = screen.getByRole('button', { name: 'Ok' }).className.split(/\s+/);
    expect(classes).toContain('min-h-touch');
    expect(classes).toContain('min-w-touch');
  });

  it('shows a focus ring for the keyboard, using the focus color of the theme', () => {
    renderWithMotion(<Button onClick={() => undefined}>Ok</Button>);

    const classes = screen.getByRole('button', { name: 'Ok' }).className;
    expect(classes).toContain('focus-visible:outline');
    expect(classes).toContain('outline-focus');
  });
});
