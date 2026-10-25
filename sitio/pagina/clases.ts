// Las clases que se repiten en toda la pagina, en un solo lugar para que un boton se vea igual en el hero, en la barra y al final.

/** El ancho de lectura de la pagina y su margen lateral: el mismo en todas las secciones. */
export const contenedor = 'mx-auto w-full max-w-6xl px-gutter sm:px-6 lg:px-8';

/** El espacio vertical de una seccion. */
export const respiro = 'py-20 md:py-28';

const boton =
  'inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold transition-colors duration-(--duration-base)';

/** El boton principal: naranja de la marca, letras azules (contraste AA). */
export const botonPrimario = `${boton} bg-accent text-on-accent shadow-sm hover:bg-accent-hover`;

/** El boton de al lado: sin relleno, para lo que importa menos. */
export const botonSecundario = `${boton} border border-border text-fg hover:bg-surface-raised`;

/** El boton principal sobre la banda naranja del final: azul oscuro. */
export const botonSobreNaranja = `${boton} bg-band text-on-band shadow-sm hover:opacity-90`;

/** La etiqueta pequeña, en mono, que va sobre el titulo de cada seccion. */
export const etiqueta = 'font-mono text-xs font-medium uppercase tracking-[0.18em]';

/**
 * La tarjeta sobre una seccion de fondo claro: borde fino, fondo levantado. Pinta tambien su texto (`text-fg`): sobre la banda azul
 * de la demo heredaria el blanco de la banda, y en el tema claro se leeria blanco sobre blanco.
 */
export const tarjeta = 'rounded-2xl border border-rule bg-surface-raised p-6 text-fg';

/** La tarjeta sobre una seccion de fondo levantado: el fondo es el de la pagina, para que se separe. */
export const tarjetaClara = 'rounded-2xl border border-rule bg-surface p-6 text-fg';

/** Un campo de texto de las demos: mide lo que un dedo (ADR 0008) y su borde se ve en los dos temas. */
export const campoTexto =
  'mt-1 min-h-touch w-full rounded-md border border-border bg-surface-raised px-3 font-mono text-base text-fg shadow-sm';

/** Un boton que es solo un icono, sobre la banda azul de la navegacion. Mide lo que mide un dedo. */
export const botonIcono =
  'inline-flex size-touch items-center justify-center rounded-lg text-on-band/80 transition-colors duration-(--duration-base) hover:bg-white/10 hover:text-on-band';
