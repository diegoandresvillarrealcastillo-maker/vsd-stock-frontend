import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Mascota } from './Mascota';

describe('Mascota', () => {
  it('shows the sprite of the character in that state', () => {
    render(<Mascota personaje="ori" estado="dormida" />);

    expect(screen.getByRole('img').getAttribute('src')).toContain('ori-dormida');
  });

  it('says in its alternative text who it is and what it is doing, so the state does not live only in the drawing', () => {
    render(<Mascota personaje="ori" estado="dormida" />);

    expect(screen.getByRole('img', { name: 'Ori, durmiendo' })).toBeTruthy();
  });

  it('is 128 pixels by default, which is exactly half of the art: sharp on screens with double density', () => {
    render(<Mascota personaje="gato" estado="feliz" />);

    const imagen = screen.getByRole('img');
    expect(imagen.getAttribute('width')).toBe('128');
    expect(imagen.getAttribute('height')).toBe('128');
  });

  it('takes another size and keeps it square', () => {
    render(<Mascota personaje="gato" estado="feliz" tamano={192} />);

    const imagen = screen.getByRole('img');
    expect(imagen.getAttribute('width')).toBe('192');
    expect(imagen.getAttribute('height')).toBe('192');
  });

  it('loads late and decodes apart, so a sprite below the fold does not hold the page', () => {
    render(<Mascota personaje="fungito" estado="normal" />);

    const imagen = screen.getByRole('img');
    expect(imagen.getAttribute('loading')).toBe('lazy');
    expect(imagen.getAttribute('decoding')).toBe('async');
  });

  it('can load at once when it is the first thing on the screen', () => {
    render(<Mascota personaje="fungito" estado="normal" inmediata />);

    expect(screen.getByRole('img').getAttribute('loading')).toBe('eager');
  });

  it('names its state in the markup, so the CSS can move it or leave it still', () => {
    render(<Mascota personaje="obsidian" estado="celebrando" />);

    const imagen = screen.getByRole('img');
    expect(imagen.getAttribute('data-estado')).toBe('celebrando');
    expect(imagen.className).toContain('mascota');
  });

  it('adds the class the screen asks for without losing its own', () => {
    render(<Mascota personaje="sparky" estado="normal" className="mx-auto" />);

    const clases = screen.getByRole('img').className.split(' ');
    expect(clases).toContain('mascota');
    expect(clases).toContain('mx-auto');
  });

  it('cannot be dragged away from the page like a loose picture', () => {
    render(<Mascota personaje="sparky" estado="normal" />);

    expect(screen.getByRole('img').getAttribute('draggable')).toBe('false');
  });
});
