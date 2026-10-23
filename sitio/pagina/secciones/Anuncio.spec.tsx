import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { contenido } from '../contenido';
import { Anuncio } from './Anuncio';

// axe marca como «region» todo texto que queda fuera de un punto de referencia (landmark): la franja de arriba estaba suelta, antes de
// la cabecera. Es un aviso aparte del contenido, asi que es un punto de referencia complementario con nombre.
const { anuncio } = contenido;

describe('the announcement bar', () => {
  it('is a landmark of its own with a name, so a screen reader can reach it and nothing is left outside a landmark', () => {
    render(<Anuncio />);

    const aviso = screen.getByRole('complementary', { name: anuncio.nombre });
    expect(within(aviso).getByText(anuncio.texto)).toBeTruthy();
    expect(within(aviso).getByText(anuncio.etiqueta)).toBeTruthy();
  });

  it('keeps the link to WhatsApp inside the landmark', () => {
    render(<Anuncio />);

    const aviso = screen.getByRole('complementary', { name: anuncio.nombre });
    const enlace = within(aviso).getByRole('link', { name: new RegExp(anuncio.enlace.texto) });
    expect(enlace.getAttribute('href')).toBe(anuncio.enlace.href);
  });
});
