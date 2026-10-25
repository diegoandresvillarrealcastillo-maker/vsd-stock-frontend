import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FakeIntersectionObserver,
  installIntersectionObserver,
} from '../../../test/support/intersection-observer';
import { contenido } from '../contenido';
import { Navegacion } from './Navegacion';

// La navegacion flotante: los enlaces de la pagina, el de la seccion que se esta viendo marcado, el boton de tema y el menu del
// telefono. Es un menu de divulgacion (un boton que muestra u oculta la lista), no una ventana: no atrapa el foco, y se cierra con
// Escape o al elegir un enlace.
let quitar: () => void;

beforeEach(() => {
  quitar = installIntersectionObserver();
  document.documentElement.dataset['theme'] = 'light';
  window.localStorage.clear();
  document.body.insertAdjacentHTML(
    'beforeend',
    contenido.navegacion.enlaces.map((e) => `<section id="${e.href.slice(1)}"></section>`).join(''),
  );
});

afterEach(() => {
  quitar();
  document.body.innerHTML = '';
  delete document.documentElement.dataset['theme'];
});

describe('the links of the navigation', () => {
  it('are the ones of the content, in order, and the call to action goes to WhatsApp', () => {
    render(<Navegacion />);
    const nav = screen.getByRole('navigation', { name: contenido.navegacion.principal });

    for (const enlace of contenido.navegacion.enlaces) {
      expect(within(nav).getByRole('link', { name: enlace.texto }).getAttribute('href')).toBe(
        enlace.href,
      );
    }
    const cta = within(nav).getByRole('link', {
      name: new RegExp(contenido.navegacion.cta.texto),
    });
    expect(cta.getAttribute('href')).toBe(contenido.navegacion.cta.href);
    expect(cta.getAttribute('target')).toBe('_blank');
    expect(cta.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('has the logo as a link to the top of the page, with a name that says where it goes', () => {
    render(<Navegacion />);
    const logo = screen.getByRole('link', { name: contenido.navegacion.inicio });

    expect(logo.getAttribute('href')).toBe(`#${contenido.anclas.inicio}`);
    expect(logo.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});

describe('the section that is being seen', () => {
  const vista = (id: string): Element | null => document.getElementById(id);

  it('marks no link while nothing is known, which is how the server prints it', () => {
    render(<Navegacion />);

    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  it('observes every section that the links lead to', () => {
    render(<Navegacion />);
    const observador = FakeIntersectionObserver.alive()[0];

    expect([...(observador?.targets ?? [])].map((t) => t.id)).toEqual(
      contenido.navegacion.enlaces.map((e) => e.href.slice(1)),
    );
  });

  it('marks the link of the section that enters the screen, and only that one', () => {
    render(<Navegacion />);
    const observador = FakeIntersectionObserver.alive()[0];
    const funciones = contenido.anclas.funciones;

    act(() => {
      observador?.emit([[vista(funciones), true]]);
    });

    const marcados = [...document.querySelectorAll('nav a[aria-current]')];
    expect(marcados).toHaveLength(1);
    expect(marcados[0]?.getAttribute('href')).toBe(`#${funciones}`);
    expect(marcados[0]?.getAttribute('aria-current')).toBe('location');
  });

  it('moves the mark when the section leaves, and unmarks everything when none is left', () => {
    render(<Navegacion />);
    const observador = FakeIntersectionObserver.alive()[0];
    const [primera, segunda] = contenido.navegacion.enlaces.map((e) => e.href.slice(1));

    act(() => {
      observador?.emit([[vista(primera ?? ''), true]]);
    });
    act(() => {
      observador?.emit([[vista(segunda ?? ''), true]]);
    });
    expect(document.querySelector('nav a[aria-current]')?.getAttribute('href')).toBe(
      `#${primera ?? ''}`,
    );
    act(() => {
      observador?.emit([[vista(primera ?? ''), false]]);
    });
    expect(document.querySelector('nav a[aria-current]')?.getAttribute('href')).toBe(
      `#${segunda ?? ''}`,
    );
    act(() => {
      observador?.emit([[vista(segunda ?? ''), false]]);
    });
    expect(document.querySelectorAll('nav a[aria-current]')).toHaveLength(0);
  });

  it('only looks at a thin band in the middle of the screen, so the section that is marked is the one that is being read', () => {
    render(<Navegacion />);
    const margen = FakeIntersectionObserver.alive()[0]?.options?.rootMargin ?? '';
    const [arriba, , abajo] = margen.split(' ').map((parte) => Number.parseInt(parte, 10));
    const franja = 100 + (arriba ?? 0) + (abajo ?? 0);

    expect(arriba).toBeLessThan(0);
    expect(abajo).toBeLessThan(0);
    expect(franja).toBeGreaterThan(0);
    expect(franja).toBeLessThanOrEqual(20);
  });

  it('stops observing when the page goes away', () => {
    const { unmount } = render(<Navegacion />);
    const observador = FakeIntersectionObserver.alive()[0];

    unmount();

    expect(observador?.disconnected).toBe(true);
  });

  it('still works in a browser without IntersectionObserver: it just marks nothing', () => {
    quitar();
    const antes = globalThis.IntersectionObserver;
    // @ts-expect-error se quita a proposito para ver que la navegacion no se rompe
    delete globalThis.IntersectionObserver;
    try {
      render(<Navegacion />);
      expect(
        screen.getByRole('navigation', { name: contenido.navegacion.principal }),
      ).toBeDefined();
    } finally {
      globalThis.IntersectionObserver = antes;
    }
  });
});

// El menu se oculta con CSS (`data-abierto`) y no con el atributo `hidden`: el `hidden` de Tailwind lleva `!important` y no deja
// que la lista vuelva a verse en escritorio, donde no hay boton ni menu que abrir.
describe('the menu of the phone', () => {
  const lista = (): HTMLElement =>
    within(screen.getByRole('navigation', { name: contenido.navegacion.principal })).getByRole(
      'list',
    );

  it('starts closed, opens with its button and says so to readers of screens', () => {
    render(<Navegacion />);
    const boton = screen.getByRole('button', { name: contenido.navegacion.abrirMenu });

    expect(boton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(boton);

    const abierto = screen.getByRole('button', { name: contenido.navegacion.cerrarMenu });
    expect(abierto.getAttribute('aria-expanded')).toBe('true');
    expect(abierto.getAttribute('aria-controls')).toBe(lista().id);
    expect(lista().dataset['abierto']).toBe('true');
  });

  it('keeps the list closed until the button is pressed, and the button points at it', () => {
    render(<Navegacion />);
    const boton = screen.getByRole('button', { name: contenido.navegacion.abrirMenu });

    expect(lista().dataset['abierto']).toBe('false');
    expect(boton.getAttribute('aria-controls')).toBe(lista().id);
    expect(lista().id).not.toBe('');
  });

  it('always shows the list from the tablet size up, and hides it on the phone only while it is closed', () => {
    render(<Navegacion />);
    const clases = lista().classList;

    expect(clases.contains('hidden')).toBe(true);
    expect(clases.contains('md:flex')).toBe(true);
    expect(clases.contains('data-[abierto=true]:flex')).toBe(true);
  });

  it('closes with Escape and gives the focus back to the button', () => {
    render(<Navegacion />);
    fireEvent.click(screen.getByRole('button', { name: contenido.navegacion.abrirMenu }));

    fireEvent.keyDown(document, { key: 'Escape' });

    const boton = screen.getByRole('button', { name: contenido.navegacion.abrirMenu });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(boton);
  });

  it('closes when a link is chosen, because the page then scrolls to its section', () => {
    render(<Navegacion />);
    fireEvent.click(screen.getByRole('button', { name: contenido.navegacion.abrirMenu }));

    fireEvent.click(within(lista()).getAllByRole('link')[0] as HTMLElement);

    expect(
      screen
        .getByRole('button', { name: contenido.navegacion.abrirMenu })
        .getAttribute('aria-expanded'),
    ).toBe('false');
    expect(lista().dataset['abierto']).toBe('false');
  });

  it('does nothing with Escape while it is closed', () => {
    render(<Navegacion />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen
        .getByRole('button', { name: contenido.navegacion.abrirMenu })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });
});

describe('the button of the theme', () => {
  it('has one name for both states, so the server and the browser print the same', () => {
    render(<Navegacion />);

    expect(screen.getAllByRole('button', { name: contenido.navegacion.cambiarTema })).toHaveLength(
      1,
    );
  });

  it('switches the theme of the page and remembers it with the same key as the app', () => {
    render(<Navegacion />);

    fireEvent.click(screen.getByRole('button', { name: contenido.navegacion.cambiarTema }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(window.localStorage.getItem('vsd-stock-theme')).toBe('dark');

    fireEvent.click(screen.getByRole('button', { name: contenido.navegacion.cambiarTema }));
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(window.localStorage.getItem('vsd-stock-theme')).toBe('light');
  });
});
