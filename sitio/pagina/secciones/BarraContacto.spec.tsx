import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FakeIntersectionObserver,
  installIntersectionObserver,
} from '../../../test/support/intersection-observer';
import { contenido } from '../contenido';
import { BarraContacto } from './BarraContacto';

// La barra de abajo (solo en telefono): aparece cuando el hero ya paso, lleva a WhatsApp y se puede cerrar. Si el navegador no
// sabe decir que se ve, no aparece: es mejor no mostrarla que taparle la pantalla a alguien sin poder saber cuando quitarla.
let quitar: () => void;

beforeEach(() => {
  quitar = installIntersectionObserver();
  document.body.insertAdjacentHTML('beforeend', `<div id="${contenido.anclas.inicio}"></div>`);
});

afterEach(() => {
  quitar();
  document.body.innerHTML = '';
});

const hero = (): Element | null => document.getElementById(contenido.anclas.inicio);
const observador = (): FakeIntersectionObserver | undefined => FakeIntersectionObserver.alive()[0];

describe('the contact bar', () => {
  it('is not printed by the server, because nobody knows yet if the hero is on the screen', () => {
    render(<BarraContacto />);

    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('appears when the hero leaves the screen, with the text, the button to WhatsApp and a way to close it', () => {
    render(<BarraContacto />);

    act(() => {
      observador()?.emit([[hero(), false]]);
    });

    const barra = screen.getByRole('complementary', { name: contenido.barraContacto.etiqueta });
    expect(barra.textContent).toContain(contenido.barraContacto.texto);
    const boton = screen.getByRole('link', { name: new RegExp(contenido.barraContacto.boton) });
    expect(boton.getAttribute('href')).toBe(contenido.hero.ctaPrincipal.href);
    expect(boton.getAttribute('target')).toBe('_blank');
    expect(boton.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('button', { name: contenido.barraContacto.cerrar })).toBeDefined();
  });

  it('sticks to the bottom of the screen and is only for the phone', () => {
    render(<BarraContacto />);
    act(() => {
      observador()?.emit([[hero(), false]]);
    });

    const clases = screen.getByRole('complementary').classList;
    expect(clases.contains('fixed')).toBe(true);
    expect(clases.contains('bottom-0')).toBe(true);
    expect(clases.contains('md:hidden')).toBe(true);
  });

  it('goes away when the hero comes back to the screen', () => {
    render(<BarraContacto />);

    act(() => {
      observador()?.emit([[hero(), false]]);
    });
    act(() => {
      observador()?.emit([[hero(), true]]);
    });

    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('closes with its button, and stays closed even if the hero leaves again', () => {
    render(<BarraContacto />);
    act(() => {
      observador()?.emit([[hero(), false]]);
    });

    fireEvent.click(screen.getByRole('button', { name: contenido.barraContacto.cerrar }));
    expect(screen.queryByRole('complementary')).toBeNull();

    act(() => {
      observador()?.emit([[hero(), true]]);
    });
    act(() => {
      observador()?.emit([[hero(), false]]);
    });
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('stops observing when the page goes away', () => {
    const { unmount } = render(<BarraContacto />);
    const o = observador();

    unmount();

    expect(o?.disconnected).toBe(true);
  });

  it('never shows up in a browser that cannot tell what is on the screen', () => {
    quitar();
    const antes = globalThis.IntersectionObserver;
    // @ts-expect-error se quita a proposito para ver que la barra no se muestra
    delete globalThis.IntersectionObserver;
    try {
      render(<BarraContacto />);
      expect(screen.queryByRole('complementary')).toBeNull();
    } finally {
      globalThis.IntersectionObserver = antes;
    }
  });
});
