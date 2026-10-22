import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../../test/support/render';
import { createTestThemePreference } from '../../../test/support/theme';
import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('names the action it will do in the light theme: switch to dark', () => {
    const { preference } = createTestThemePreference({ saved: 'light' });
    renderWithProviders(<ThemeToggle />, { theme: preference });

    expect(screen.getByRole('button', { name: 'Cambiar a tema oscuro' })).toBeDefined();
  });

  it('names the action it will do in the dark theme: switch to light', () => {
    const { preference } = createTestThemePreference({ saved: 'dark' });
    renderWithProviders(<ThemeToggle />, { theme: preference });

    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
  });

  it('changes the theme when it is pressed, and the name changes with it', () => {
    const { preference } = createTestThemePreference({ saved: 'light' });
    renderWithProviders(<ThemeToggle />, { theme: preference });

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));

    expect(preference.current()).toBe('dark');
    expect(screen.getByRole('button', { name: 'Cambiar a tema claro' })).toBeDefined();
  });

  it('is a real button that does not submit anything', () => {
    const { preference } = createTestThemePreference();
    renderWithProviders(<ThemeToggle />, { theme: preference });

    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });

  it('is at least 44 px tall and wide, the minimum touch target (ADR 0008)', () => {
    const { preference } = createTestThemePreference();
    renderWithProviders(<ThemeToggle />, { theme: preference });

    const classes = screen.getByRole('button').className.split(/\s+/);
    expect(classes).toContain('min-h-touch');
    expect(classes).toContain('min-w-touch');
  });

  it('shows a focus ring for the keyboard, using the focus color of the theme', () => {
    const { preference } = createTestThemePreference();
    renderWithProviders(<ThemeToggle />, { theme: preference });

    const classes = screen.getByRole('button').className;
    expect(classes).toContain('focus-visible:outline');
    expect(classes).toContain('outline-focus');
  });

  it('keeps its icon out of the accessibility tree: the name of the button says it all', () => {
    const { preference } = createTestThemePreference();
    const { container } = renderWithProviders(<ThemeToggle />, { theme: preference });

    const icon = container.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows one icon at a time, also while swapping them', async () => {
    const { preference } = createTestThemePreference({ saved: 'light' });
    const { container } = renderWithProviders(<ThemeToggle />, { theme: preference });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(container.querySelectorAll('svg')).toHaveLength(1);
    });
  });
});
