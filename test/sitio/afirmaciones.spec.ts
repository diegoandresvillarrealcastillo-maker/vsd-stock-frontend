// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Money } from '../../src/domain/model/money';
import { TAX_RATES_BP, splitTaxIncluded } from '../../src/domain/model/tax';
import {
  APP_DE_PRE,
  APP_INGRESAR,
  APP_REGISTRARSE,
  WHATSAPP_URL,
} from '../../sitio/pagina/destinos';
import { contenido, PENDIENTES_DE_PUBLICAR, puedePublicar } from '../../sitio/pagina/contenido';

// Lo que la landing dice sale de UN archivo (sitio/pagina/contenido.ts, ADR 0033) y estas pruebas vigilan que no afirme lo que el
// producto no hace. Cada regla de aqui es una linea de la tabla de afirmaciones de V2-DOCUMENTOS/PROPUESTA-LANDING-VSD-STOCK.md:
// factura electronica, tarjetas, precios, «open source», testimonios, velocidades que no se midieron, celulares que no se probaron,
// funciones que todavia no existen y competidores. Las cifras no se escriben en el texto: salen de datos que aqui se comparan con el
// dominio y con el contrato de permisos.
const ROOT = resolve(import.meta.dirname, '../..');

interface Entrada {
  readonly ruta: string;
  /** La seccion de la pagina: el primer tramo de la ruta. */
  readonly seccion: string;
  readonly texto: string;
  /** Una lista que por su nombre es de cosas que NO se hacen: ahi se nombra lo que no existe. */
  readonly negativo: boolean;
}

/** Todos los textos del contenido, con la ruta que los alcanza. Los enlaces (`href`) se vigilan aparte. */
function entradas(valor: unknown, ruta: readonly string[] = []): Entrada[] {
  if (typeof valor === 'string') {
    if (ruta.at(-1) === 'href') return [];
    return [
      {
        ruta: ruta.join('.'),
        seccion: ruta[0] ?? '',
        texto: valor,
        negativo: ruta.includes('noHace'),
      },
    ];
  }
  if (Array.isArray(valor)) {
    return valor.flatMap((item, i) => entradas(item as unknown, [...ruta, String(i)]));
  }
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, item]) => entradas(item, [...ruta, clave]));
  }
  return [];
}

/** Todos los enlaces del contenido. */
function enlaces(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap((item) => enlaces(item as unknown));
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, item]) =>
      clave === 'href' && typeof item === 'string' ? [item] : enlaces(item),
    );
  }
  return [];
}

/** Si el enlace lleva a GitHub, mirando el sitio al que va y no un pedazo de texto cualquiera de la direccion. */
function esDeGithub(href: string): boolean {
  const sitio = new URL(href, 'https://pagina.invalid').hostname;
  return sitio === 'github.com' || sitio.endsWith('.github.com');
}

const todas = entradas(contenido);
/** Lo que la pagina AFIRMA: todo menos las preguntas, que nombran lo que se pregunta y se contestan en su respuesta. */
const afirmaciones = todas.filter((e) => !e.ruta.endsWith('.pregunta'));
const frases = (texto: string): string[] => texto.split(/(?<=[.!?…])\s+/);
const NEGACION = /\b(no|ni|sin|nunca|todav[ií]a|sigue)\b/i;

/** Las que NO son de esas secciones. */
const fuera = (...secciones: string[]): Entrada[] =>
  todas.filter((e) => !secciones.includes(e.seccion));
const rutas = (lista: readonly Entrada[]): string[] => lista.map((e) => e.ruta);

describe('the walk over the content', () => {
  it('finds the text in objects and lists, skips the links and tells the lists of things that are not done', () => {
    const visto = entradas({
      a: 'uno',
      lista: ['dos', { b: 'tres', href: 'https://x' }],
      noHace: ['cuatro'],
      n: 5,
    });

    expect(visto.map((e) => e.texto)).toEqual(['uno', 'dos', 'tres', 'cuatro']);
    expect(visto.map((e) => e.ruta)).toEqual(['a', 'lista.0', 'lista.1.b', 'noHace.0']);
    expect(visto.map((e) => e.negativo)).toEqual([false, false, false, true]);
    expect(enlaces({ x: [{ href: '#a' }, { y: { href: 'https://b' } }] })).toEqual([
      '#a',
      'https://b',
    ]);
  });

  it('tells a link to GitHub by its host, not by a piece of text somewhere in the address', () => {
    expect(esDeGithub('https://github.com/diego/repo')).toBe(true);
    expect(esDeGithub('https://www.github.com/diego/repo')).toBe(true);
    expect(esDeGithub('https://wa.me/573000000000?text=github.com')).toBe(false);
    expect(esDeGithub('https://notgithub.com')).toBe(false);
    expect(esDeGithub('#github.com')).toBe(false);
    expect(esDeGithub('/capturas/github.com.webp')).toBe(false);
  });

  it('reads enough of the content for the rules to mean something', () => {
    expect(todas.length).toBeGreaterThan(70);
    expect(new Set(todas.map((e) => e.seccion)).size).toBeGreaterThanOrEqual(12);
  });

  it('has no empty text, no text with spaces at the ends and no marker of something left to do', () => {
    for (const e of todas) {
      expect(e.texto.trim(), e.ruta).not.toBe('');
      expect(e.texto, e.ruta).toBe(e.texto.trim());
      expect(e.texto, e.ruta).not.toMatch(/\[|\]|\bTODO\b|\bPENDIENTE\b|lorem ipsum|\bxxx\b/);
    }
  });
});

describe('invoicing: the page never says it issues electronic invoices (the table of claims)', () => {
  const FACTURA = /\bfactur|\bDIAN\b/i;
  // Desde el rediseño comercial (27 de octubre de 2026) la portada ya no lo dice: lo dice la sección de lo que incluye, las preguntas y el pie.
  const donde = ['incluye', 'preguntas', 'pie'];

  it('does not mention invoicing or the DIAN outside what it includes, the questions and the footer', () => {
    expect(rutas(fuera(...donde).filter((e) => FACTURA.test(e.texto)))).toEqual([]);
  });

  it('where it mentions them, it is to say that it does not do it or that the invoicing stays where it is', () => {
    for (const e of afirmaciones.filter((a) => donde.includes(a.seccion))) {
      for (const frase of frases(e.texto).filter((f) => FACTURA.test(f))) {
        expect(e.negativo || NEGACION.test(frase), `${e.ruta}: ${frase}`).toBe(true);
      }
    }
  });

  it('never says that it complies with, is certified by or is approved by the DIAN', () => {
    expect(
      rutas(
        todas.filter((e) => /cumple con|certificad|homologad|aprobad\w+ por|avalad/i.test(e.texto)),
      ),
    ).toEqual([]);
  });

  it('says it out loud in what it includes, the questions and the footer, which is what makes the page credible', () => {
    expect(contenido.incluye.noHace.join(' ')).toMatch(/no la emite/i);
    expect(contenido.incluye.noHace.join(' ')).toMatch(/factura electr[oó]nica/i);
    expect(contenido.incluye.pie).toMatch(/Comprobante de venta — no es factura/);
    expect(contenido.pie.aviso).toMatch(/No es un facturador electr[oó]nico/);
    expect(contenido.preguntas.items.map((p) => p.pregunta).join(' ')).toMatch(/factura/i);
  });
});

describe('cards: it records how the customer paid, it does not charge', () => {
  const TARJETA = /tarjeta|dat[aá]fono|pasarela/i;

  it('mentions cards only to say that it registers them or that it does not process them', () => {
    for (const e of afirmaciones) {
      for (const frase of frases(e.texto).filter((f) => TARJETA.test(f))) {
        expect(
          e.negativo || /\b(no|ni|registr\w*|referencia)\b/i.test(frase),
          `${e.ruta}: ${frase}`,
        ).toBe(true);
      }
    }
  });

  it('never says that it processes payments, charges cards or accepts them', () => {
    expect(
      rutas(
        afirmaciones.filter((e) =>
          /(procesa|procesamos|acepta|aceptamos|cobra|cobramos|cobrar)\s+(pagos|tarjetas?|con tarjeta)/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('answers the question about cards with a no', () => {
    const pregunta = contenido.preguntas.items.find((p) => /tarjeta/i.test(p.pregunta));

    expect(pregunta?.respuesta).toMatch(/^No\b/);
  });
});

describe('prices, plans and promotions: they do not exist yet (Diego, 22 de octubre)', () => {
  it('never talks about being free, plans, subscriptions, discounts or currencies', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /gratis|gratuit|sin costo|suscripci[oó]n|mensualidad|por mes|al mes|\bplanes?\b|\bUSD\b|\bCOP\b|descuento|oferta|promoci[oó]n/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('answers the question about the price with «cotiza con un asesor», and never with a figure', () => {
    const precio = contenido.preguntas.items.find((p) => /cu[aá]nto cuesta/i.test(p.pregunta));

    expect(precio, 'la pregunta del precio').toBeDefined();
    expect(precio?.respuesta).toMatch(/Cotiza con un asesor/);
    expect(precio?.respuesta).not.toMatch(/\d/);
  });

  it('says nothing about what it costs anywhere else: no «cobramos», no costs, no «tarifa de VSD»', () => {
    for (const e of afirmaciones.filter(
      (a) => a.seccion === 'preguntas' && !/^preguntas\.items\.0\./.test(a.ruta),
    )) {
      expect(e.texto, e.ruta).not.toMatch(
        /cu[aá]nto (cuesta|cobran|vale)|\bcostos?\b|cobramos|tarifa de vsd/i,
      );
    }
    expect(
      rutas(
        fuera('preguntas').filter((e) =>
          /\bcuesta\b|\bcostos?\b|cobramos|tarifa de vsd/i.test(e.texto),
        ),
      ),
    ).toEqual([]);
  });

  it('writes no amount of money in the text: every figure the page shows comes from data checked against the domain', () => {
    expect(rutas(todas.filter((e) => /\$\s*\d|\d\s*(pesos|mil)\b/i.test(e.texto)))).toEqual([]);
  });

  it('only talks about the rates of VAT that exist', () => {
    const permitidas = new Set(TAX_RATES_BP.map((bp) => String(bp / 100)));

    for (const e of todas) {
      for (const match of e.texto.matchAll(/(\d+(?:,\d+)?)\s?%/g)) {
        expect(permitidas.has(match[1] ?? ''), `${e.ruta}: ${match[0]}`).toBe(true);
      }
    }
  });
});

describe('open source: the repositories are public but they have no license', () => {
  it('never says open source, free software or open code', () => {
    expect(
      rutas(
        todas.filter((e) => /open[\s-]?source|c[oó]digo abierto|software libre/i.test(e.texto)),
      ),
    ).toEqual([]);
  });

  it('has no link to the repositories: the page speaks to a shopkeeper, not to a developer (Diego, 27 de octubre)', () => {
    expect(enlaces(contenido).filter(esDeGithub)).toEqual([]);
    expect(
      rutas(
        todas.filter((e) => /\bc[oó]digo (publicado|de la)\b|repositorio|GitHub/i.test(e.texto)),
      ),
    ).toEqual([]);
  });
});

describe('testimonials and numbers of customers: there are none', () => {
  it('does not talk about opinions, reviews or how many stores use it', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /testimonio|rese[ñn]a|opini[oó]n de|nos recomiendan|conf[ií]an en nosotros|\d+\s+(tiendas|negocios|clientes|comercios|usuarios)/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('has no section of social proof: no quotes and no «trust» block (nobody has given permission, and there are no customers yet)', () => {
    expect(Object.keys(contenido)).not.toContain('confianza');
    expect(Object.keys(contenido)).not.toContain('testimonios');
    expect(rutas(todas.filter((e) => /\bcita\b|permiso por escrito/i.test(e.texto)))).toEqual([]);
  });
});

describe('what was not measured or not tried is not promised', () => {
  it('has no speed in milliseconds and no "instant": the 100 ms were measured with a slowed CPU, not on a real phone', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /\d+\s?ms\b|milisegundos|instant[aá]ne|ultr[ao]r[aá]pid|el m[aá]s r[aá]pid/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('mentions phones only in the questions, and to say that it is being tried or has not been tried', () => {
    const CELULAR = /android|iphone|\bios\b|samsung|xiaomi|gama baja/i;

    expect(rutas(fuera('preguntas').filter((e) => CELULAR.test(e.texto)))).toEqual([]);
    for (const e of afirmaciones.filter((a) => a.seccion === 'preguntas')) {
      for (const frase of frases(e.texto).filter((f) => CELULAR.test(f))) {
        expect(
          /todav[ií]a no (lo )?(probamos|hemos probado)|estamos probando/i.test(frase),
          `${e.ruta}: ${frase}`,
        ).toBe(true);
      }
    }
  });

  it('makes no claim of savings, growth or superlatives that nobody measured', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /ahorr|aumenta\w* tus ventas|m[aá]s ganancias|incrementa|el mejor|n[uú]mero 1|l[ií]der|sin igual|garantiz|nunca falla|sin errores|cero errores/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('names no competitor', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /alegra|siigo|restaurant\.?pe|loggro|world\s?office|zoho|square|clover|shopify|odoo|quickbooks|contifico/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });
});

describe('what does not exist yet is not promised anywhere: there is no «what is coming» section any more', () => {
  const FUTURO =
    /exent[oa]|excluid[oa]|n[uú]mero propio para cada anulaci[oó]n|c[aá]mara|varias formas de pago|m[uú]ltiples? (formas|medios) de pago|cuentas por cobrar|copias? de seguridad|backup|sucursal|nube/i;

  it('keeps those features out of the whole page, so no card or answer promises them as if they existed', () => {
    expect(rutas(todas.filter((e) => FUTURO.test(e.texto)))).toEqual([]);
  });

  it('has no list of intentions or dates: what is not there is not announced', () => {
    expect(Object.keys(contenido)).not.toContain('loQueViene');
    expect(
      rutas(
        todas.filter((e) =>
          /\bDECIDIDO\b|lo que viene|no es una promesa de fechas|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('tells what the monthly summary is for, and that it is for internal control and not the VAT declaration', () => {
    const reporte = contenido.funciones.destacadas.find((f) => f.id === 'reporte');

    expect(reporte?.texto).toMatch(/control interno/);
    expect(reporte?.texto).toMatch(/no es tu declaraci[oó]n de IVA/);
  });
});

describe('the page collects nothing: sign-in and sign-up are links to the app, and contact is a WhatsApp chat', () => {
  /** Todo objeto del contenido que es un botón o un enlace: su texto y su dirección. */
  function botones(valor: unknown): { texto: string; href: string }[] {
    if (Array.isArray(valor)) return valor.flatMap((item) => botones(item as unknown));
    if (valor !== null && typeof valor === 'object') {
      const objeto = valor as Record<string, unknown>;
      const propio =
        typeof objeto['texto'] === 'string' && typeof objeto['href'] === 'string'
          ? [{ texto: objeto['texto'], href: objeto['href'] }]
          : [];
      return [...propio, ...Object.values(objeto).flatMap((item) => botones(item))];
    }
    return [];
  }
  const todosLosBotones = botones(contenido);
  const HABLA_DE_ENTRAR =
    /solicit(a|ar) (tu|mi) acceso|crea(r)? (tu |mi )?cuenta|reg[ií]strate|inicia(r)? sesi[oó]n/i;

  it('does not offer forms, e-mail or a way to leave data in the page', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /formulario|correo|e-?mail|mailto|deja(nos)? tus datos|@\w+\.\w+/i.test(e.texto),
        ),
      ),
    ).toEqual([]);
  });

  it('talks about signing in or requesting access only in the buttons that go to the app', () => {
    const conEnlace = todosLosBotones.filter((b) => HABLA_DE_ENTRAR.test(b.texto));

    expect(conEnlace.length).toBeGreaterThanOrEqual(4);
    for (const boton of conEnlace) {
      expect([APP_INGRESAR, APP_REGISTRARSE], boton.texto).toContain(boton.href);
    }
    // Ninguna otra frase del contenido lo dice sin ser el texto de un botón: la cuenta se pide con un botón, no se describe.
    const botonesPorTexto = new Set(conEnlace.map((b) => b.texto));
    const sueltas = todas.filter(
      (e) =>
        HABLA_DE_ENTRAR.test(e.texto) &&
        !(e.ruta.endsWith('.texto') && botonesPorTexto.has(e.texto)),
    );
    expect(rutas(sueltas)).toEqual([]);
  });

  it('sends sign-in to /ingresar and the request for access to /registrarse, both in the app', () => {
    expect(APP_INGRESAR).toBe(`${APP_DE_PRE}/ingresar`);
    expect(APP_REGISTRARSE).toBe(`${APP_DE_PRE}/registrarse`);
    expect(contenido.navegacion.ingresar.href).toBe(APP_INGRESAR);
    expect(contenido.navegacion.cta.href).toBe(APP_REGISTRARSE);
    expect(contenido.hero.ctaPrincipal.href).toBe(APP_REGISTRARSE);
    expect(contenido.cta.principal.href).toBe(APP_REGISTRARSE);
  });

  it('names the buttons as the shopkeeper reads them: «Solicitar mi acceso», «Hablar con un asesor» and «Iniciar sesión»', () => {
    expect(contenido.navegacion.cta.texto).toBe('Solicitar mi acceso');
    expect(contenido.hero.ctaPrincipal.texto).toBe('Solicitar mi acceso');
    expect(contenido.cta.principal.texto).toBe('Solicitar mi acceso');
    expect(contenido.hero.ctaSecundario.texto).toBe('Hablar con un asesor');
    expect(contenido.cta.secundario.texto).toBe('Hablar con un asesor');
    expect(contenido.navegacion.ingresar.texto).toBe('Iniciar sesión');
  });

  it('opens a WhatsApp chat with the number of Diego and a message that asks for an advisor', () => {
    const url = new URL(WHATSAPP_URL);

    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/573245889281');
    expect(url.searchParams.get('text')).toBe(
      'Hola, quiero hablar con un asesor sobre VSD Stock para mi negocio.',
    );
  });

  it('uses that link in every «Hablar con un asesor», and says it opens WhatsApp', () => {
    const asesor = todosLosBotones.filter((b) => /asesor/i.test(b.texto));

    expect(asesor.length).toBeGreaterThanOrEqual(3);
    for (const boton of asesor) expect(boton.href, boton.texto).toBe(WHATSAPP_URL);
    expect(contenido.cta.avisoAsesor).toMatch(/WhatsApp/);
  });
});

describe('the page does not look like a test (Diego, 27 de octubre de 2026)', () => {
  const PRUEBAS =
    /\bpruebas?\b|\bbeta\b|preproducci[oó]n|\bpiloto\b|\bfase\b|ambiente|ficticio|\bdemo\b|primeras tiendas|buscamos tiendas|versi[oó]n de prueba|prototipo/i;

  it('says nothing like «en pruebas», «beta», «preproducción», «piloto» or «ambiente de pruebas»', () => {
    expect(rutas(todas.filter((e) => e.seccion !== 'anclas' && PRUEBAS.test(e.texto)))).toEqual([]);
  });

  it('has no notice on top, no contact bar and no link to a demo with made-up data', () => {
    for (const quitada of ['anuncio', 'barraContacto', 'estadoDemo', 'confianza', 'loQueViene']) {
      expect(Object.keys(contenido), quitada).not.toContain(quitada);
    }
    expect(
      rutas(todas.filter((e) => /datos ficticios|con ventas de ejemplo/i.test(e.texto))),
    ).toEqual([]);
  });

  it('keeps one sentence about trying: the answer about phones stays as Diego left it (26 de octubre)', () => {
    const conProbar = todas.filter((e) => /\bprobando\b|\bprobamos\b|\bprobado\b/i.test(e.texto));
    const indiceDelTelefono = contenido.preguntas.items.findIndex((p) =>
      /tel[ée]fono/i.test(p.pregunta),
    );

    // La tarjeta de funcionar sin conexión dice que se verificó con la red cortada: es un hecho, no una prueba pendiente.
    expect(rutas(conProbar).sort()).toEqual(
      [
        'funciones.tarjetas.0.texto',
        `preguntas.items.${String(indiceDelTelefono)}.respuesta`,
      ].sort(),
    );
  });

  it('answers the phone question exactly as before: it is being tried on a real Android and the iPhone was not tried yet', () => {
    const telefono = contenido.preguntas.items.find((p) => /tel[ée]fono/i.test(p.pregunta));

    expect(telefono?.respuesta).toBe(
      'Lo estamos probando en un Android real; hasta terminar no prometemos velocidad en equipos de gama baja. En iPhone todavía no lo probamos: Safari puede borrar lo guardado si no se usa en varios días, por eso allí conviene enviar las ventas pronto.',
    );
  });
});

describe('the links', () => {
  const anclas = new Set<string>(Object.values(contenido.anclas));
  const todos = enlaces(contenido);

  it('are only these: WhatsApp, the app (its sign-in and sign-up) and the sections of the page', () => {
    expect(todos.length).toBeGreaterThan(10);
    for (const href of todos) {
      const permitido =
        href.startsWith('#') ||
        href === WHATSAPP_URL ||
        href === APP_INGRESAR ||
        href === APP_REGISTRARSE;
      expect(permitido, href).toBe(true);
    }
  });

  it('go to https and never send anything in the address', () => {
    for (const href of todos.filter((h) => !h.startsWith('#'))) {
      expect(href.startsWith('https://'), href).toBe(true);
      if (href !== WHATSAPP_URL) expect(href, href).not.toContain('?');
    }
  });

  it('lead to a section that exists', () => {
    for (const href of todos.filter((h) => h.startsWith('#'))) {
      expect(anclas.has(href.slice(1)), href).toBe(true);
    }
  });

  it('give every section its own anchor', () => {
    expect(new Set(Object.values(contenido.anclas)).size).toBe(
      Object.values(contenido.anclas).length,
    );
  });
});

describe('the examples of VAT shown by the page are the ones the domain calculates', () => {
  it('are the five that the external accounting review recalculated, no more and no less', () => {
    expect(contenido.ejemplosIva).toHaveLength(5);
  });

  it('split every price into base and VAT exactly as the product does, and base plus VAT is the total', () => {
    for (const e of contenido.ejemplosIva) {
      const { base, tax } = splitTaxIncluded(Money.of(e.total), e.tarifaBp);

      expect(e.base, `${String(e.total)} al ${String(e.tarifaBp)}`).toBe(base.amount);
      expect(e.iva, `${String(e.total)} al ${String(e.tarifaBp)}`).toBe(tax.amount);
      expect(e.base + e.iva).toBe(e.total);
      expect(TAX_RATES_BP).toContain(e.tarifaBp);
    }
  });

  it('feature the example of the card of VAT and the three of the calculator', () => {
    const totales = contenido.ejemplosIva.map((e) => `${String(e.total)}@${String(e.tarifaBp)}`);

    expect(totales).toEqual(expect.arrayContaining(['11900@1900', '10000@1900', '3500@500']));
    expect(contenido.funciones.tarjetas.find((t) => t.id === 'iva')?.ejemplo).toEqual({
      total: 11900,
      tarifaBp: 1900,
    });
  });

  it('open the calculator on the example of the card of VAT, which is one of the five that were reviewed', () => {
    const { ejemplo } = contenido.calculadora;

    expect(ejemplo).toEqual(contenido.funciones.tarjetas.find((t) => t.id === 'iva')?.ejemplo);
    expect(contenido.ejemplosIva).toContainEqual(expect.objectContaining(ejemplo));
  });

  it('gives the cash count a fixed expected amount, in whole pesos', () => {
    expect(Number.isInteger(contenido.arqueo.esperado)).toBe(true);
    expect(contenido.arqueo.esperado).toBeGreaterThan(0);
  });
});

describe('the figures of the page are the ones that can be checked', () => {
  const permisos = JSON.parse(readFileSync(join(ROOT, 'contract/permissions.json'), 'utf8')) as {
    roles: string[];
    actions: Record<string, { roles: string[]; offline: boolean }>;
  };

  it('says three roles because the contract of permissions has three', () => {
    expect(contenido.funciones.tarjetas.find((t) => t.id === 'roles')?.roles).toHaveLength(
      permisos.roles.length,
    );
  });

  it('says the cashier cannot see profit or void sales because the contract says so, and that it can sell and close its shift', () => {
    const rolesDe = (accion: string): string[] => permisos.actions[accion]?.roles ?? [];

    expect(rolesDe('report:profit')).not.toContain('cashier');
    expect(rolesDe('sale:void')).not.toContain('cashier');
    expect(rolesDe('sale:create')).toContain('cashier');
    expect(rolesDe('shift:close')).toContain('cashier');
    const tarjeta = contenido.funciones.tarjetas.find((t) => t.id === 'roles');
    expect(tarjeta?.texto).toMatch(/no ve utilidades ni anula ventas/);
  });

  it('says what works without a connection exactly as the contract does, and no more', () => {
    const sinRed = Object.entries(permisos.actions)
      .filter(([, accion]) => accion.offline)
      .map(([nombre]) => nombre)
      .sort();

    expect(sinRed).toEqual([
      'payment:collect-cash',
      'product:view',
      'sale:create',
      'sale:view-own-shift',
      'shift:close',
      'shift:open',
      'stock:view',
    ]);
    const sinConexion = contenido.funciones.tarjetas.find((t) => t.id === 'sin-conexion');
    expect(sinConexion?.texto).toMatch(
      /Vender, registrar el cobro, abrir y cerrar turno y consultar existencias/,
    );
    const pregunta = contenido.preguntas.items.find((p) => /sin internet/i.test(p.pregunta));
    expect(pregunta?.respuesta).toMatch(
      /Administrar el cat[aá]logo, los precios, las personas y los reportes s[ií] necesita conexi[oó]n/,
    );
  });

  it('has the example of a receipt number in the form the product writes it (ADR 0016)', () => {
    const tarjeta = contenido.funciones.tarjetas.find((t) => t.id === 'sin-conexion');

    expect(tarjeta?.texto).toMatch(/\b[A-Z0-9]{2,4}-\d{6}\b/);
  });

  it('shows no figure about tests, simulated devices or reviews: the page sells a product, it does not report an exam', () => {
    expect(
      rutas(
        todas.filter((e) => /\d+ de \d+|simulad|pruebas autom[aá]ticas|\d+ cajas/i.test(e.texto)),
      ),
    ).toEqual([]);
  });
});

describe('the promises that the team keeps', () => {
  it('keeps «te acompañamos desde el primer turno», which Diego confirmed is a fact', () => {
    expect(contenido.cta.subtitulo).toMatch(/Te acompañamos desde el primer turno/);
    expect(contenido.hero.nota).toMatch(/Te acompañamos desde el primer turno/);
  });

  it('keeps the note that the VAT is validated with whoever files the declarations of the store before selling', () => {
    const iva = contenido.funciones.tarjetas.find((t) => t.id === 'iva');

    expect(iva?.nota).toMatch(/revisión contable externa/);
    expect(iva?.nota).toMatch(/Antes de empezar a vender/);
    expect(iva?.nota).toMatch(/quien lleva las declaraciones de tu tienda/);
  });

  it('keeps the honest section of what it includes and what stays as it is today', () => {
    expect(contenido.incluye.hace.length).toBeGreaterThanOrEqual(5);
    expect(contenido.incluye.noHace.length).toBeGreaterThanOrEqual(3);
  });
});

// Auditoría de QA (25 de octubre de 2026): la página se leyó como la leería un tendero y marcó la jerga técnica. Estas pruebas
// impiden que vuelva. La lista sale de la tabla de la auditoría; cada palabra tiene su frase de tendero en `contenido.ts`.
describe('the page speaks the language of a shopkeeper (the audit of QA)', () => {
  const JERGA: readonly [RegExp, string][] = [
    [/\bservidor\b/i, 'servidor: «tu cuenta»'],
    [/\b(backend|frontend)\b/i, 'backend y frontend: «información técnica»'],
    [/\bADR\b|arquitectura/i, 'ADR y arquitectura: «información técnica»'],
    [/\bcola\b/i, 'cola de envío: «ventas por enviar»'],
    [/\bfolios?\b/i, 'folio: «numeración de los comprobantes»'],
    [/gerencia/i, 'gerencia: «el dueño o administrador»'],
    [/\bdemo\b/i, 'demo: «míralo funcionar»'],
    [/piloto/i, 'tienda piloto: «hablar con un asesor»'],
    [/\bbase\b/i, 'base: «valor sin IVA»'],
    [/recalcul/i, 'recalculó: «comprobó»'],
    [/en vivo/i, 'en vivo: «con ventas reales»'],
    [/a la vista/i, 'a la vista: «publicado para revisión»'],
    [
      /no tiene due[ñn]o|compensan|la l[ií]nea te avisa|olvidar/i,
      'frases de la tabla de la auditoría',
    ],
    [/cortar internet|corta el internet/i, 'cortar internet: «simular una caída de internet»'],
  ];

  // `anclas` son los nombres de las secciones en la dirección (#demo, #piloto): no se leen en la página, se escriben en la barra.
  it.each(JERGA)('does not use %s anywhere in the page', (palabra, cambio) => {
    expect(
      rutas(todas.filter((e) => e.seccion !== 'anclas' && palabra.test(e.texto))),
      `Cámbialo: ${cambio}`,
    ).toEqual([]);
  });

  it('says that the switch of the diagram is a simulation', () => {
    expect(contenido.diagrama.interruptor).toMatch(/Simular una caída de internet/);
  });

  it('does not promise that the cash always balances: it tells how much is missing or left over when closing', () => {
    const caja = contenido.funciones.destacadas.find((f) => f.id === 'caja');

    expect(caja?.titulo).toMatch(/cuánto falta o sobra al cerrar/i);
    expect(rutas(todas.filter((e) => /una caja que cuadra/i.test(e.texto)))).toEqual([]);
  });

  it('says who reviews a closing with a difference: the owner or the administrator', () => {
    const caja = contenido.funciones.destacadas.find((f) => f.id === 'caja');

    expect(caja?.texto).toMatch(/para que el dueño o administrador la revise/);
  });

  it('says that closing the session before sending the sales loses them (the app does ask before)', () => {
    const datos = contenido.preguntas.items.find((p) => /mis datos/i.test(p.pregunta));

    expect(datos?.respuesta).toMatch(
      /Si cierras sesión antes de enviarlas, esas ventas se perderán/,
    );
  });

  it('tells the shopkeeper where the sale went: to the account, in the same words as the receipt of the app', () => {
    const recibo = readFileSync(join(ROOT, 'src/presentation/pages/ReceiptPage.tsx'), 'utf8');

    expect(contenido.diagrama.enviada).toBe('Venta guardada en tu cuenta.');
    expect(recibo).toContain(contenido.diagrama.enviada);
    expect(recibo).toContain(contenido.diagrama.guardada);
  });

  it('puts what is left of the technical world nowhere: no «información técnica», no «decisiones», no code to review', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /informaci[oó]n t[eé]cnica|decisiones? t[eé]cnicas?|especialistas/i.test(e.texto),
        ),
      ),
    ).toEqual([]);
  });

  it('separates the VAT that is already inside the price, and says "valor sin IVA" instead of "base"', () => {
    expect(contenido.incluye.hace).toContain('Separa el IVA que ya está incluido en el precio');
    expect(contenido.funciones.miniaturas.iva.base).toBe('Valor sin IVA');
    expect(contenido.calculadora.suma).toBe('Valor sin IVA más IVA');
  });
});

describe('what has to be settled before the page is published', () => {
  it('says, for each pending thing there is, what it is and who has to settle it', () => {
    for (const pendiente of PENDIENTES_DE_PUBLICAR) {
      expect(pendiente.que.trim(), 'sin descripcion').not.toBe('');
      expect(pendiente.quien.trim(), pendiente.que).not.toBe('');
    }
  });

  it('has nothing left to settle: the answer about phones stays as it is (Diego, 2026-10-26), so the page can be published', () => {
    expect(PENDIENTES_DE_PUBLICAR).toHaveLength(0);
    expect(puedePublicar(PENDIENTES_DE_PUBLICAR)).toEqual({ puede: true, pendientes: [] });
  });

  it('no longer waits for the reading aloud with a shopkeeper, nor for the legal notice of the first WhatsApp reply', () => {
    const todo = PENDIENTES_DE_PUBLICAR.map((pendiente) => pendiente.que).join(' ');

    expect(todo).not.toMatch(/voz alta|tienda/i);
    expect(todo).not.toMatch(/WhatsApp|1581|aviso/i);
  });

  it('refuses to publish while anything is pending, and says what', () => {
    expect(puedePublicar([])).toEqual({ puede: true, pendientes: [] });

    const sin = puedePublicar([{ que: 'Leerla en voz alta con un tendero', quien: 'Diego' }]);
    expect(sin.puede).toBe(false);
    expect(sin.pendientes).toEqual(['Leerla en voz alta con un tendero (Diego)']);
  });
});
