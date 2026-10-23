import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestMascotsPreference } from '../../../test/support/mascots';
import { MascotasProvider } from '../mascotas/MascotasProvider';
import { MotionProvider } from '../motion/MotionProvider';
import { MascotasToggle } from './MascotasToggle';

function mount(options?: Parameters<typeof createTestMascotsPreference>[0]) {
  const { preference, savedValue } = createTestMascotsPreference(options);
  const view = render(
    <MotionProvider>
      <MascotasProvider preference={preference}>
        <MascotasToggle />
      </MascotasProvider>
    </MotionProvider>,
  );
  return { preference, savedValue, ...view };
}

const button = () => screen.getByRole('button', { name: 'Mostrar mascotas' });

describe('MascotasToggle', () => {
  it('is pressed while the mascots are on: its name is the same either way and the state is in aria-pressed', () => {
    mount();

    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('is not pressed once the person turned them off', () => {
    mount({ saved: false });

    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('turns them off when it is pressed, and the person is not asked to confirm anything', () => {
    const { preference } = mount();

    fireEvent.click(button());

    expect(preference.enabled()).toBe(false);
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('remembers the choice so the mascots stay off the next time the app opens', () => {
    const { savedValue } = mount();

    fireEvent.click(button());

    expect(savedValue()).toBe(false);
  });

  it('turns them back on with a second press', () => {
    const { preference } = mount({ saved: false });

    fireEvent.click(button());

    expect(preference.enabled()).toBe(true);
    expect(button().getAttribute('aria-pressed')).toBe('true');
  });

  it('is a real button that does not submit anything', () => {
    mount();

    expect(button().getAttribute('type')).toBe('button');
  });

  it('is at least 44 px tall and wide, the minimum touch target (ADR 0008)', () => {
    mount();

    const classes = button().className.split(/\s+/);
    expect(classes).toContain('min-h-touch');
    expect(classes).toContain('min-w-touch');
  });

  it('shows a focus ring for the keyboard, using the focus color of the theme', () => {
    mount();

    const classes = button().className;
    expect(classes).toContain('focus-visible:outline');
    expect(classes).toContain('outline-focus');
  });

  it('keeps its icon out of the accessibility tree: the name of the button says it all', () => {
    const { container } = mount();

    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(1);
    expect(icons[0]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws another icon when they are off, so the state is not only a color', () => {
    const { container } = mount();
    const on = container.querySelector('svg')?.innerHTML;

    fireEvent.click(button());

    expect(container.querySelector('svg')?.innerHTML).not.toBe(on);
  });
});
