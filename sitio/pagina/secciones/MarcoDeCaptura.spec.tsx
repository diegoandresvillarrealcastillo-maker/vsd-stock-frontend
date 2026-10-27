import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CAPTURAS } from '../capturas';
import { contenido } from '../contenido';
import { MarcoDeCaptura } from './MarcoDeCaptura';

// El marco que enseña una captura de la aplicación dentro de un teléfono o de un computador. Lo dibuja el CSS (no pesa nada en la red):
// aquí se vigila lo que no se ve y se rompe sin que nadie lo note, la descripción de la imagen, el espacio que se le reserva y cuándo carga.
describe('the frame of a screenshot', () => {
  it('shows the screenshot with its description, which comes from the content, and the size of the file', () => {
    render(<MarcoDeCaptura id="vender" tipo="telefono" />);
    const imagen = screen.getByRole('img', { name: contenido.capturas.vender });

    expect(imagen.getAttribute('src')).toBe(CAPTURAS.vender.src);
    expect(imagen.getAttribute('width')).toBe(String(CAPTURAS.vender.ancho));
    expect(imagen.getAttribute('height')).toBe(String(CAPTURAS.vender.alto));
  });

  it('loads late and decodes apart by default, and at once only when it is told it is what is seen first', () => {
    const { rerender } = render(<MarcoDeCaptura id="cierre" tipo="telefono" />);
    expect(screen.getByRole('img').getAttribute('loading')).toBe('lazy');
    expect(screen.getByRole('img').getAttribute('decoding')).toBe('async');
    expect(screen.getByRole('img').getAttribute('fetchpriority')).toBeNull();

    rerender(<MarcoDeCaptura id="cierre" tipo="telefono" prioritaria />);
    expect(screen.getByRole('img').getAttribute('loading')).toBeNull();
    expect(screen.getByRole('img').getAttribute('decoding')).toBe('async');
    expect(screen.getByRole('img').getAttribute('fetchpriority')).toBe('high');
  });

  it('says which kind of device it draws, so the CSS gives it the proportions of a phone or of a laptop', () => {
    const { container, rerender } = render(<MarcoDeCaptura id="vender" tipo="telefono" />);
    expect(container.firstElementChild?.getAttribute('data-marco')).toBe('telefono');

    rerender(<MarcoDeCaptura id="existencias" tipo="computador" />);
    expect(container.firstElementChild?.getAttribute('data-marco')).toBe('computador');
  });

  it('leaves the frame out of the reading: only the screenshot is read', () => {
    const { container } = render(<MarcoDeCaptura id="reporte" tipo="computador" />);

    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(container.textContent).toBe('');
  });
});
