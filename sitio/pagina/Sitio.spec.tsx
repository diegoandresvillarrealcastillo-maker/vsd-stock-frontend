import { act, render as mount, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FakeIntersectionObserver,
  installIntersectionObserver,
} from '../../test/support/intersection-observer';
import { contenido } from './contenido';
import { render } from './entry-server';
import { Sitio } from './Sitio';

// La pagina completa (C4-L3): diez secciones estaticas y accesibles. Lo que se vigila desde aqui es lo que no puede romperse nunca:
// que se pueda leer sin ejecutar JavaScript (el HTML prerenderizado), que el navegador monte lo mismo encima, que la estructura
// sea la que un lector de pantalla espera y que todo lo que se lee salga del archivo de contenido.

/** Todas las cadenas de un dato del contenido, a cualquier profundidad (los numeros no cuentan: no son palabras). */
function textos(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textos);
  if (typeof valor === 'object' && valor !== null) {
    return Object.values(valor as Record<string, unknown>).flatMap(textos);
  }
  return [];
}

// React 19 antepone al HTML del servidor un `<link rel="preload">` por cada imagen que se ve al abrir la pagina. Al hidratar sobre
// un contenedor, React se salta los nodos que sobran en la raiz, asi que no son una diferencia; ademas adelantan la descarga.
const PRECARGAS = /^(?:<link rel="preload"[^>]*>)+/;

const ORDEN = [
  contenido.anclas.inicio,
  contenido.anclas.problema,
  contenido.anclas.comoFunciona,
  contenido.anclas.funciones,
  contenido.anclas.demo,
  contenido.anclas.limites,
  contenido.anclas.confianza,
  contenido.anclas.loQueViene,
  contenido.anclas.preguntas,
  contenido.anclas.piloto,
];

describe('the prerendered page', () => {
  it('already has the text in the HTML, so a reader that does not run JavaScript still finds the page', () => {
    const html = render();

    expect(html).toContain('<h1');
    expect(html).toContain(contenido.hero.titulo.marca);
    expect(html).toContain(contenido.limites.titulo);
    expect(html).toContain(contenido.preguntas.items[0]?.respuesta ?? 'falta');
  });

  it('is the same markup that the browser mounts, or hydration would redo it', () => {
    const { container } = mount(<Sitio />);
    const servidor = document.createElement('div');
    servidor.innerHTML = render().replace(PRECARGAS, '');

    // Se comparan los arboles y no el texto: el servidor escribe `<img … />` con el `src` primero y el DOM lo escribe de otra
    // forma, pero eso no es una diferencia para la hidratacion. Un texto distinto, un nodo de mas o un atributo distinto, si.
    expect(servidor.isEqualNode(container)).toBe(true);
  });

  it('only differs from what the browser mounts by the preloads of the images, which React puts first and skips when it hydrates', () => {
    const html = render();
    const precargas = PRECARGAS.exec(html)?.[0] ?? '';

    expect(precargas).toContain('rel="preload"');
    expect(precargas).toContain('as="image"');
    expect(html.startsWith(precargas)).toBe(true);
  });
});

describe('the structure of the page', () => {
  it('has a skip link first, a header with the main navigation, one main and one footer', () => {
    const { container } = mount(<Sitio />);

    const first = container.querySelector('a, button');
    expect(first?.textContent).toBe(contenido.navegacion.saltar);
    expect(first?.getAttribute('href')).toBe('#contenido');
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('main')[0]?.id).toBe('contenido');
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: contenido.navegacion.principal })).toBeDefined();
  });

  it('has the sections in the order of the proposal, each one with its own anchor', () => {
    const { container } = mount(<Sitio />);
    const secciones = [...container.querySelectorAll('main > section')].map((s) => s.id);

    expect(secciones).toEqual(ORDEN);
  });

  it('labels every section with its own heading, so a reader of screens can jump between them', () => {
    const { container } = mount(<Sitio />);

    for (const section of container.querySelectorAll('main > section')) {
      const labelledby = section.getAttribute('aria-labelledby');
      expect(labelledby, section.id).not.toBeNull();
      const heading = container.querySelector(`#${labelledby ?? ''}`);
      expect(heading?.textContent?.trim().length, section.id).toBeGreaterThan(0);
      expect(heading?.closest('section'), section.id).toBe(section);
    }
  });

  it('has exactly one h1 and no skipped heading levels', () => {
    const { container } = mount(<Sitio />);
    const levels = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
      Number(h.tagName.slice(1)),
    );

    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect((levels[i] ?? 0) - (levels[i - 1] ?? 0), `heading ${String(i)}`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it('has an h2 for every section of the page', () => {
    const { container } = mount(<Sitio />);

    for (const section of container.querySelectorAll('main > section')) {
      expect(section.querySelectorAll('h2').length, section.id).toBeGreaterThanOrEqual(
        section.id === contenido.anclas.inicio ? 0 : 1,
      );
    }
  });
});

describe('the links of the page', () => {
  it('lead, every one of the in-page ones, to an element that exists', () => {
    const { container } = mount(<Sitio />);
    const anchors = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
      a.getAttribute('href')?.slice(1),
    );

    expect(anchors.length).toBeGreaterThan(8);
    for (const id of anchors) {
      expect(id === 'contenido' || container.querySelector(`#${id ?? ''}`), id).toBeTruthy();
    }
  });

  it('open the other sites in a new tab without giving them access to the page, and tell readers of screens so', () => {
    const { container } = mount(<Sitio />);
    const externos = [...container.querySelectorAll('a[href^="https://"]')];

    expect(externos.length).toBeGreaterThan(8);
    for (const a of externos) {
      const href = a.getAttribute('href') ?? '';
      expect(a.getAttribute('target'), href).toBe('_blank');
      expect(a.getAttribute('rel'), href).toBe('noopener noreferrer');
      expect(a.textContent, href).toContain(contenido.accesibilidad.externo);
    }
  });

  it('have a name that can be read, every link and every button', () => {
    const { container } = mount(<Sitio />);

    for (const el of container.querySelectorAll('a, button, summary')) {
      const name = el.getAttribute('aria-label') ?? el.textContent ?? '';
      expect(name.trim().length, el.outerHTML.slice(0, 80)).toBeGreaterThan(0);
    }
  });

  it('send everyone who wants to be a pilot store to WhatsApp, from the hero, the bar, the navigation and the end', () => {
    mount(<Sitio />);
    const piloto = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === contenido.hero.ctaPrincipal.href);

    expect(piloto.length).toBeGreaterThanOrEqual(4);
  });

  it('send the demo to the public web of PRE, from the hero, the demo band and the end', () => {
    mount(<Sitio />);
    const demo = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === contenido.hero.ctaSecundario.href);

    expect(demo.length).toBeGreaterThanOrEqual(3);
  });
});

describe('what each section shows', () => {
  it('puts the highlighted word of the hero inside the title, which is one sentence', () => {
    mount(<Sitio />);
    const h1 = screen.getByRole('heading', { level: 1 });

    expect(h1.textContent).toBe(
      `${contenido.hero.titulo.antes} ${contenido.hero.titulo.marca}${contenido.hero.titulo.despues}`,
    );
    expect(within(h1).getByText(contenido.hero.titulo.marca).tagName).toBe('MARK');
  });

  it('shows the three trust chips under the hero', () => {
    const { container } = mount(<Sitio />);
    const hero = container.querySelector(`#${contenido.anclas.inicio}`);

    for (const sello of contenido.hero.sellos) expect(hero?.textContent).toContain(sello);
  });

  it('shows the four cards of the problem and the three steps in order', () => {
    const { container } = mount(<Sitio />);
    const problema = container.querySelector(`#${contenido.anclas.problema}`);
    const pasos = container.querySelector(`#${contenido.anclas.comoFunciona} ol`);

    expect(problema?.querySelectorAll('article')).toHaveLength(contenido.problema.tarjetas.length);
    expect([...(pasos?.querySelectorAll('li > h3') ?? [])].map((h) => h.textContent)).toEqual(
      contenido.comoFunciona.pasos.map((p) => p.titulo),
    );
  });

  it('shows the six cards of the functions, and the example of VAT as the domain calculates it', () => {
    const { container } = mount(<Sitio />);
    const funciones = container.querySelector(`#${contenido.anclas.funciones}`);

    expect(
      [...(funciones?.querySelectorAll('article > h3') ?? [])].map((h) => h.textContent),
    ).toEqual(contenido.funciones.tarjetas.map((t) => t.titulo));
    expect(funciones?.textContent).toContain('$ 11.900');
    expect(funciones?.textContent).toContain('$ 10.000');
    expect(funciones?.textContent).toContain('$ 1.900');
    expect(funciones?.textContent).toContain(contenido.funciones.tarjetas[1]?.nota ?? 'falta');
  });

  it('shows the three figures of the demo band and the button that opens the demo', () => {
    const { container } = mount(<Sitio />);
    const demo = container.querySelector(`#${contenido.anclas.demo}`);

    for (const cifra of contenido.demo.cifras) {
      expect(demo?.textContent).toContain(cifra.valor);
      expect(demo?.textContent).toContain(cifra.texto);
    }
    expect(demo?.textContent).toContain(contenido.demo.nota);
  });

  it('shows what it does and what it does not do in two lists, with a word for readers of screens in every mark', () => {
    const { container } = mount(<Sitio />);
    const limites = container.querySelector(`#${contenido.anclas.limites}`);
    const listas = limites?.querySelectorAll('ul') ?? [];

    expect(listas).toHaveLength(2);
    expect(listas[0]?.querySelectorAll('li')).toHaveLength(contenido.limites.hace.length);
    expect(listas[1]?.querySelectorAll('li')).toHaveLength(contenido.limites.noHace.length);
    expect(listas[0]?.textContent).toContain(contenido.limites.marcas.hace);
    expect(listas[1]?.textContent).toContain(contenido.limites.marcas.noHace);
    expect(limites?.textContent).toContain(contenido.limites.pie);
  });

  it('shows the four points of trust, the seals that link to the documents, and no testimonial', () => {
    const { container } = mount(<Sitio />);
    const confianza = container.querySelector(`#${contenido.anclas.confianza}`);

    expect(
      [...(confianza?.querySelectorAll('article > h3') ?? [])].map((h) => h.textContent),
    ).toEqual(contenido.confianza.puntos.map((p) => p.titulo));
    for (const sello of contenido.confianza.sellos) {
      expect(
        within(confianza as HTMLElement)
          .getByRole('link', { name: new RegExp(sello.texto) })
          .getAttribute('href'),
      ).toBe(sello.href);
    }
    expect(confianza?.querySelector('blockquote')).toBeNull();
  });

  it('shows what is coming as a list in which each item says if it is decided or pending', () => {
    const { container } = mount(<Sitio />);
    const viene = container.querySelector(`#${contenido.anclas.loQueViene}`);
    const items = [...(viene?.querySelectorAll('li') ?? [])];

    expect(items).toHaveLength(contenido.loQueViene.items.length);
    items.forEach((li, i) => {
      expect(li.textContent).toContain(contenido.loQueViene.items[i]?.estado);
      expect(li.textContent).toContain(contenido.loQueViene.items[i]?.texto);
    });
    expect(viene?.textContent).toContain(contenido.loQueViene.pie);
  });

  it('shows the closing band with the button, the notice that it opens WhatsApp and the link to the demo', () => {
    const { container } = mount(<Sitio />);
    const piloto = container.querySelector(`#${contenido.anclas.piloto}`);

    expect(piloto?.textContent).toContain(contenido.cta.titulo);
    expect(piloto?.textContent).toContain(contenido.cta.subtitulo);
    expect(piloto?.textContent).toContain(contenido.cta.avisoBoton);
    expect(piloto?.textContent).toContain(contenido.cta.enlaceDemo.texto);
  });

  it('closes with the footer: the columns of links and the notice that it is not an electronic invoicing tool', () => {
    mount(<Sitio />);
    const pie = screen.getByRole('contentinfo');

    for (const columna of contenido.pie.columnas) {
      expect(pie.textContent).toContain(columna.titulo);
      for (const enlace of columna.enlaces) {
        expect(
          within(pie).getAllByRole('link', { name: new RegExp(enlace.texto) }).length,
        ).toBeGreaterThan(0);
      }
    }
    expect(pie.textContent).toContain(contenido.pie.aviso);
  });
});

describe('the details that a section can lose without anyone noticing', () => {
  const seccion = (container: HTMLElement, ancla: string): HTMLElement => {
    const encontrada = container.querySelector<HTMLElement>(`#${ancla}`);
    if (encontrada === null) throw new Error(`falta la seccion ${ancla}`);
    return encontrada;
  };

  it('says that it is in tests in the very first line, above the navigation', () => {
    const { container } = mount(<Sitio />);
    const anuncio = container.querySelector('header')?.previousElementSibling;

    expect(anuncio?.textContent).toContain(contenido.anuncio.etiqueta);
    expect(anuncio?.textContent).toContain(contenido.anuncio.texto);
  });

  it('has in the hero the button to WhatsApp first and the one to the demo second, and nothing else that leads away', () => {
    const { container } = mount(<Sitio />);
    const enlaces = [...seccion(container, contenido.anclas.inicio).querySelectorAll('a')];

    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      contenido.hero.ctaPrincipal.href,
      contenido.hero.ctaSecundario.href,
    ]);
    expect(enlaces[0]?.textContent).toContain(contenido.hero.ctaPrincipal.texto);
    expect(enlaces[1]?.textContent).toContain(contenido.hero.ctaSecundario.texto);
  });

  it('shows the whole text of the scenes of the problem and of the steps, not only their titles', () => {
    const { container } = mount(<Sitio />);
    const problema = seccion(container, contenido.anclas.problema);
    const pasos = seccion(container, contenido.anclas.comoFunciona);

    for (const escena of contenido.problema.tarjetas) {
      for (const texto of [escena.etiqueta, escena.titulo, escena.texto]) {
        expect(problema.textContent).toContain(texto);
      }
    }
    for (const paso of contenido.comoFunciona.pasos) {
      expect(pasos.textContent).toContain(paso.titulo);
      expect(pasos.textContent).toContain(paso.texto);
    }
  });

  it('draws the functions with the numbers of the domain: the rate of VAT, the difference of the cash and the movements', () => {
    const { container } = mount(<Sitio />);
    const funciones = seccion(container, contenido.anclas.funciones).textContent;
    const roles = contenido.funciones.tarjetas.find((t) => t.id === 'roles')?.roles ?? [];

    expect(funciones).toContain(`${contenido.funciones.miniaturas.iva.iva} 19 %`);
    expect(funciones).toContain('Faltan $ 2.000');
    expect(funciones).toContain('− 1');
    expect(funciones).toContain('+ 1');
    expect(funciones).toContain(
      `${String(contenido.funciones.miniaturas.sinConexion.pendientes)} ${contenido.diagrama.porEnviar}`,
    );
    // El texto de la tarjeta ya nombra los roles: lo que se vigila es el dibujo, una lista con un elemento por rol.
    const fichas = [...seccion(container, contenido.anclas.funciones).querySelectorAll('li')].map(
      (li) => li.textContent,
    );
    expect(roles.length).toBeGreaterThan(0);
    for (const rol of roles) expect(fichas).toContain(rol);
  });

  it('shows every word that the content defines for the pictures of the functions', () => {
    const { container } = mount(<Sitio />);
    const funciones = seccion(container, contenido.anclas.funciones).textContent;

    for (const texto of textos(contenido.funciones.miniaturas)) {
      expect(funciones, texto).toContain(texto);
    }
  });

  it('says what each seal of decisions is about, and leaves no empty list in a card without links', () => {
    const { container } = mount(<Sitio />);
    const confianza = seccion(container, contenido.anclas.confianza);

    for (const sello of contenido.confianza.sellos) {
      expect(confianza.textContent).toContain(sello.detalle);
    }
    expect(confianza.textContent).toContain(contenido.confianza.sellosTitulo);
    expect(confianza.querySelectorAll('ul:empty')).toHaveLength(0);
  });

  it('opens the in-page links in the same tab', () => {
    const { container } = mount(<Sitio />);

    for (const a of container.querySelectorAll('a[href^="#"]')) {
      expect(a.hasAttribute('target'), a.getAttribute('href') ?? '').toBe(false);
    }
  });

  it('has the logo in the footer with the name of the brand, for those who cannot see it', () => {
    mount(<Sitio />);

    expect(within(screen.getByRole('contentinfo')).getByAltText(contenido.marca)).toBeDefined();
  });

  it('sends the announcement of the top to WhatsApp', () => {
    const { container } = mount(<Sitio />);
    const anuncio = container.querySelector('header')?.previousElementSibling;
    const enlace = anuncio?.querySelector('a');

    expect(enlace?.getAttribute('href')).toBe(contenido.anuncio.enlace.href);
    expect(enlace?.textContent).toContain(contenido.anuncio.enlace.texto);
  });

  it('writes in the hero its label, its subtitle and its note, besides the title', () => {
    const { container } = mount(<Sitio />);
    const hero = seccion(container, contenido.anclas.inicio).textContent;

    for (const texto of [contenido.hero.etiqueta, contenido.hero.subtitulo, contenido.hero.nota]) {
      expect(hero).toContain(texto);
    }
  });

  it('draws how a sale travels, with a name, a description and the four places in order', () => {
    const { container } = mount(<Sitio />);
    const dibujo = screen.getByRole('img', { name: contenido.diagrama.titulo });
    const { nodos, estados } = contenido.diagrama;

    const descripcion = document.getElementById(dibujo.getAttribute('aria-describedby') ?? '');
    expect(descripcion?.textContent).toBe(contenido.diagrama.descripcion);
    expect(dibujo.textContent).toContain(contenido.diagrama.folio);
    expect(dibujo.textContent).toContain(estados.conectado);
    const puestos = [...dibujo.querySelectorAll('text')].map((t) => t.textContent);
    for (const nombre of [nodos.mostrador, nodos.cola, nodos.servidor, nodos.libro]) {
      expect(puestos).toContain(nombre);
    }
    expect(seccion(container, contenido.anclas.inicio).contains(dibujo)).toBe(true);
  });

  it('writes the title and the text of every card of the functions, and the state of the connection', () => {
    const { container } = mount(<Sitio />);
    const funciones = seccion(container, contenido.anclas.funciones).textContent;

    for (const tarjeta of contenido.funciones.tarjetas) {
      expect(funciones).toContain(tarjeta.titulo);
      expect(funciones).toContain(tarjeta.texto);
    }
    // El titulo de la primera tarjeta ya empieza con esas palabras: se busca la ficha del dibujo, un elemento que dice solo eso.
    const fichas = [...seccion(container, contenido.anclas.funciones).querySelectorAll('span')].map(
      (s) => s.textContent,
    );
    expect(fichas).toContain(contenido.diagrama.estados.sinConexion);
  });

  it('has in the demo band the button that opens the demo of tests', () => {
    const { container } = mount(<Sitio />);
    const boton = within(seccion(container, contenido.anclas.demo)).getByRole('link', {
      name: new RegExp(contenido.demo.boton.texto),
    });

    expect(boton.getAttribute('href')).toBe(contenido.demo.boton.href);
  });

  it('puts what it does and what it does not do under their own titles, in that order', () => {
    const { container } = mount(<Sitio />);
    const titulos = [...seccion(container, contenido.anclas.limites).querySelectorAll('h3')];

    expect(titulos.map((h) => h.textContent)).toEqual([
      contenido.limites.columnaHace,
      contenido.limites.columnaNoHace,
    ]);
  });

  it('writes the text of each point of trust and links to where it can be checked', () => {
    const { container } = mount(<Sitio />);
    const confianza = within(seccion(container, contenido.anclas.confianza));

    for (const punto of contenido.confianza.puntos) {
      expect(confianza.getByText(punto.texto)).toBeDefined();
      for (const enlace of punto.enlaces) {
        const encontrados = confianza.getAllByRole('link', { name: new RegExp(enlace.texto) });
        expect(encontrados.map((a) => a.getAttribute('href'))).toContain(enlace.href);
      }
    }
  });

  it('closes with the button to WhatsApp, the link to the demo and the subtitle', () => {
    const { container } = mount(<Sitio />);
    const piloto = within(seccion(container, contenido.anclas.piloto));

    expect(
      piloto
        .getByRole('link', { name: new RegExp(contenido.cta.boton.texto) })
        .getAttribute('href'),
    ).toBe(contenido.cta.boton.href);
    expect(
      piloto
        .getByRole('link', { name: new RegExp(contenido.cta.enlaceDemo.texto) })
        .getAttribute('href'),
    ).toBe(contenido.cta.enlaceDemo.href);
  });

  it('leaves room under the fixed navigation, so jumping to a section does not hide its title', () => {
    const { container } = mount(<Sitio />);

    for (const section of container.querySelectorAll('main > section')) {
      expect(section.classList.contains('scroll-mt-16'), section.id).toBe(true);
    }
  });
});

describe('the contact bar inside the page', () => {
  let quitar: () => void;
  beforeEach(() => {
    quitar = installIntersectionObserver();
  });
  afterEach(() => {
    quitar();
  });

  it('is part of the page: it shows up once the hero leaves the screen', () => {
    const { container } = mount(<Sitio />);
    const hero = container.querySelector(`#${contenido.anclas.inicio}`);
    const observador = FakeIntersectionObserver.alive().find((o) =>
      [...o.targets].some((objetivo) => objetivo === hero),
    );

    act(() => {
      observador?.emit([[hero, false]]);
    });

    expect(
      screen.getByRole('complementary', { name: contenido.barraContacto.etiqueta }),
    ).toBeDefined();
  });
});
