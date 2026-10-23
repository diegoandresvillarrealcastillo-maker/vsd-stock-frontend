import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestMascotsPreference } from '../../../test/support/mascots';
import { MascotaDePantalla } from './MascotaDePantalla';
import { MascotasProvider } from './MascotasProvider';

function mount(
  ui: React.ReactElement,
  options?: Parameters<typeof createTestMascotsPreference>[0],
) {
  const { preference } = createTestMascotsPreference(options);
  const view = render(<MascotasProvider preference={preference}>{ui}</MascotasProvider>);
  return { preference, ...view };
}

describe('MascotaDePantalla', () => {
  it('shows the character in that state, saying who it is and what it is doing', () => {
    mount(<MascotaDePantalla personaje="ori" estado="dormida" />);

    const imagen = screen.getByRole('img', { name: 'Ori, durmiendo' });
    expect(imagen.getAttribute('src')).toContain('ori-dormida');
  });

  it('shows the three characters the app uses, each in a state that is already true', () => {
    mount(
      <>
        <MascotaDePantalla personaje="ori" estado="normal" />
        <MascotaDePantalla personaje="gato" estado="feliz" />
        <MascotaDePantalla personaje="fungito" estado="dormida" />
      </>,
    );

    expect(screen.getByRole('img', { name: 'Ori, con gesto tranquilo' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Ojo de Gato, feliz' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Fungito, durmiendo' })).toBeTruthy();
  });

  it('is 64 pixels by default: a quarter of the art, sharp on screens with double density and small enough for a phone', () => {
    mount(<MascotaDePantalla personaje="gato" estado="normal" />);

    const imagen = screen.getByRole('img');
    expect(imagen.getAttribute('width')).toBe('64');
    expect(imagen.getAttribute('height')).toBe('64');
  });

  it('loads only when it is near the screen: the sprite is not worth holding the page for', () => {
    mount(<MascotaDePantalla personaje="gato" estado="normal" />);

    expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
  });

  it('keeps the class the screen gives it next to its own, so the CSS can move it or leave it still', () => {
    mount(<MascotaDePantalla personaje="gato" estado="normal" className="shrink-0" />);

    const clases = screen.getByRole('img').className.split(' ');
    expect(clases).toContain('mascota');
    expect(clases).toContain('shrink-0');
  });

  it('shows nothing when the person turned the mascots off', () => {
    const { container } = mount(<MascotaDePantalla personaje="ori" estado="dormida" />, {
      saved: false,
    });

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('goes away and comes back as soon as the person turns them off and on, without reloading', () => {
    const { preference } = mount(<MascotaDePantalla personaje="ori" estado="dormida" />);

    act(() => {
      preference.toggle();
    });
    expect(screen.queryByRole('img')).toBeNull();

    act(() => {
      preference.toggle();
    });
    expect(screen.getByRole('img', { name: 'Ori, durmiendo' })).toBeTruthy();
  });
});
