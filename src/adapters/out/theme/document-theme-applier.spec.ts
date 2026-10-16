import { describe, expect, it } from 'vitest';
import { DocumentThemeApplier } from './document-theme-applier';

describe('DocumentThemeApplier', () => {
  it('marks the root element with the theme, which is what the CSS tokens read', () => {
    const root = document.createElement('html');

    new DocumentThemeApplier(root).apply('dark');

    expect(root.dataset['theme']).toBe('dark');
  });

  it('replaces the previous theme instead of adding to it', () => {
    const root = document.createElement('html');
    const applier = new DocumentThemeApplier(root);

    applier.apply('dark');
    applier.apply('light');

    expect(root.dataset['theme']).toBe('light');
  });
});
