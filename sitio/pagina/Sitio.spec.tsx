import { fireEvent, render as mount, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installIntersectionObserver } from '../../test/support/intersection-observer';
import { CAPTURAS, type Captura } from './capturas';
import { contenido } from './contenido';
import { APP_INGRESAR, APP_REGISTRARSE, WHATSAPP_URL } from './destinos';
import { render } from './entry-server';
import { Sitio } from './Sitio';

// La pagina completa: diez secciones estaticas y accesibles. Lo que se vigila desde aqui es lo que no puede romperse nunca: que se
// pueda leer sin ejecutar JavaScript (el HTML prerenderizado), que el navegador monte lo mismo encima, que la estructura sea la que
// un lector de pantalla espera y que todo lo que se lee salga del archivo de contenido.

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
  contenido.anclas.beneficios,
  contenido.anclas.antesYDespues,
  contenido.anclas.funciones,
  contenido.anclas.pruebalo,
  contenido.anclas.comoEmpezar,
  contenido.anclas.paraQuien,
  contenido.anclas.incluye,
  contenido.anclas.preguntas,
  contenido.anclas.contacto,
];

// Los observadores de las secciones (la navegacion marca la que se lee) no existen en jsdom.
let quitarObservador: () => void;
beforeEach(() => {
  quitarObservador = installIntersectionObserver();
});
afterEach(() => {
  quitarObservador();
});

const seccion = (container: HTMLElement, ancla: string): HTMLElement => {
  const encontrada = container.querySelector<HTMLElement>(`#${ancla}`);
  if (encontrada === null) throw new Error(`falta la seccion ${ancla}`);
  return encontrada;
};

describe('the prerendered page', () => {
  it('already has the text in the HTML, so a reader that does not run JavaScript still finds the page', () => {
    const html = render();

    expect(html).toContain('<h1');
    expect(html).toContain(contenido.hero.titulo);
    expect(html).toContain(contenido.incluye.titulo);
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

  it('opens with the header and nothing above it: no notice of «tests», no bar that asks for stores', () => {
    const { container } = mount(<Sitio />);
    const cabecera = container.querySelector('header');

    expect(cabecera?.previousElementSibling?.tagName).toBe('A');
    expect(screen.queryByRole('complementary')).toBeNull();
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

  it('has an h2 for every section of the page but the first, whose title is the h1', () => {
    const { container } = mount(<Sitio />);

    for (const section of container.querySelectorAll('main > section')) {
      expect(section.querySelectorAll('h2').length, section.id).toBeGreaterThanOrEqual(
        section.id === contenido.anclas.inicio ? 0 : 1,
      );
    }
  });

  it('leaves room under the fixed navigation, so jumping to a section does not hide its title', () => {
    const { container } = mount(<Sitio />);

    for (const section of container.querySelectorAll('main > section')) {
      expect(section.classList.contains('scroll-mt-16'), section.id).toBe(true);
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

    expect(externos.length).toBeGreaterThan(6);
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

  it('send whoever wants to talk to an advisor to WhatsApp, from the hero, the end and the footer', () => {
    mount(<Sitio />);
    const asesor = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === WHATSAPP_URL);

    expect(asesor).toHaveLength(3);
  });

  it('send whoever asks for access to the app, from the navigation, the hero, the end and the footer, and whoever signs in, from the navigation and the footer', () => {
    mount(<Sitio />);
    const enlaces = screen.getAllByRole('link');

    expect(enlaces.filter((a) => a.getAttribute('href') === APP_REGISTRARSE)).toHaveLength(4);
    expect(enlaces.filter((a) => a.getAttribute('href') === APP_INGRESAR)).toHaveLength(2);
  });

  it('open the in-page links in the same tab', () => {
    const { container } = mount(<Sitio />);

    for (const a of container.querySelectorAll('a[href^="#"]')) {
      expect(a.hasAttribute('target'), a.getAttribute('href') ?? '').toBe(false);
    }
  });
});

describe('the screenshots of the app', () => {
  it('are the ones of the list, each one with the description of the content, and the only other picture of the page is the mascot of the diagram', () => {
    const { container } = mount(<Sitio />);
    const conocidas = new Map<string, string>(
      Object.entries(CAPTURAS).map(([id, c]) => [c.src, id]),
    );
    const imagenes = [...container.querySelectorAll('main img[src^="/capturas/"]')];
    const otras = [...container.querySelectorAll('main img:not([src^="/capturas/"])')];

    expect(imagenes.length).toBeGreaterThanOrEqual(6);
    expect(
      otras.every((o) => o.closest(`#${contenido.anclas.pruebalo}`) !== null),
      'ninguna otra imagen fuera de la banda de la demo',
    ).toBe(true);
    for (const imagen of imagenes) {
      const src = imagen.getAttribute('src') ?? '';
      const id = conocidas.get(src);
      expect(id, src).toBeDefined();
      expect(imagen.getAttribute('alt'), src).toBe(contenido.capturas[id as keyof typeof CAPTURAS]);
    }
  });

  it('shows each of the five at least once', () => {
    const { container } = mount(<Sitio />);
    const vistas = new Set(
      [...container.querySelectorAll('main img')].map((i) => i.getAttribute('src')),
    );

    for (const captura of Object.values(CAPTURAS))
      expect(vistas.has(captura.src), captura.src).toBe(true);
  });

  it('reserve their space with the width and the height of the file, so the page does not jump when they arrive', () => {
    const { container } = mount(<Sitio />);
    const porSrc = new Map<string, Captura>(Object.values(CAPTURAS).map((c) => [c.src, c]));

    for (const imagen of container.querySelectorAll('main img[src^="/capturas/"]')) {
      const captura = porSrc.get(imagen.getAttribute('src') ?? '');
      expect(imagen.getAttribute('width'), imagen.getAttribute('src') ?? '').toBe(
        String(captura?.ancho),
      );
      expect(imagen.getAttribute('height'), imagen.getAttribute('src') ?? '').toBe(
        String(captura?.alto),
      );
    }
  });

  it('load at once on the hero, which is what is seen first, and only when they get close everywhere else', () => {
    const { container } = mount(<Sitio />);
    const hero = seccion(container, contenido.anclas.inicio);

    for (const imagen of container.querySelectorAll('main img[src^="/capturas/"]')) {
      const dentro = hero.contains(imagen);
      const src = imagen.getAttribute('src') ?? '';
      expect(imagen.getAttribute('loading') === 'lazy', src).toBe(!dentro);
      expect(imagen.getAttribute('decoding'), src).toBe('async');
    }
  });
});

describe('what each section shows', () => {
  it('writes the title of the hero as one sentence, with no word picked out of it', () => {
    const { container } = mount(<Sitio />);
    const h1 = screen.getByRole('heading', { level: 1 });

    expect(h1.textContent).toBe(contenido.hero.titulo);
    expect(container.querySelector('mark')).toBeNull();
  });

  it('has in the hero the button to ask for access first and the one to talk to an advisor second, and nothing else that leads away', () => {
    const { container } = mount(<Sitio />);
    const enlaces = [...seccion(container, contenido.anclas.inicio).querySelectorAll('a')];

    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([APP_REGISTRARSE, WHATSAPP_URL]);
    expect(enlaces[0]?.textContent).toContain(contenido.hero.ctaPrincipal.texto);
    expect(enlaces[1]?.textContent).toContain(contenido.hero.ctaSecundario.texto);
  });

  it('writes in the hero the subtitle, the note and the points, besides the title, and shows the sale and the stock in a phone and a laptop', () => {
    const { container } = mount(<Sitio />);
    const hero = seccion(container, contenido.anclas.inicio);

    for (const texto of [contenido.hero.subtitulo, contenido.hero.nota, ...contenido.hero.puntos]) {
      expect(hero.textContent).toContain(texto);
    }
    expect([...hero.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([
      CAPTURAS.existencias.src,
      CAPTURAS.vender.src,
    ]);
  });

  it('shows the four benefits, each one with its title and its text', () => {
    const { container } = mount(<Sitio />);
    const beneficios = seccion(container, contenido.anclas.beneficios);

    expect([...beneficios.querySelectorAll('article > h3')].map((h) => h.textContent)).toEqual(
      contenido.beneficios.items.map((b) => b.titulo),
    );
    expect(contenido.beneficios.items).toHaveLength(4);
    for (const beneficio of contenido.beneficios.items) {
      expect(beneficios.textContent).toContain(beneficio.texto);
    }
  });

  it('shows, side by side, what a business lives without VSD Stock and with it, one list each and one line per scene', () => {
    const { container } = mount(<Sitio />);
    const antes = seccion(container, contenido.anclas.antesYDespues);
    const { antesYDespues } = contenido;
    const listas = antes.querySelectorAll('ul');

    expect([...antes.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      antesYDespues.columnaAntes,
      antesYDespues.columnaDespues,
    ]);
    expect(listas).toHaveLength(2);
    expect([...(listas[0]?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual(
      antesYDespues.filas.map((f) => f.antes),
    );
    expect([...(listas[1]?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual(
      antesYDespues.filas.map((f) => f.despues),
    );
  });

  it('shows the four features with their screenshot and the three small cards, and the example of VAT as the domain calculates it', () => {
    const { container } = mount(<Sitio />);
    const funciones = seccion(container, contenido.anclas.funciones);

    expect([...funciones.querySelectorAll('article h3')].map((h) => h.textContent)).toEqual([
      ...contenido.funciones.destacadas.map((f) => f.titulo),
      ...contenido.funciones.tarjetas.map((t) => t.titulo),
    ]);
    for (const destacada of contenido.funciones.destacadas) {
      expect(funciones.textContent).toContain(destacada.texto);
      for (const punto of destacada.puntos) expect(funciones.textContent).toContain(punto);
      expect(
        funciones.querySelector(`img[src="${CAPTURAS[destacada.captura].src}"]`),
        destacada.id,
      ).not.toBeNull();
    }
    expect(funciones.textContent).toContain('$ 11.900');
    expect(funciones.textContent).toContain('$ 10.000');
    expect(funciones.textContent).toContain('$ 1.900');
    expect(funciones.textContent).toContain(
      contenido.funciones.tarjetas.find((t) => t.id === 'iva')?.nota ?? 'falta',
    );
  });

  it('draws the small cards with what the domain says: the state of the connection, the VAT rate and one chip per role', () => {
    const { container } = mount(<Sitio />);
    const funciones = seccion(container, contenido.anclas.funciones);
    const roles = contenido.funciones.tarjetas.find((t) => t.id === 'roles')?.roles ?? [];
    const fichas = [...funciones.querySelectorAll('li, span')].map((n) => n.textContent);

    expect(fichas).toContain(contenido.diagrama.estados.sinConexion);
    expect(funciones.textContent).toContain(
      `${String(contenido.funciones.miniaturas.sinConexion.pendientes)} ${contenido.diagrama.porEnviar}`,
    );
    expect(funciones.textContent).toContain(`${contenido.funciones.miniaturas.iva.iva} 19 %`);
    expect(roles.length).toBeGreaterThan(0);
    for (const rol of roles) expect(fichas).toContain(rol);
    for (const texto of textos(contenido.funciones.miniaturas.iva)) {
      expect(funciones.textContent, texto).toContain(texto);
    }
  });

  it('puts the VAT calculator in the demo band, open on the example of the VAT card, and not under the cards of the functions', async () => {
    const { container } = mount(<Sitio />);
    const banda = seccion(container, contenido.anclas.pruebalo);
    const funciones = seccion(container, contenido.anclas.funciones);
    const ejemplo = contenido.funciones.tarjetas.find((t) => t.id === 'iva')?.ejemplo;

    // No baja hasta que alguien abre su pestana.
    expect(screen.queryByLabelText(contenido.calculadora.campo)).toBeNull();
    fireEvent.click(within(banda).getByRole('tab', { name: contenido.pruebalo.pestanas.iva }));
    const campo = await within(banda).findByLabelText<HTMLInputElement>(
      contenido.calculadora.campo,
    );

    expect(within(banda).getByRole('heading', { name: contenido.calculadora.titulo })).toBeTruthy();
    expect(ejemplo).toBeDefined();
    expect(campo.value).toBe(String(ejemplo?.total));
    expect(within(banda).getByRole('radio', { name: '19 %' })).toHaveProperty('checked', true);
    expect(funciones.querySelectorAll('input')).toHaveLength(0);
    expect(screen.getAllByLabelText(contenido.calculadora.campo)).toHaveLength(1);
  });

  it('puts the cash count of the example in the demo band, with a drawer that is short, and not under the steps', async () => {
    const { container } = mount(<Sitio />);
    const banda = seccion(container, contenido.anclas.pruebalo);
    const pasos = seccion(container, contenido.anclas.comoEmpezar);
    const { arqueo } = contenido;

    expect(screen.queryByLabelText(arqueo.campo)).toBeNull();
    fireEvent.click(within(banda).getByRole('tab', { name: contenido.pruebalo.pestanas.caja }));
    const campo = await within(banda).findByLabelText<HTMLInputElement>(arqueo.campo);

    expect(within(banda).getByRole('heading', { name: arqueo.titulo })).toBeTruthy();
    expect(campo.value).toBe(String(arqueo.contado));
    expect(banda.textContent).toContain('Faltan $ 2.000');
    expect(banda.textContent).toContain('Esperabas $ 170.000 y contaste $ 168.000.');
    expect(pasos.querySelectorAll('input')).toHaveLength(0);
    expect(screen.getAllByLabelText(arqueo.campo)).toHaveLength(1);
  });

  it('puts the live sale diagram once, in the first tab of the demo band, with its own ids', () => {
    const { container } = mount(<Sitio />);
    const banda = seccion(container, contenido.anclas.pruebalo);

    expect(within(banda).getAllByRole('img', { name: contenido.diagrama.titulo })).toHaveLength(1);
    expect(screen.getAllByRole('switch', { name: contenido.diagrama.interruptor })).toHaveLength(1);
  });

  it('draws how a sale travels, with a name, a description and the four places in order', () => {
    const { container } = mount(<Sitio />);
    const dibujo = within(seccion(container, contenido.anclas.pruebalo)).getByRole('img', {
      name: contenido.diagrama.titulo,
    });
    const { nodos, estados } = contenido.diagrama;

    const descripcion = document.getElementById(dibujo.getAttribute('aria-describedby') ?? '');
    expect(descripcion?.textContent).toBe(contenido.diagrama.descripcion);
    expect(dibujo.textContent).toContain('K7-000140');
    expect(dibujo.textContent).toContain('K7-000141');
    expect(dibujo.textContent).toContain(estados.conectado);
    const puestos = [...dibujo.querySelectorAll('text')].map((t) => t.textContent);
    for (const nombre of [nodos.mostrador, nodos.cola, nodos.servidor, nodos.libro]) {
      expect(puestos).toContain(nombre);
    }
  });

  it('never repeats an id, even with every tab of the demo open, so every label and every description points at its own field', async () => {
    const { container } = mount(<Sitio />);
    const banda = seccion(container, contenido.anclas.pruebalo);
    fireEvent.click(within(banda).getByRole('tab', { name: contenido.pruebalo.pestanas.iva }));
    await within(banda).findByLabelText(contenido.calculadora.campo);
    fireEvent.click(within(banda).getByRole('tab', { name: contenido.pruebalo.pestanas.caja }));
    await within(banda).findByLabelText(contenido.arqueo.campo);
    const ids = [...container.querySelectorAll('[id]')].map((n) => n.id);

    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('shows the three steps in order, each with its number, its title and its whole text', () => {
    const { container } = mount(<Sitio />);
    const pasos = seccion(container, contenido.anclas.comoEmpezar);

    expect([...pasos.querySelectorAll('ol > li > h3')].map((h) => h.textContent)).toEqual(
      contenido.comoEmpezar.pasos.map((p) => p.titulo),
    );
    expect(contenido.comoEmpezar.pasos).toHaveLength(3);
    for (const paso of contenido.comoEmpezar.pasos) {
      expect(pasos.textContent).toContain(paso.texto);
    }
    expect(
      [...pasos.querySelectorAll('ol > li > span[aria-hidden="true"]')].map((n) => n.textContent),
    ).toEqual(['1', '2', '3']);
  });

  it('shows for whom it is, one card each', () => {
    const { container } = mount(<Sitio />);
    const paraQuien = seccion(container, contenido.anclas.paraQuien);

    expect([...paraQuien.querySelectorAll('article > h3')].map((h) => h.textContent)).toEqual(
      contenido.paraQuien.items.map((i) => i.titulo),
    );
    for (const item of contenido.paraQuien.items) {
      expect(paraQuien.textContent).toContain(item.texto);
    }
  });

  it('shows what it includes and what stays as it is today in two lists, with a word for readers of screens in every mark', () => {
    const { container } = mount(<Sitio />);
    const incluye = seccion(container, contenido.anclas.incluye);
    const listas = incluye.querySelectorAll('ul');

    expect(listas).toHaveLength(2);
    expect(listas[0]?.querySelectorAll('li')).toHaveLength(contenido.incluye.hace.length);
    expect(listas[1]?.querySelectorAll('li')).toHaveLength(contenido.incluye.noHace.length);
    expect(listas[0]?.textContent).toContain(contenido.incluye.marcas.hace);
    expect(listas[1]?.textContent).toContain(contenido.incluye.marcas.noHace);
    expect(incluye.textContent).toContain(contenido.incluye.pie);
    expect([...incluye.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
      contenido.incluye.columnaHace,
      contenido.incluye.columnaNoHace,
    ]);
  });

  it('has no section of trust, none of what is coming, no testimonial and no quote', () => {
    const { container } = mount(<Sitio />);

    expect(container.querySelector('blockquote')).toBeNull();
    expect(container.querySelector('#confianza')).toBeNull();
    expect(container.querySelector('#lo-que-viene')).toBeNull();
  });

  it('closes with the final call: the title, the subtitle, the two buttons and the notice that the second one opens WhatsApp', () => {
    const { container } = mount(<Sitio />);
    const contacto = within(seccion(container, contenido.anclas.contacto));

    expect(contacto.getByRole('heading', { name: contenido.cta.titulo })).toBeDefined();
    expect(contacto.getByText(contenido.cta.subtitulo)).toBeDefined();
    expect(
      contacto
        .getByRole('link', { name: new RegExp(contenido.cta.principal.texto) })
        .getAttribute('href'),
    ).toBe(APP_REGISTRARSE);
    expect(
      contacto
        .getByRole('link', { name: new RegExp(contenido.cta.secundario.texto) })
        .getAttribute('href'),
    ).toBe(WHATSAPP_URL);
    expect(contacto.getByText(contenido.cta.avisoAsesor)).toBeDefined();
  });

  it('closes with the footer: the columns of links, the logo with the name of the brand and the notice that it is not an electronic invoicing tool', () => {
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
    expect(within(pie).getByAltText(contenido.marca)).toBeDefined();
  });
});
