// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inlineScriptHashes, siteHeaders } from '../../scripts/build-sitio';
import {
  NOMBRES_DE_COMPROBACIONES,
  codigoDeSalida,
  esperadoDelHtml,
  evaluarSitio,
  informe,
  rutaDeUnActivo,
  type Captura,
  type Esperado,
} from '../../scripts/verificar-sitio';

// Despues de publicar, `npm run verify:sitio -- <direccion>` pide la pagina como la pediria un navegador y comprueba lo que se
// prometio en el ticket C4-L8: que el HTML trae el texto, que los archivos con huella se guardan un ano, que el enlace de WhatsApp abre
// el chat, y que Cloudflare puso los encabezados que el sitio escribio (lo que `vite preview` no podia probar: ver docs/rendimiento-de-la-landing.md).
// Aqui se prueba la decision con respuestas armadas a mano; pedirlas a la red es lo unico que queda fuera.
const ORIGEN = 'https://vsd-stock-sitio.pages.dev';
const API = 'https://vsd-stock-api-pre.onrender.com';
const TITULO = 'VSD Stock';
const ENCABEZADO = 'Vende aunque se caiga el internet.';
const WHATSAPP =
  'https://wa.me/573245889281?text=Hola%2C%20quiero%20ser%20tienda%20piloto%20de%20VSD%20Stock.';

const DESTINO_DE_WHATSAPP =
  'https://api.whatsapp.com/send/?phone=573245889281&text=Hola%2C+quiero+ser+tienda+piloto+de+VSD+Stock.&type=phone_number&app_absent=0';

const POLITICA = [
  "default-src 'self'",
  "script-src 'self' 'sha256-abc123='",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${API}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${TITULO}</title>
<script>document.documentElement.dataset.theme = 'dark';</script>
<script type="module" crossorigin src="/assets/index-BGDs6-I4.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-Ccgq0Dn3.css"></head>
<body><div id="root"><h1 class="font-display">Vende <span>aunque se caiga</span> el internet.</h1>
<a href="${WHATSAPP}">Escríbenos</a></div></body></html>`;

const ESPERADO: Esperado = {
  titulo: TITULO,
  encabezado: ENCABEZADO,
  whatsappUrl: WHATSAPP,
  whatsappNumero: '573245889281',
  origenesDeConexion: [API],
};

const ENCABEZADOS_DE_LA_PAGINA: Readonly<Record<string, string>> = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=0, must-revalidate',
  'content-security-policy': POLITICA,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

/** Lo que devuelve un sitio bien publicado. Cada prueba lo estropea de a una cosa. */
function buena(): Captura {
  return {
    origen: ORIGEN,
    pagina: { status: 200, headers: ENCABEZADOS_DE_LA_PAGINA, html: HTML },
    activo: {
      ruta: '/assets/index-BGDs6-I4.js',
      status: 200,
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    whatsapp: { status: 302, headers: { location: DESTINO_DE_WHATSAPP } },
  };
}

function conPagina(cambios: {
  status?: number;
  html?: string;
  headers?: Readonly<Record<string, string>>;
}): Captura {
  const base = buena();
  return {
    ...base,
    pagina: {
      status: cambios.status ?? 200,
      headers: cambios.headers ?? ENCABEZADOS_DE_LA_PAGINA,
      html: cambios.html ?? HTML,
    },
  };
}

/** Los encabezados de la pagina sin uno. */
function sin(nombre: string): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(ENCABEZADOS_DE_LA_PAGINA).filter(([k]) => k !== nombre));
}

/** Los nombres de lo que no paso. */
function fallan(captura: Captura): string[] {
  return evaluarSitio(captura, ESPERADO)
    .filter((c) => !c.ok)
    .map((c) => c.nombre);
}

const [
  RESPONDE,
  TEXTO,
  HUELLA,
  REVISION,
  POLITICA_PUESTA,
  SEGURIDAD,
  ENLACE,
  ABRE_EL_CHAT,
  SIN_TERCEROS,
] = NOMBRES_DE_COMPROBACIONES;

describe('a site that was published well', () => {
  it('passes every check, and each one has its own name', () => {
    const resultado = evaluarSitio(buena(), ESPERADO);

    expect(resultado.every((c) => c.ok)).toBe(true);
    expect(resultado.map((c) => c.nombre)).toEqual([...NOMBRES_DE_COMPROBACIONES]);
    expect(new Set(NOMBRES_DE_COMPROBACIONES).size).toBe(9);
  });

  it('says what it saw in each check, so that a failure can be read without opening the code', () => {
    for (const comprobacion of evaluarSitio(buena(), ESPERADO)) {
      expect(comprobacion.detalle.length, comprobacion.nombre).toBeGreaterThan(0);
    }
  });
});

describe('the page', () => {
  it.each([404, 500, 301])('does not pass with the status %i', (status) => {
    expect(fallan(conPagina({ status }))).toContain(RESPONDE);
  });

  it('does not pass when it could not be asked for, and says so', () => {
    const captura: Captura = { ...buena(), pagina: null };
    const resultado = evaluarSitio(captura, ESPERADO);

    expect(resultado.filter((c) => !c.ok).map((c) => c.nombre)).toContain(RESPONDE);
    expect(resultado.find((c) => c.nombre === RESPONDE)?.detalle).toMatch(/no se pudo/i);
  });

  it('brings the text in the document, with no JavaScript needed: the heading is there although it has tags inside', () => {
    expect(fallan(conPagina({}))).toEqual([]);
  });

  it('finds the heading when the server writes the characters as entities', () => {
    const html = HTML.replace('</span> el internet.', '</span>&nbsp;el&#32;internet.');

    expect(html).not.toBe(HTML);
    expect(fallan(conPagina({ html }))).toEqual([]);
  });

  it('does not pass with a shell that only has the place for the app, which is what a page that needs JavaScript sends', () => {
    const html = `<!doctype html><html><head><title>${TITULO}</title></head><body><div id="root"></div><a href="${WHATSAPP}">x</a></body></html>`;

    expect(fallan(conPagina({ html }))).toEqual([TEXTO]);
  });

  it('does not pass with the heading only inside a script, because that is not text that anyone reads without JavaScript', () => {
    const html = `<!doctype html><html><head><title>${TITULO}</title></head><body><div id="root"></div><script>var t = "${ENCABEZADO}";</script><a href="${WHATSAPP}">x</a></body></html>`;

    expect(fallan(conPagina({ html }))).toEqual([TEXTO]);
  });

  it('does not pass with another title', () => {
    const html = HTML.replace(`<title>${TITULO}</title>`, '<title>Otra cosa</title>');

    expect(fallan(conPagina({ html }))).toEqual([TEXTO]);
  });

  it('does not count what is inside an HTML comment as text that anyone reads', () => {
    const html = `<!doctype html><html><head><title>${TITULO}</title></head><body><div id="root"></div><!-- <b>${ENCABEZADO}</b> --><a href="${WHATSAPP}">x</a></body></html>`;

    expect(fallan(conPagina({ html }))).toEqual([TEXTO]);
  });

  it('fails every check that reads the page when it could not be asked for, not only the first one', () => {
    expect(fallan({ ...buena(), pagina: null })).toEqual([
      RESPONDE,
      TEXTO,
      REVISION,
      POLITICA_PUESTA,
      SEGURIDAD,
      ENLACE,
      SIN_TERCEROS,
    ]);
  });

  it('reads the names of the headers whatever their capitals, so the checks do not depend on how a server writes them', () => {
    const conMayusculas = Object.fromEntries(
      Object.entries(ENCABEZADOS_DE_LA_PAGINA).map(([nombre, valor]) => [
        nombre.replace(
          /(^|-)([a-z])/g,
          (_t, antes: string, letra: string) => antes + letra.toUpperCase(),
        ),
        valor,
      ]),
    );
    const captura = buena();

    expect(Object.keys(conMayusculas)).toContain('Content-Security-Policy');
    expect(
      fallan({
        ...conPagina({ headers: conMayusculas }),
        activo: {
          ...captura.activo!,
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        },
        whatsapp: { status: 302, headers: { Location: DESTINO_DE_WHATSAPP } },
      }),
    ).toEqual([]);
  });
});

describe('the files with a hash in their name', () => {
  it.each([
    'public, max-age=31536000, immutable',
    'public, max-age=63072000, immutable',
    'max-age=31536000,immutable',
  ])('pass when they are kept a year or more: %s', (cacheControl) => {
    const captura = buena();

    expect(
      fallan({
        ...captura,
        activo: { ...captura.activo!, headers: { 'cache-control': cacheControl } },
      }),
    ).toEqual([]);
  });

  it.each([
    'public, max-age=3600',
    'public, max-age=86400, immutable',
    'public, max-age=7776000, immutable',
    'public, max-age=31535999, immutable',
    'immutable',
    'public, max-age=31536000',
    'no-cache',
    'public, max-age=0, must-revalidate',
  ])(
    'do not pass when they are kept less, or can change under the same name: %s',
    (cacheControl) => {
      const captura = buena();

      expect(
        fallan({
          ...captura,
          activo: { ...captura.activo!, headers: { 'cache-control': cacheControl } },
        }),
      ).toEqual([HUELLA]);
    },
  );

  it('do not pass without the header', () => {
    const captura = buena();

    expect(fallan({ ...captura, activo: { ...captura.activo!, headers: {} } })).toEqual([HUELLA]);
  });

  it('do not pass when the file is not found: a 404 does not carry the rule of the folder', () => {
    const captura = buena();

    expect(fallan({ ...captura, activo: { ...captura.activo!, status: 404 } })).toEqual([HUELLA]);
  });

  it('do not pass when no file was asked for, and the detail says why', () => {
    const resultado = evaluarSitio({ ...buena(), activo: null }, ESPERADO);
    const huella = resultado.find((c) => c.nombre === HUELLA);

    expect(huella?.ok).toBe(false);
    expect(huella?.detalle).toMatch(/no se pudo|ningún archivo/i);
  });
});

describe('the cache of the page itself', () => {
  it.each(['no-cache', 'public, max-age=0, must-revalidate', 'max-age=0'])(
    'passes when it is checked on every visit: %s',
    (cacheControl) => {
      const headers = { ...ENCABEZADOS_DE_LA_PAGINA, 'cache-control': cacheControl };

      expect(fallan(conPagina({ headers }))).toEqual([]);
    },
  );

  it.each(['public, max-age=31536000, immutable', 'public, max-age=600'])(
    'does not pass when it is kept (%s): a visitor would see an old page after a publication',
    (cacheControl) => {
      const headers = { ...ENCABEZADOS_DE_LA_PAGINA, 'cache-control': cacheControl };

      expect(fallan(conPagina({ headers }))).toEqual([REVISION]);
    },
  );

  it('does not pass without the header', () => {
    expect(fallan(conPagina({ headers: sin('cache-control') }))).toEqual([REVISION]);
  });
});

describe('the content policy', () => {
  const con = (politica: string): string[] =>
    fallan(
      conPagina({ headers: { ...ENCABEZADOS_DE_LA_PAGINA, 'content-security-policy': politica } }),
    );

  it('does not pass when Cloudflare did not put it', () => {
    expect(fallan(conPagina({ headers: sin('content-security-policy') }))).toEqual([
      POLITICA_PUESTA,
    ]);
  });

  it('does not pass with unsafe-eval anywhere', () => {
    expect(con(POLITICA.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"))).toEqual([
      POLITICA_PUESTA,
    ]);
  });

  it('does not pass when the scripts accept unsafe-inline, but accepts it for the styles, which React needs', () => {
    expect(con(POLITICA.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"))).toEqual(
      [POLITICA_PUESTA],
    );
    expect(con(POLITICA)).toEqual([]);
  });

  it('does not pass without default-src restricted to the site', () => {
    expect(con(POLITICA.replace("default-src 'self'; ", ''))).toEqual([POLITICA_PUESTA]);
    expect(con(POLITICA.replace("default-src 'self'", 'default-src *'))).toEqual([POLITICA_PUESTA]);
  });

  it('does not pass if the page can talk to an address that was not told: every origin of connection must be there', () => {
    expect(con(POLITICA.replace(` ${API}`, ''))).toEqual([POLITICA_PUESTA]);
  });

  it('does not pass if the page can talk to any address', () => {
    expect(
      con(POLITICA.replace(`connect-src 'self' ${API}`, `connect-src 'self' ${API} *`)),
    ).toEqual([POLITICA_PUESTA]);
    expect(con(POLITICA.replace(`connect-src 'self' ${API}`, 'connect-src *'))).toEqual([
      POLITICA_PUESTA,
    ]);
  });

  it('does not pass if the page can be framed or can load plugins', () => {
    expect(con(POLITICA.replace("; frame-ancestors 'none'", ''))).toEqual([POLITICA_PUESTA]);
    expect(con(POLITICA.replace("object-src 'none'", "object-src 'self'"))).toEqual([
      POLITICA_PUESTA,
    ]);
  });

  it.each(['base-uri', 'form-action'])(
    'does not pass if %s is missing or is not none: an injected tag could redirect the page',
    (directiva) => {
      expect(con(POLITICA.replace(`${directiva} 'none'; `, ''))).toEqual([POLITICA_PUESTA]);
      expect(con(POLITICA.replace(`${directiva} 'none'`, `${directiva} 'self'`))).toEqual([
        POLITICA_PUESTA,
      ]);
    },
  );

  it('does not pass without script-src, because the scripts would fall back to whatever else is written', () => {
    expect(con(POLITICA.replace("script-src 'self' 'sha256-abc123='; ", ''))).toEqual([
      POLITICA_PUESTA,
    ]);
  });

  it('does not pass without connect-src, because the page could then talk to any address', () => {
    expect(con(POLITICA.replace(`connect-src 'self' ${API}; `, ''))).toEqual([POLITICA_PUESTA]);
  });

  it.each([
    "'unsafe-eval'",
    'https:',
    'http:',
    'data:',
    'blob:',
    '*',
    'https://cdn.example.com',
    'cdn.example.com',
  ])(
    'does not pass when the scripts also accept %s: only their own and the ones with a hash',
    (valor) => {
      const detalle = evaluarSitio(
        conPagina({
          headers: {
            ...ENCABEZADOS_DE_LA_PAGINA,
            'content-security-policy': POLITICA.replace(
              "script-src 'self'",
              `script-src 'self' ${valor}`,
            ),
          },
        }),
        ESPERADO,
      ).find((c) => c.nombre === POLITICA_PUESTA);

      expect(detalle?.ok).toBe(false);
      expect(detalle?.detalle).toContain('script-src deja correr');
    },
  );

  it('does not pass with unsafe-eval in any directive, not only in the scripts', () => {
    const detalle = evaluarSitio(
      conPagina({
        headers: {
          ...ENCABEZADOS_DE_LA_PAGINA,
          'content-security-policy': POLITICA.replace(
            "style-src 'self'",
            "style-src 'self' 'unsafe-eval'",
          ),
        },
      }),
      ESPERADO,
    ).find((c) => c.nombre === POLITICA_PUESTA);

    expect(detalle?.ok).toBe(false);
    expect(detalle?.detalle).toContain('style-src permite unsafe-eval');
  });

  it('reads a repeated directive the way a browser does: the first one counts and the rest are ignored', () => {
    expect(con(`${POLITICA}; script-src *`)).toEqual([]);
    expect(
      con(
        POLITICA.replace(
          "script-src 'self' 'sha256-abc123='",
          "script-src *; script-src 'self' 'sha256-abc123='",
        ),
      ),
    ).toEqual([POLITICA_PUESTA]);
  });
});

describe('the security headers', () => {
  it.each(['x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy'])(
    'do not pass without %s',
    (nombre) => {
      expect(fallan(conPagina({ headers: sin(nombre) }))).toEqual([SEGURIDAD]);
    },
  );

  it('do not pass with a value that does not protect: nosniff and DENY are the ones that were asked for', () => {
    const cambiado = { ...ENCABEZADOS_DE_LA_PAGINA, 'x-frame-options': 'ALLOWALL' };
    expect(fallan(conPagina({ headers: cambiado }))).toEqual([SEGURIDAD]);

    const otro = { ...ENCABEZADOS_DE_LA_PAGINA, 'x-content-type-options': 'sniff' };
    expect(fallan(conPagina({ headers: otro }))).toEqual([SEGURIDAD]);
  });
});

describe('the WhatsApp link', () => {
  it('has to be, in the page, the one of the content: with the number and the message', () => {
    const html = HTML.replace(WHATSAPP, 'https://wa.me/573000000000?text=Hola');

    expect(fallan(conPagina({ html }))).toEqual([ENLACE]);
  });

  it('is not found if the page does not link to it at all', () => {
    const html = HTML.replace(/<a href=.*?<\/a>/, '');

    expect(fallan(conPagina({ html }))).toEqual([ENLACE]);
  });

  it('opens the chat when WhatsApp sends to its page with the number', () => {
    expect(evaluarSitio(buena(), ESPERADO).find((c) => c.nombre === ABRE_EL_CHAT)?.ok).toBe(true);
  });

  it.each([301, 302, 303, 307, 308])('opens the chat with the redirection %i', (status) => {
    const captura: Captura = {
      ...buena(),
      whatsapp: { status, headers: { location: DESTINO_DE_WHATSAPP } },
    };

    expect(fallan(captura)).toEqual([]);
  });

  it.each([
    [404, 'https://api.whatsapp.com/send/?phone=573245889281'],
    [302, 'https://api.whatsapp.com/send/?phone=573000000000'],
    [302, 'https://example.com/send/?phone=573245889281'],
    [302, ''],
    [200, 'https://api.whatsapp.com/send/?phone=573245889281'],
  ])('does not open the chat with the status %i and the location "%s"', (status, location) => {
    const captura: Captura = { ...buena(), whatsapp: { status, headers: { location } } };

    expect(fallan(captura)).toEqual([ABRE_EL_CHAT]);
  });

  it('does not open the chat if wa.me could not be asked, and says so', () => {
    const captura: Captura = { ...buena(), whatsapp: null };
    const abre = evaluarSitio(captura, ESPERADO).find((c) => c.nombre === ABRE_EL_CHAT);

    expect(abre?.ok).toBe(false);
    expect(abre?.detalle).toMatch(/no se pudo/i);
  });
});

describe('analytics and third parties', () => {
  const conScript = (etiqueta: string): string[] =>
    fallan(conPagina({ html: HTML.replace('</head>', `${etiqueta}</head>`) }));

  it('does not pass with the beacon of Cloudflare Web Analytics, which Pages can add by itself', () => {
    expect(
      conScript(
        '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon=\'{"token": "x"}\'></script>',
      ),
    ).toEqual([SIN_TERCEROS]);
  });

  it.each([
    '<script src="https://cdn.example.com/a.js"></script>',
    '<script src="//cdn.example.com/a.js"></script>',
    '<script async src="http://vsd-stock-sitio.pages.dev/a.js"></script>',
  ])('does not pass with a script from another origin: %s', (etiqueta) => {
    expect(conScript(etiqueta)).toEqual([SIN_TERCEROS]);
  });

  it('does not pass with the name of an analytics service written inside a script of the page', () => {
    expect(
      conScript('<script>var u = "https://static.cloudflareinsights.com/beacon.min.js";</script>'),
    ).toEqual([SIN_TERCEROS]);
  });

  it.each([
    '<script type="module" src="/assets/otro.js"></script>',
    `<script type="module" src="${ORIGEN}/assets/otro.js"></script>`,
    '<iframe src="/propio"></iframe>',
    '<link rel="preconnect" href="/assets/x">',
  ])('passes with scripts, frames and links of the site itself: %s', (etiqueta) => {
    expect(conScript(etiqueta)).toEqual([]);
  });

  it.each([
    'cloudflareinsights',
    'google-analytics',
    'googletagmanager',
    'gtag/js',
    'plausible.io',
    'hotjar',
    'mixpanel',
    'segment.com',
    'segment.io',
    'matomo',
    'clarity.ms',
    'fullstory',
  ])('does not pass with the name of the service %s inside a script', (servicio) => {
    expect(conScript(`<script>var u = "https://x.test/${servicio}/a.js";</script>`)).toEqual([
      SIN_TERCEROS,
    ]);
  });

  it('does not pass with a frame from another origin', () => {
    expect(conScript('<iframe src="https://example.com/embed"></iframe>')).toEqual([SIN_TERCEROS]);
  });

  it.each(['stylesheet', 'preload', 'modulepreload', 'preconnect', 'dns-prefetch'])(
    'does not pass with a link %s to another origin, because the browser would ask for it',
    (rel) => {
      expect(conScript(`<link rel="${rel}" href="https://fonts.gstatic.com/x">`)).toEqual([
        SIN_TERCEROS,
      ]);
    },
  );

  it('does not pass with an address that cannot be read: it is not known to be the site itself', () => {
    expect(conScript('<script src="https://"></script>')).toEqual([SIN_TERCEROS]);
  });

  it.each([
    "<script src='https://cdn.example.com/a.js'></script>",
    '<script src=https://cdn.example.com/a.js></script>',
    '<link rel=stylesheet href=https://cdn.example.com/a.css>',
  ])('reads the attributes however they are written: %s', (etiqueta) => {
    expect(conScript(etiqueta)).toEqual([SIN_TERCEROS]);
  });
});

describe('asking for a file with a hash', () => {
  it('takes the first file of the folder of assets that the page loads as a script', () => {
    expect(rutaDeUnActivo(HTML)).toBe('/assets/index-BGDs6-I4.js');
  });

  it('takes a style sheet when the page loads no script from there', () => {
    expect(rutaDeUnActivo('<link rel="stylesheet" href="/assets/index-Ccgq0Dn3.css">')).toBe(
      '/assets/index-Ccgq0Dn3.css',
    );
  });

  it('gives nothing when the page loads nothing from there', () => {
    expect(rutaDeUnActivo('<html><body>nada</body></html>')).toBeNull();
  });
});

describe('what is expected of the page', () => {
  it('is taken from the build that was published: its title and its heading, without tags', () => {
    expect(esperadoDelHtml(HTML)).toEqual({ titulo: TITULO, encabezado: ENCABEZADO });
  });

  it('reads the characters written as entities', () => {
    const compilado =
      '<title>Cobra &amp; vende</title><h1>Cobra &amp; <b>vende</b>,&nbsp;sin &quot;l&iacute;mites&quot;.</h1>';

    expect(esperadoDelHtml(compilado).titulo).toBe('Cobra & vende');
    expect(esperadoDelHtml(compilado).encabezado).toContain('Cobra & vende');
  });

  it.each([
    ['without a title', '<h1>Hola</h1>'],
    ['without a heading', '<title>Hola</title>'],
    ['with an empty heading', '<title>Hola</title><h1> <span></span> </h1>'],
  ])('fails %s, because there would be nothing to compare with', (_nombre, html) => {
    expect(() => esperadoDelHtml(html)).toThrow(/construcci|compil|no tiene/i);
  });
});

describe('the report', () => {
  it('says what passed and what did not, with the detail of what did not, and how many passed', () => {
    const captura = buena();
    const texto = informe(
      evaluarSitio({ ...captura, activo: { ...captura.activo!, status: 404 } }, ESPERADO),
    );

    expect(texto).toContain(RESPONDE);
    expect(texto).toMatch(new RegExp(`✗ ${HUELLA}`));
    expect(texto).toContain('8 de 9');
  });

  it('says that everything passed when it did', () => {
    expect(informe(evaluarSitio(buena(), ESPERADO))).toContain('9 de 9');
  });

  it('puts the detail of what failed next to its name, so that it can be read without opening the code', () => {
    const captura = buena();
    const resultado = evaluarSitio(
      { ...captura, activo: { ...captura.activo!, status: 404 } },
      ESPERADO,
    );
    const falla = resultado.find((c) => !c.ok);

    expect(falla).toBeDefined();
    expect(informe(resultado)).toContain(`✗ ${HUELLA} — ${falla!.detalle}`);
  });
});

describe('what the build writes and what this check asks for', () => {
  it('agree: the rules that scripts/build-sitio.ts writes into _headers pass every check of headers', () => {
    const texto = siteHeaders({ hashes: inlineScriptHashes(HTML), connectOrigins: [API] });
    const reglas = new Map<string, Record<string, string>>();
    for (const seccion of texto.split(/\n\s*\n/)) {
      const [ruta, ...cabeceras] = seccion
        .split('\n')
        .filter((linea) => linea.trim() !== '' && !linea.startsWith('#'));
      if (ruta === undefined) continue;
      reglas.set(
        ruta,
        Object.fromEntries(
          cabeceras.map((linea) => {
            const corte = linea.indexOf(':');
            return [linea.slice(0, corte).trim().toLowerCase(), linea.slice(corte + 1).trim()];
          }),
        ),
      );
    }
    const captura: Captura = {
      ...buena(),
      pagina: { status: 200, headers: { ...reglas.get('/*'), ...reglas.get('/') }, html: HTML },
      activo: {
        ruta: '/assets/index-BGDs6-I4.js',
        status: 200,
        headers: reglas.get('/assets/*') ?? {},
      },
    };

    expect(reglas.get('/assets/*')).toBeDefined();
    expect(fallan(captura)).toEqual([]);
  });
});

describe('the way the network is asked, which no test with hand-made answers can see', () => {
  const fuente = readFileSync(
    join(resolve(import.meta.dirname, '../..'), 'scripts/verificar-sitio.ts'),
    'utf8',
  );

  it('does not follow redirections: the check of wa.me reads where it sends, not where it ends up', () => {
    expect(fuente).toContain("redirect: 'manual'");
  });

  it('gives up on an answer that does not come, instead of waiting for ever', () => {
    expect(fuente).toMatch(/AbortSignal\.timeout\(\d/);
  });

  it('asks only with GET and sends no credentials of any kind', () => {
    expect(fuente).not.toMatch(/authorization|cookie|token/i);
  });

  it('ends the command with the exit code of the checks, so that a failure is seen by whoever runs it', () => {
    expect(fuente).toContain('process.exit(codigoDeSalida(comprobaciones));');
  });
});

describe('the exit code of the command', () => {
  it('is 0 only when every check passes', () => {
    expect(codigoDeSalida(evaluarSitio(buena(), ESPERADO))).toBe(0);
  });

  it('is 1 when a single check fails, whichever it is', () => {
    const captura = buena();
    const falla = evaluarSitio(
      { ...captura, activo: { ...captura.activo!, status: 404 } },
      ESPERADO,
    );

    expect(falla.filter((c) => !c.ok)).toHaveLength(1);
    expect(codigoDeSalida(falla)).toBe(1);
  });

  it('is 1 when there is nothing to judge: no checks is not a site that was verified', () => {
    expect(codigoDeSalida([])).toBe(1);
  });
});
