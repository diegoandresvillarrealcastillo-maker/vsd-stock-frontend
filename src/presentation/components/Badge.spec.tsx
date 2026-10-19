import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('writes what it says, so the color never carries the meaning alone', () => {
    render(<Badge tone="success">Enviada</Badge>);

    expect(screen.getByText('Enviada')).toBeTruthy();
  });

  it('paints a success in the success color, with a border of the same color', () => {
    render(<Badge tone="success">Enviada</Badge>);

    const badge = screen.getByText('Enviada');
    expect(badge.className).toContain('text-success');
    expect(badge.className).toContain('border-success');
  });

  it('is neutral when no tone is given', () => {
    render(<Badge>Cajero</Badge>);

    expect(screen.getByText('Cajero').className).toContain('text-fg');
    expect(screen.getByText('Cajero').className).not.toContain('text-success');
  });
});
