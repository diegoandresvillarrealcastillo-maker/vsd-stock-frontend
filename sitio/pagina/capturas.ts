// Las capturas de la aplicacion que muestra la pagina (LND-2). Son imagenes reales de la aplicacion con datos de ejemplo («Minimercado
// La Esquina»), guardadas en `sitio/public/capturas/`. Una hoja sin imports, como `destinos.ts`: dice donde esta cada una y cuanto
// mide, para que el navegador le reserve el espacio antes de que llegue y la pagina no salte. `test/sitio/capturas.spec.ts` comprueba
// que las medidas son las del archivo. Lo que dice cada una para quien no la ve esta en `contenido.ts` (`contenido.capturas`).

export interface Captura {
  readonly src: string;
  readonly ancho: number;
  readonly alto: number;
}

export const CAPTURAS = {
  /** El mostrador con una venta en curso, en un telefono. */
  vender: { src: '/capturas/vender-movil.webp', ancho: 520, alto: 1125 },
  /** Las existencias de cada producto, en un computador. */
  existencias: { src: '/capturas/existencias-escritorio.webp', ancho: 1100, alto: 688 },
  /** El cobro de una venta con sus formas de pago, en un telefono. */
  cobrar: { src: '/capturas/cobrar-movil.webp', ancho: 520, alto: 1125 },
  /** El cierre del turno diciendo cuanto falta, en un telefono. */
  cierre: { src: '/capturas/cierre-movil.webp', ancho: 520, alto: 1125 },
  /** El resumen del mes con el IVA separado por tarifa, en un computador. */
  reporte: { src: '/capturas/reporte-escritorio.webp', ancho: 1100, alto: 657 },
} as const satisfies Record<string, Captura>;

export type IdDeCaptura = keyof typeof CAPTURAS;
