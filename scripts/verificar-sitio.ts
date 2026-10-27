// Comprueba la landing ya publicada (C4-L8): la pide como la pediria un navegador y verifica lo que el ticket promete. Corre directamente
// en Node 24, que ejecuta TypeScript quitando los tipos: por eso este archivo no importa otros archivos del proyecto (los que necesita
// los carga con `import()`).
//
//   node scripts/verificar-sitio.ts <direccion>     por ejemplo https://vsd-stock-sitio.pages.dev
//
// Compara con `sitio/dist/index.html`, la compilacion que se publico: compilala (`npm run build:sitio`) en la misma version antes. Sale
// con 0 solo si todo pasa. No usa ninguna clave: pide paginas publicas.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Lo que se comprueba, en este orden. `docs/sitio.md` los nombra a todos y una prueba lo vigila. */
export const NOMBRES_DE_COMPROBACIONES = [
  'La página responde 200',
  'El HTML trae el texto, sin ejecutar JavaScript',
  'Los archivos con huella se guardan un año',
  'La página se revisa en cada visita',
  'La política de contenido está puesta',
  'Los encabezados de seguridad están puestos',
  'El enlace de WhatsApp es el de la página',
  'El enlace de WhatsApp abre el chat',
  'No hay analítica ni scripts de terceros',
] as const;

export interface Respuesta {
  readonly status: number;
  /** Los nombres de los encabezados, como los entrega `fetch`: en minusculas. */
  readonly headers: Readonly<Record<string, string>>;
}

/** Lo que se pidio a la red. `null` es que no se pudo pedir (sin respuesta). */
export interface Captura {
  /** La direccion del sitio sin ruta: `https://vsd-stock-sitio.pages.dev`. */
  readonly origen: string;
  readonly pagina: (Respuesta & { readonly html: string }) | null;
  /** Un archivo con huella de /assets/, de los que la pagina carga. */
  readonly activo: (Respuesta & { readonly ruta: string }) | null;
  /** La respuesta de wa.me SIN seguir la redireccion. */
  readonly whatsapp: Respuesta | null;
}

/** Lo que se espera encontrar. */
export interface Esperado {
  readonly titulo: string;
  readonly encabezado: string;
  readonly whatsappUrl: string;
  readonly whatsappNumero: string;
}

export interface Comprobacion {
  readonly nombre: string;
  readonly ok: boolean;
  readonly detalle: string;
}

type Resultado = { readonly ok: boolean; readonly detalle: string };
const si = (detalle: string): Resultado => ({ ok: true, detalle });
const no = (detalle: string): Resultado => ({ ok: false, detalle });

const UN_ANO = 31_536_000;

function cabecera(headers: Readonly<Record<string, string>>, nombre: string): string | undefined {
  const clave = Object.keys(headers).find((k) => k.toLowerCase() === nombre);
  return clave === undefined ? undefined : headers[clave];
}

const ENTIDADES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Lee las entidades que escribe un servidor: las nombradas de arriba y las numericas. Las que no conoce las deja como estan. */
function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera: string, cuerpo: string) => {
    const hexadecimal = /^#x/i.test(cuerpo);
    if (hexadecimal || cuerpo.startsWith('#')) {
      const punto = hexadecimal ? parseInt(cuerpo.slice(2), 16) : Number(cuerpo.slice(1));
      return Number.isInteger(punto) && punto >= 0 && punto <= 0x10ffff
        ? String.fromCodePoint(punto)
        : entera;
    }
    return ENTIDADES[cuerpo.toLowerCase()] ?? entera;
  });
}

const normalizar = (texto: string): string => texto.replace(/\s+/g, ' ').trim();

/**
 * El texto que una persona lee sin ejecutar JavaScript: sin scripts, estilos ni comentarios, sin etiquetas y con las entidades leidas.
 * Un navegador cierra un script o un estilo en `</script` seguido de espacio, `/` o `>` (aunque lleve atributos) y un comentario en `-->` o
 * `--!>`: las expresiones lo respetan para no contar como texto lo que el navegador no muestra.
 */
function textoVisible(html: string): string {
  const sinCodigo = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1(?:[\s/][^>]*)?>/gi, ' ')
    .replace(/<!--[\s\S]*?--!?>/g, ' ');
  return normalizar(decodificar(sinCodigo.replace(/<[^>]*>/g, ' ')));
}

function tituloDe(html: string): string {
  return normalizar(decodificar(/<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1] ?? ''));
}

/** Lo que se espera encontrar en lo publicado, sacado de la compilacion que se publico: su titulo y su encabezado principal. */
export function esperadoDelHtml(html: string): { titulo: string; encabezado: string } {
  const titulo = tituloDe(html);
  const encabezado = textoVisible(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(html)?.[1] ?? '');
  if (titulo === '')
    throw new Error(
      'El documento compilado no tiene <title>: no hay con qué comparar lo publicado.',
    );
  if (encabezado === '')
    throw new Error(
      'El documento compilado no tiene un <h1> con texto: no hay con qué comparar lo publicado.',
    );
  return { titulo, encabezado };
}

/** Un archivo con huella que la pagina carga: el primer script de /assets/ o, si no hay, la primera hoja de estilos. */
export function rutaDeUnActivo(html: string): string | null {
  return (
    /<script\b[^>]*\bsrc="(\/assets\/[^"]+)"/i.exec(html)?.[1] ??
    /<link\b[^>]*\bhref="(\/assets\/[^"]+\.css)"/i.exec(html)?.[1] ??
    null
  );
}

function responde(captura: Captura): Resultado {
  if (captura.pagina === null)
    return no('No se pudo pedir la página: no hubo respuesta de la red.');
  const { status } = captura.pagina;
  return status === 200
    ? si(`${captura.origen}/ respondió 200.`)
    : no(`${captura.origen}/ respondió ${String(status)} y se esperaba 200.`);
}

function trae(captura: Captura, esperado: Esperado): Resultado {
  if (captura.pagina === null) return no('No se pudo pedir la página: no hay HTML que revisar.');
  const { html } = captura.pagina;
  const faltas: string[] = [];
  const titulo = tituloDe(html);
  if (titulo !== normalizar(esperado.titulo)) {
    faltas.push(
      `el título es ${JSON.stringify(titulo)} y se esperaba ${JSON.stringify(esperado.titulo)}`,
    );
  }
  if (!textoVisible(html).includes(normalizar(esperado.encabezado))) {
    faltas.push(
      `el encabezado ${JSON.stringify(esperado.encabezado)} no está en el texto del documento (¿lo pinta JavaScript?)`,
    );
  }
  return faltas.length === 0
    ? si(`El título y el encabezado «${esperado.encabezado}» están en el documento.`)
    : no(`En el HTML, ${faltas.join('; ')}.`);
}

function huella(captura: Captura): Resultado {
  if (captura.activo === null) {
    return no(
      'No se pudo pedir ningún archivo con huella: la página no carga ninguno de /assets/ o falló la red.',
    );
  }
  const { ruta, status, headers } = captura.activo;
  if (status !== 200)
    return no(
      `${ruta} respondió ${String(status)}: sin el archivo no hay regla de caché que comprobar.`,
    );
  const valor = cabecera(headers, 'cache-control') ?? '';
  const maxAge = /\bmax-age=(\d+)/i.exec(valor)?.[1];
  const inmutable = /\bimmutable\b/i.test(valor);
  if (maxAge === undefined || Number(maxAge) < UN_ANO || !inmutable) {
    return no(
      `${ruta}: Cache-Control es ${valor === '' ? '(vacío)' : JSON.stringify(valor)} y se esperaba max-age de al menos ${String(UN_ANO)} (un año) e immutable.`,
    );
  }
  return si(`${ruta}: Cache-Control ${valor}.`);
}

function revision(captura: Captura): Resultado {
  if (captura.pagina === null) return no('No se pudo pedir la página.');
  const valor = cabecera(captura.pagina.headers, 'cache-control');
  const revisa = valor !== undefined && /\bno-cache\b|\bno-store\b|\bmax-age=0\b/i.test(valor);
  return revisa
    ? si(`Cache-Control de la página: ${valor}.`)
    : no(
        `Cache-Control de la página es ${valor === undefined ? '(vacío)' : JSON.stringify(valor)}: se guardaría y quien visite vería una versión vieja tras publicar. Se esperaba no-cache o max-age=0.`,
      );
}

/** Los pares directiva -> valores de una politica de contenido. */
function directivas(valor: string): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const parte of valor.split(';')) {
    const [nombre, ...valores] = parte.trim().split(/\s+/).filter(Boolean);
    if (nombre !== undefined && !mapa.has(nombre.toLowerCase()))
      mapa.set(nombre.toLowerCase(), valores);
  }
  return mapa;
}

/** Lo unico que `script-src` puede aceptar: lo propio y los scripts en linea con huella. Cualquier otra fuente (un dominio, `https:`, `*`) deja correr codigo ajeno. */
const SCRIPT_PERMITIDO = /^('self'|'sha(256|384|512)-[A-Za-z0-9+/=_-]+')$/i;

function politica(captura: Captura): Resultado {
  if (captura.pagina === null) return no('No se pudo pedir la página.');
  const valor = cabecera(captura.pagina.headers, 'content-security-policy');
  if (valor === undefined) {
    return no(
      'Cloudflare no puso Content-Security-Policy: ¿se publicó el archivo _headers de sitio/dist?',
    );
  }
  const mapa = directivas(valor);
  const faltas: string[] = [];

  if (JSON.stringify(mapa.get('default-src')) !== JSON.stringify(["'self'"])) {
    faltas.push("default-src no es solo 'self'");
  }
  const scripts = mapa.get('script-src');
  if (scripts === undefined) faltas.push('falta script-src');
  else if (scripts.some((v) => !SCRIPT_PERMITIDO.test(v)))
    faltas.push('script-src deja correr scripts de cualquier lado o en línea sin huella');
  for (const [nombre, valores] of mapa) {
    if (valores.some((v) => v.toLowerCase() === "'unsafe-eval'"))
      faltas.push(`${nombre} permite unsafe-eval`);
  }
  const conexiones = mapa.get('connect-src');
  if (conexiones === undefined) faltas.push('falta connect-src');
  else {
    for (const v of conexiones) if (v !== "'self'") faltas.push(`connect-src deja hablar con ${v}`);
    if (!conexiones.includes("'self'")) faltas.push("connect-src no incluye 'self'");
  }
  for (const nombre of ['object-src', 'frame-ancestors', 'base-uri', 'form-action']) {
    if (JSON.stringify(mapa.get(nombre)) !== JSON.stringify(["'none'"]))
      faltas.push(`${nombre} no es 'none'`);
  }

  return faltas.length === 0
    ? si('Content-Security-Policy: scripts propios con huella, conexiones solo a la propia página.')
    : no(`Content-Security-Policy: ${faltas.join('; ')}.`);
}

function seguridad(captura: Captura): Resultado {
  if (captura.pagina === null) return no('No se pudo pedir la página.');
  const { headers } = captura.pagina;
  const requeridos: readonly (readonly [string, (v: string) => boolean, string])[] = [
    ['x-content-type-options', (v) => v.toLowerCase() === 'nosniff', 'nosniff'],
    ['x-frame-options', (v) => v.toUpperCase() === 'DENY', 'DENY'],
    ['referrer-policy', (v) => v.trim() !== '', 'una política'],
    ['permissions-policy', (v) => v.trim() !== '', 'una política'],
  ];
  const faltas = requeridos
    .filter(([nombre, vale]) => !vale(cabecera(headers, nombre) ?? ''))
    .map(([nombre, , esperado]) => `${nombre} no es ${esperado}`);
  return faltas.length === 0
    ? si('Los cuatro encabezados están y valen lo que se pidió.')
    : no(`${faltas.join('; ')}.`);
}

function enlace(captura: Captura, esperado: Esperado): Resultado {
  if (captura.pagina === null) return no('No se pudo pedir la página.');
  return captura.pagina.html.includes(`href="${esperado.whatsappUrl}"`)
    ? si(`La página enlaza a ${esperado.whatsappUrl}`)
    : no(`La página no enlaza a ${esperado.whatsappUrl} (con ese número y ese mensaje).`);
}

const REDIRECCIONES = [301, 302, 303, 307, 308];

function leerUrl(texto: string): URL | null {
  try {
    return new URL(texto);
  } catch {
    return null;
  }
}

function abreElChat(captura: Captura, esperado: Esperado): Resultado {
  if (captura.whatsapp === null) return no('No se pudo pedir wa.me: no hubo respuesta de la red.');
  const { status, headers } = captura.whatsapp;
  const destino = cabecera(headers, 'location') ?? '';
  const url = leerUrl(destino);
  const bien =
    REDIRECCIONES.includes(status) &&
    url !== null &&
    url.hostname === 'api.whatsapp.com' &&
    url.searchParams.get('phone') === esperado.whatsappNumero;
  return bien
    ? si(
        `wa.me redirige (${String(status)}) a api.whatsapp.com con el número ${esperado.whatsappNumero}.`,
      )
    : no(
        `wa.me respondió ${String(status)} hacia ${destino === '' ? '(sin Location)' : destino}; se esperaba una redirección a api.whatsapp.com con phone=${esperado.whatsappNumero}.`,
      );
}

const SERVICIOS_DE_ANALITICA =
  /cloudflareinsights|google-analytics|googletagmanager|gtag\/js|plausible\.io|hotjar|mixpanel|segment\.(com|io)|matomo|clarity\.ms|fullstory/i;

function valorDe(atributos: string, nombre: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${nombre}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    atributos,
  );
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

function esAjeno(direccion: string, origen: string): boolean {
  try {
    return new URL(direccion, `${origen}/`).origin !== new URL(origen).origin;
  } catch {
    return true;
  }
}

function terceros(captura: Captura): Resultado {
  if (captura.pagina === null) return no('No se pudo pedir la página.');
  const { html } = captura.pagina;
  const hallados: string[] = [];

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script(?:[\s/][^>]*)?>/gi)) {
    const atributos = m[1] ?? '';
    const src = valorDe(atributos, 'src');
    if (src !== undefined && esAjeno(src, captura.origen)) hallados.push(`un script de ${src}`);
    if (SERVICIOS_DE_ANALITICA.test(m[2] ?? '') || SERVICIOS_DE_ANALITICA.test(atributos)) {
      hallados.push('un script con el nombre de un servicio de analítica');
    }
  }
  for (const m of html.matchAll(/<iframe\b([^>]*)>/gi)) {
    const src = valorDe(m[1] ?? '', 'src');
    if (src !== undefined && esAjeno(src, captura.origen)) hallados.push(`un marco de ${src}`);
  }
  for (const m of html.matchAll(/<link\b([^>]*)>/gi)) {
    const atributos = m[1] ?? '';
    const rel = valorDe(atributos, 'rel') ?? '';
    const href = valorDe(atributos, 'href');
    if (
      /stylesheet|preload|modulepreload|preconnect|dns-prefetch/i.test(rel) &&
      href !== undefined &&
      esAjeno(href, captura.origen)
    ) {
      hallados.push(`un recurso de ${href}`);
    }
  }

  return hallados.length === 0
    ? si('Todos los scripts, marcos y hojas de estilo son del propio sitio.')
    : no(
        `Hay ${[...new Set(hallados)].join(', ')}: la página no lleva analítica ni nada de terceros (¿Web Analytics quedó prendido en el proyecto?).`,
      );
}

/** Corre las nueve comprobaciones, en el orden de `NOMBRES_DE_COMPROBACIONES`. */
export function evaluarSitio(captura: Captura, esperado: Esperado): Comprobacion[] {
  const resultados: readonly Resultado[] = [
    responde(captura),
    trae(captura, esperado),
    huella(captura),
    revision(captura),
    politica(captura),
    seguridad(captura),
    enlace(captura, esperado),
    abreElChat(captura, esperado),
    terceros(captura),
  ];
  return NOMBRES_DE_COMPROBACIONES.map((nombre, i) => ({
    nombre,
    ok: resultados[i]?.ok ?? false,
    detalle: resultados[i]?.detalle ?? 'No se evaluó.',
  }));
}

/** 0 solo si hay comprobaciones y todas pasan: sin nada que juzgar no hay un sitio verificado. */
export function codigoDeSalida(comprobaciones: readonly Comprobacion[]): 0 | 1 {
  return comprobaciones.length > 0 && comprobaciones.every((c) => c.ok) ? 0 : 1;
}

/** El informe para una persona: lo que paso, lo que no (con su detalle) y cuantas pasaron. */
export function informe(comprobaciones: readonly Comprobacion[]): string {
  const lineas = comprobaciones.map((c) =>
    c.ok ? `✓ ${c.nombre}` : `✗ ${c.nombre} — ${c.detalle}`,
  );
  const pasan = comprobaciones.filter((c) => c.ok).length;
  return [
    ...lineas,
    '',
    `${String(pasan)} de ${String(comprobaciones.length)} comprobaciones pasan.`,
  ].join('\n');
}

async function pedir(
  url: string,
  conCuerpo: boolean,
): Promise<{ status: number; headers: Record<string, string>; texto: string } | null> {
  try {
    const respuesta = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; verify-sitio)' },
      signal: AbortSignal.timeout(30_000),
    });
    const texto = conCuerpo ? await respuesta.text() : '';
    if (!conCuerpo) await respuesta.body?.cancel();
    return { status: respuesta.status, headers: Object.fromEntries(respuesta.headers), texto };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const direccion = process.argv[2];
  if (direccion === undefined) {
    console.error(
      'Uso: node scripts/verificar-sitio.ts <direccion>   (por ejemplo https://vsd-stock-sitio.pages.dev)',
    );
    process.exit(2);
  }
  const origen = new URL(direccion);
  if (origen.protocol !== 'https:') {
    console.error('La dirección tiene que ser https.');
    process.exit(2);
  }
  let compilado: string;
  try {
    compilado = readFileSync(resolve('sitio/dist/index.html'), 'utf8');
  } catch {
    console.error(
      'No hay sitio/dist/index.html: compila primero con `npm run build:sitio` (de la misma versión que publicaste).',
    );
    process.exit(2);
  }
  const destinos = (await import(pathToFileURL(resolve('sitio/pagina/destinos.ts')).href)) as {
    WHATSAPP_URL: string;
    WHATSAPP_NUMERO: string;
  };
  const esperado: Esperado = {
    ...esperadoDelHtml(compilado),
    whatsappUrl: destinos.WHATSAPP_URL,
    whatsappNumero: destinos.WHATSAPP_NUMERO,
  };

  console.log(`Verificando ${origen.origin} ...\n`);
  const pagina = await pedir(`${origen.origin}/`, true);
  const ruta = pagina === null ? null : rutaDeUnActivo(pagina.texto);
  const activo = ruta === null ? null : await pedir(`${origen.origin}${ruta}`, false);
  const whatsapp = await pedir(destinos.WHATSAPP_URL, false);
  const captura: Captura = {
    origen: origen.origin,
    pagina:
      pagina === null
        ? null
        : { status: pagina.status, headers: pagina.headers, html: pagina.texto },
    activo:
      activo === null || ruta === null
        ? null
        : { ruta, status: activo.status, headers: activo.headers },
    whatsapp: whatsapp === null ? null : { status: whatsapp.status, headers: whatsapp.headers },
  };

  const comprobaciones = evaluarSitio(captura, esperado);
  console.log(informe(comprobaciones));
  // Se fija el codigo y se deja que Node termine solo: si se sale de golpe con conexiones de `fetch` cerrandose, Node en Windows aborta
  // (UV_HANDLE_CLOSING) y tapa el resultado.
  process.exitCode = codigoDeSalida(comprobaciones);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
