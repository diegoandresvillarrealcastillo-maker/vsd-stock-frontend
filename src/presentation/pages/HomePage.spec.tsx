import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('shows the product name as the main heading of the page', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'VSD Stock' })).toBeDefined();
  });

  it('puts its content inside the main landmark, so a screen reader can jump to it', () => {
    render(<HomePage />);

    const main = screen.getByRole('main');
    expect(main.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });

  it('tells the person, in Spanish, that the first version is being built', () => {
    render(<HomePage />);

    expect(screen.getByText(/estamos construyendo la primera versión/i)).toBeDefined();
  });
});
