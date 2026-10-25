// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Money } from '../../src/domain/model/money';
import { TAX_RATES_BP, splitTaxIncluded } from '../../src/domain/model/tax';
import {
  DEMO_DE_PRE,
  REPOSITORIO_BACKEND,
  REPOSITORIO_FRONTEND,
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

const todas = entradas(contenido);
/** Lo que la pagina AFIRMA: todo menos las preguntas, que nombran lo que se pregunta y se contestan en su respuesta. */
const afirmaciones = todas.filter((e) => !e.ruta.endsWith('.pregunta'));
const frases = (texto: string): string[] => texto.split(/(?<=[.!?…])\s+/);
const NEGACION = /\b(no|ni|sin|nunca|todav[ií]a|sigue)\b/i;

/** Las entradas de una seccion o de varias. */
const de = (...secciones: string[]): Entrada[] =>
  todas.filter((e) => secciones.includes(e.seccion));
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

  it('reads enough of the content for the rules to mean something', () => {
    expect(todas.length).toBeGreaterThan(80);
    expect(new Set(todas.map((e) => e.seccion)).size).toBeGreaterThanOrEqual(12);
  });

  it('has no empty text, no text with spaces at the ends and no marker of something left to do', () => {
    for (const e of todas) {
      expect(e.texto.trim(), e.ruta).not.toBe('');
      expect(e.texto, e.ruta).toBe(e.texto.trim());
      // El estado de «lo que viene» se llama PENDIENTE a proposito: es una etiqueta de la lista, no algo que se olvido.
      if (!e.ruta.endsWith('.estado')) {
        expect(e.texto, e.ruta).not.toMatch(/\[|\]|\bTODO\b|\bPENDIENTE\b|lorem ipsum|\bxxx\b/);
      }
    }
  });
});

describe('invoicing: the page never says it issues electronic invoices (the table of claims)', () => {
  const FACTURA = /\bfactur|\bDIAN\b/i;
  // La portada también lo dice, junto al primer botón (auditoría de QA): una tienda lo lee antes de escribirnos.
  const donde = ['hero', 'limites', 'preguntas', 'pie'];

  it('does not mention invoicing or the DIAN outside the hero, the limits, the questions and the footer', () => {
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

  it('says it out loud in the hero, the limits, the questions and the footer, which is what makes the page credible', () => {
    expect(contenido.hero.nota).toMatch(/no emite factura electr[oó]nica/i);
    expect(contenido.limites.noHace.join(' ')).toMatch(/factura electr[oó]nica/i);
    expect(contenido.limites.pie).toMatch(/Comprobante de venta — no es factura/);
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

  it('has no question about what VSD Stock costs, and no answer that says it', () => {
    for (const e of de('preguntas').filter((p) => p.ruta.endsWith('.pregunta'))) {
      expect(e.texto, e.ruta).not.toMatch(/precio|cu[aá]nto (cuesta|cobran|vale)|cost|vale\b/i);
    }
    for (const e of de('preguntas').filter((p) => !p.ruta.endsWith('.pregunta'))) {
      expect(e.texto, e.ruta).not.toMatch(
        /cu[aá]nto (cuesta|cobran|vale)|\bcostos?\b|cobramos|tarifa de vsd/i,
      );
    }
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

  it('says that the code is published for specialists to review instead, and links both repositories', () => {
    const confianza = contenido.confianza.puntos.find(
      (p) => p.titulo === 'Código publicado para revisión',
    );

    expect(confianza).toBeDefined();
    expect(confianza?.enlaces.map((e) => e.href)).toEqual([
      REPOSITORIO_BACKEND,
      REPOSITORIO_FRONTEND,
    ]);
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

  it('publishes a quote only with the written permission of the person, described well enough to find it', () => {
    for (const t of contenido.confianza.testimonios) {
      expect(t.cita.trim(), 'una cita sin texto').not.toBe('');
      expect(t.autor.trim(), 'una cita sin autor').not.toBe('');
      expect(
        t.permiso.trim().length,
        'sin permiso por escrito no se publica una cita: dice dónde está',
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('has none today, so the page shows none (and the day there is one, this line changes with its permission)', () => {
    expect(contenido.confianza.testimonios).toHaveLength(0);
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

describe('what does not exist yet only appears under "what is coming" and in the limits', () => {
  const FUTURO =
    /reporte(s)? mensual|exent[oa]|excluid[oa]|n[uú]mero propio para cada anulaci[oó]n|c[aá]mara|varias formas de pago|m[uú]ltiples? (formas|medios) de pago|cuentas por cobrar|copias? de seguridad|backup|sucursal|nube/i;

  it('keeps those features out of the rest of the page, so no card or answer promises them as if they existed', () => {
    expect(rutas(fuera('loQueViene', 'limites').filter((e) => FUTURO.test(e.texto)))).toEqual([]);
  });

  it('lists them where it is said that they are coming, each one marked as decided or pending', () => {
    const lista = contenido.loQueViene.items.map((i) => i.texto).join(' ');

    for (const futuro of [
      /exent/i,
      /excluid/i,
      /reporte mensual/i,
      /n[uú]mero propio para cada anulaci[oó]n/i,
      /c[aá]mara/i,
      /varias formas de pago/i,
    ]) {
      expect(lista).toMatch(futuro);
    }
    for (const item of contenido.loQueViene.items)
      expect(['DECIDIDO', 'PENDIENTE']).toContain(item.estado);
  });

  it('says that those are intentions and not dates', () => {
    expect(contenido.loQueViene.pie).toMatch(/no es una promesa de fechas/i);
    expect(
      rutas(
        de('loQueViene').filter((e) =>
          /\b20\d\d\b|\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });
});

describe('there is no account, no form and no way to leave data in the page: contact is a WhatsApp chat', () => {
  it('does not offer accounts, registration, forms or e-mail', () => {
    expect(
      rutas(
        todas.filter((e) =>
          /formulario|correo|e-?mail|mailto|crea tu cuenta|reg[ií]strate|inicia(r)? sesi[oó]n|deja(nos)? tus datos|@\w+\.\w+/i.test(
            e.texto,
          ),
        ),
      ),
    ).toEqual([]);
  });

  it('opens a WhatsApp chat with the number of Diego and the message already written', () => {
    const url = new URL(WHATSAPP_URL);

    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/573245889281');
    expect(url.searchParams.get('text')).toBe('Hola, quiero probar VSD Stock en mi tienda.');
  });

  it('uses that link in every call to action to be a pilot store, and says it opens WhatsApp', () => {
    const botones = [
      contenido.hero.ctaPrincipal,
      contenido.cta.boton,
      contenido.navegacion.cta,
      contenido.anuncio.enlace,
    ];

    for (const boton of botones) expect(boton.href, boton.texto).toBe(WHATSAPP_URL);
    expect(contenido.cta.avisoBoton).toMatch(/WhatsApp/);
  });

  it('links the demo of PRE publicly, from the hero and from the demo band', () => {
    expect(contenido.hero.ctaSecundario.href).toBe(DEMO_DE_PRE);
    expect(contenido.demo.boton.href).toBe(DEMO_DE_PRE);
  });
});

describe('the links', () => {
  const anclas = new Set<string>(Object.values(contenido.anclas));
  const todos = enlaces(contenido);

  it('are only these: WhatsApp, the demo of PRE, our two repositories and their documents, and the sections of the page', () => {
    expect(todos.length).toBeGreaterThan(10);
    for (const href of todos) {
      const permitido =
        href.startsWith('#') ||
        href === WHATSAPP_URL ||
        href === DEMO_DE_PRE ||
        href.startsWith(`${REPOSITORIO_BACKEND}/`) ||
        href.startsWith(`${REPOSITORIO_FRONTEND}/`) ||
        href === REPOSITORIO_BACKEND ||
        href === REPOSITORIO_FRONTEND;
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
    expect(Number.isInteger(contenido.comoFunciona.arqueo.esperado)).toBe(true);
    expect(contenido.comoFunciona.arqueo.esperado).toBeGreaterThan(0);
  });
});

describe('the figures of the page are the ones that can be checked', () => {
  const permisos = JSON.parse(readFileSync(join(ROOT, 'contract/permissions.json'), 'utf8')) as {
    roles: string[];
    actions: Record<string, { roles: string[]; offline: boolean }>;
  };
  const cifra = (inicio: RegExp): string =>
    contenido.demo.cifras.find((c) => inicio.test(c.valor))?.valor ?? '';

  it('says "5 de 5" because there are five examples and they match', () => {
    expect(cifra(/de/)).toBe(
      `${String(contenido.ejemplosIva.length)} de ${String(contenido.ejemplosIva.length)}`,
    );
  });

  it('says three roles because the contract of permissions has three', () => {
    expect(cifra(/roles/)).toBe(`${String(permisos.roles.length)} roles`);
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

  it('shows the simulation of six devices as what it is: automatic tests, not customers', () => {
    expect(cifra(/cajas/)).toBe('6 cajas');
    const cifraSeis = contenido.demo.cifras.find((c) => /cajas/.test(c.valor));
    expect(cifraSeis?.texto).toMatch(/simuladas.*pruebas automáticas/);
    const pregunta = contenido.preguntas.items.find((p) => /dos cajas/i.test(p.pregunta));
    expect(pregunta?.respuesta).toMatch(/En pruebas automáticas simulamos seis/);
  });

  it('has the example of a folio in the form the product writes it (ADR 0016)', () => {
    const tarjeta = contenido.funciones.tarjetas.find((t) => t.id === 'sin-conexion');

    expect(tarjeta?.texto).toMatch(/\b[A-Z0-9]{2,4}-\d{6}\b/);
  });
});

describe('the demo of PRE: it says the data is fictional and that it may take a while to wake up', () => {
  it('warns about the 25 seconds and the dummy data next to every button that opens it', () => {
    expect(contenido.demo.nota).toMatch(/Datos ficticios/);
    expect(contenido.demo.nota).toMatch(/unos 25 segundos/);
    expect(contenido.hero.nota).toMatch(/datos ficticios/);
  });

  it('has the three states of the chip, and none of them says that the demo is down', () => {
    const estados = contenido.estadoDemo;

    expect(Object.keys(estados).sort()).toEqual(['despierta', 'dormida', 'verificando']);
    expect(estados.dormida).toMatch(/Prueba en reposo; la primera carga puede tardar ~25 s/);
    for (const texto of Object.values(estados)) {
      expect(texto, texto).not.toMatch(/ca[ií]d[ao]|fall[oa]|error|no funciona/i);
      expect(texto, texto).toMatch(/ficticios/i);
    }
  });
});

describe('the promises that the team keeps', () => {
  it('keeps "te acompañamos desde el primer turno", which Diego confirmed is a fact', () => {
    expect(contenido.cta.subtitulo).toMatch(/Te acompañamos desde el primer turno/);
  });

  it('keeps the note that the VAT is validated with whoever files the declarations of the store before selling live', () => {
    const iva = contenido.funciones.tarjetas.find((t) => t.id === 'iva');

    expect(iva?.nota).toMatch(/revisión contable externa/);
    expect(iva?.nota).toMatch(/Antes de usarlo con ventas reales/);
    const punto = contenido.confianza.puntos.find((p) => p.titulo === 'IVA revisado');
    expect(punto?.texto).toMatch(/quien lleva las declaraciones de tu tienda/);
  });

  it('keeps the honest limits section: what it does and what it does not do', () => {
    expect(contenido.limites.hace.length).toBeGreaterThanOrEqual(5);
    expect(contenido.limites.noHace.length).toBeGreaterThanOrEqual(4);
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
    [/\bdemo\b/i, 'demo: «prueba con ventas de ejemplo»'],
    [/piloto/i, 'tienda piloto: «probarlo en mi tienda»'],
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
    const caja = contenido.funciones.tarjetas.find((t) => t.id === 'caja');

    expect(caja?.titulo).toMatch(/cuánto falta o sobra al cerrar/i);
    expect(rutas(todas.filter((e) => /una caja que cuadra/i.test(e.texto)))).toEqual([]);
  });

  it('says who reviews a closing with a difference: the owner or the administrator', () => {
    const caja = contenido.funciones.tarjetas.find((t) => t.id === 'caja');

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

  it('tells the first load apart from the wake-up: "la primera carga puede tardar unos 25 segundos"', () => {
    expect(contenido.demo.nota).toMatch(/La primera carga puede tardar unos 25 segundos/);
  });

  it('puts the technical links under one name, "Información técnica", in the page and in the footer', () => {
    expect(contenido.confianza.sellosTitulo).toBe('Información técnica, para especialistas');
    expect(contenido.pie.columnas.map((c) => c.titulo)).toContain('Información técnica');
  });

  it('offers the first button as "probarlo en mi tienda" and the second as "probar con ventas de ejemplo"', () => {
    expect(contenido.hero.ctaPrincipal.texto).toBe('Quiero probarlo en mi tienda');
    expect(contenido.cta.boton.texto).toBe('Quiero probarlo en mi tienda');
    expect(contenido.hero.ctaSecundario.texto).toBe('Probar con ventas de ejemplo');
  });

  it('separates the VAT that is already inside the price, and says "valor sin IVA" instead of "base"', () => {
    expect(contenido.limites.hace).toContain('Separa el IVA que ya está incluido en el precio');
    expect(contenido.funciones.miniaturas.iva.base).toBe('Valor sin IVA');
    expect(contenido.calculadora.suma).toBe('Valor sin IVA más IVA');
  });
});

describe('what has to be settled before the page is published', () => {
  it('lists what is pending, and each pending thing says who has to settle it', () => {
    expect(PENDIENTES_DE_PUBLICAR.length).toBeGreaterThan(0);
    for (const pendiente of PENDIENTES_DE_PUBLICAR) {
      expect(pendiente.que.trim(), 'sin descripcion').not.toBe('');
      expect(pendiente.quien.trim(), pendiente.que).not.toBe('');
    }
  });

  it('waits only for the answer about phones, which needs the test on a real Android (Diego, 2026-10-25)', () => {
    expect(PENDIENTES_DE_PUBLICAR).toHaveLength(1);
    expect(PENDIENTES_DE_PUBLICAR[0]?.quien).toBe('Samuel');
    expect(PENDIENTES_DE_PUBLICAR[0]?.que).toMatch(/Android real/);
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
