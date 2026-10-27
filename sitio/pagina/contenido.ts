// TODO el texto de la landing, en un solo archivo (ADR 0033). Los componentes no escriben frases: leen de aqui. Asi una prueba
// (test/sitio/afirmaciones.spec.ts) puede vigilar que la pagina no afirme lo que el producto no hace: factura electronica,
// tarjetas, precios, «open source», testimonios, velocidades que no se midieron, celulares que no se probaron, funciones que
// todavia no existen y competidores. Desde el rediseno comercial (LND-2, 27 de octubre de 2026) vigila ademas que la pagina no
// parezca una prueba: ni «beta», ni «pruebas», ni «preproduccion», ni una barra que busque tiendas.
//
// Dos reglas para escribir aqui:
//  - Ninguna cifra de dinero va dentro de una frase: los ejemplos son datos (`ejemplosIva`, `arqueo`) y la pagina los pinta con el
//    dominio, asi no puede decir un numero distinto del que calcula el producto.
//  - Ninguna cifra que envejece (cantidad de pruebas, de decisiones): lo que se puede comprobar se dice sin numero, o se compara
//    con el contrato en la prueba (los tres roles, los cinco ejemplos).
//
// El precio no existe todavia: se dice «cotiza con un asesor» y nada mas. Tampoco hay clientes ni testimonios, y la pagina no
// inventa ninguno. Lo que sostiene cada afirmacion esta en V2-DOCUMENTOS/PROPUESTA-LANDING-VSD-STOCK.md (tabla de afirmaciones) y
// en los ADR 0013 a 0032 del backend.

import { APP_INGRESAR, APP_REGISTRARSE, WHATSAPP_URL } from './destinos';

export interface Enlace {
  readonly texto: string;
  readonly href: string;
}

/** Una de las cuatro funciones grandes: su texto, lo que se ve en su captura y cual captura es. */
export interface Destacada {
  readonly id: 'vender' | 'caja' | 'inventario' | 'reporte';
  readonly titulo: string;
  readonly texto: string;
  /** Lo que la funcion trae ademas, en renglones cortos. Puede no haber ninguno. */
  readonly puntos: readonly string[];
  readonly captura: 'cobrar' | 'cierre' | 'existencias' | 'reporte';
}

/** Una de las tres funciones chicas, que se explican sin captura. */
export interface Tarjeta {
  readonly id: 'sin-conexion' | 'iva' | 'roles';
  readonly titulo: string;
  readonly texto: string;
  /** La nota que acompana a la tarjeta (la del IVA es obligatoria mientras falte validarlo con quien declara). */
  readonly nota?: string;
  /** El precio con el que la tarjeta muestra el calculo, pintado con el dominio. */
  readonly ejemplo?: { readonly total: number; readonly tarifaBp: number };
  readonly roles?: readonly string[];
}

export interface EjemploIva {
  readonly total: number;
  readonly tarifaBp: number;
  readonly base: number;
  readonly iva: number;
}

/** Las secciones de la pagina y el nombre con que se las enlaza (`#como-empezar`). */
const anclas = {
  inicio: 'inicio',
  beneficios: 'beneficios',
  antesYDespues: 'antes-y-despues',
  funciones: 'funciones',
  pruebalo: 'pruebalo',
  comoEmpezar: 'como-empezar',
  paraQuien: 'para-quien',
  incluye: 'que-incluye',
  preguntas: 'preguntas',
  contacto: 'contacto',
} as const;

/** Con lo que abren la tarjeta de IVA y la calculadora: un solo ejemplo, para que la pagina cuente uno. */
const ejemploDeApertura = { total: 11900, tarifaBp: 1900 } as const;

/** Los cinco ejemplos que una revision contable externa comprobo (ADR 0032). La prueba los compara con el dominio. */
const ejemplosIva: readonly EjemploIva[] = [
  { total: 10000, tarifaBp: 1900, base: 8403, iva: 1597 },
  { total: 11900, tarifaBp: 1900, base: 10000, iva: 1900 },
  { total: 10000, tarifaBp: 500, base: 9524, iva: 476 },
  { total: 3500, tarifaBp: 500, base: 3333, iva: 167 },
  { total: 800, tarifaBp: 500, base: 762, iva: 38 },
];

export const contenido = {
  meta: {
    titulo: 'VSD Stock — ventas, inventario y caja para tu negocio',
    descripcion:
      'VSD Stock es el sistema para tiendas y pequeños comercios: registra tus ventas aunque se caiga el internet, lleva el inventario al día, separa el IVA y cuadra la caja por turno.',
  },

  marca: 'VSD Stock',

  anclas,

  /** Lo que un lector de pantalla necesita oir y la vista no necesita ver. */
  accesibilidad: {
    externo: 'se abre en otra pestaña',
  },

  navegacion: {
    saltar: 'Saltar al contenido',
    principal: 'Navegación principal',
    // El nombre visible del logo es «VSD Stock»: el nombre accesible lo contiene y dice a donde lleva.
    inicio: 'VSD Stock, ir al inicio',
    enlaces: [
      { texto: 'Beneficios', href: `#${anclas.beneficios}` },
      { texto: 'Funciones', href: `#${anclas.funciones}` },
      { texto: 'Cómo empezar', href: `#${anclas.comoEmpezar}` },
      { texto: 'Preguntas', href: `#${anclas.preguntas}` },
    ] as readonly Enlace[],
    ingresar: { texto: 'Iniciar sesión', href: APP_INGRESAR } as Enlace,
    cta: { texto: 'Solicitar mi acceso', href: APP_REGISTRARSE } as Enlace,
    abrirMenu: 'Abrir el menú',
    cerrarMenu: 'Cerrar el menú',
    // Un solo nombre para los dos estados: el servidor no sabe que tema eligio la persona, y el nombre no debe cambiar al cargar.
    cambiarTema: 'Cambiar entre tema claro y oscuro',
  },

  hero: {
    titulo: 'Tu negocio en orden: ventas, inventario y caja en un solo lugar.',
    subtitulo:
      'Registra tus ventas, sabe cuánto te queda de cada producto y revisa la caja al terminar cada turno. Si se cae el internet, sigues vendiendo.',
    ctaPrincipal: { texto: 'Solicitar mi acceso', href: APP_REGISTRARSE } as Enlace,
    ctaSecundario: { texto: 'Hablar con un asesor', href: WHATSAPP_URL } as Enlace,
    nota: 'Te acompañamos desde el primer turno.',
    puntos: [
      'Funciona sin internet',
      'El IVA ya viene separado',
      'Cada turno con su conteo de caja',
    ],
  },

  /** Lo que dice cada captura de la aplicacion para quien no la ve. Las medidas y el archivo estan en `capturas.ts`. */
  capturas: {
    vender:
      'Pantalla de venta en el teléfono: tres productos en la venta en curso y el total a cobrar.',
    existencias:
      'Pantalla de existencias en el computador: la lista de productos con lo que queda de cada uno.',
    cobrar:
      'Pantalla de cobro en el teléfono: el total de la venta y la forma de pago que registra el cajero.',
    cierre:
      'Pantalla de cierre de turno en el teléfono: el efectivo contado y cuánto falta en la caja.',
    reporte:
      'Pantalla del resumen del mes en el computador: las ventas separadas por tarifa de IVA y el total vendido.',
  },

  beneficios: {
    titulo: 'Lo que cambia en tu día a día',
    items: [
      {
        id: 'sin-internet',
        titulo: 'Vendes aunque se caiga el internet',
        texto:
          'La venta se guarda en el equipo y se envía sola cuando vuelve la conexión. La fila no espera a la red.',
      },
      {
        id: 'inventario',
        titulo: 'Sabes cuánto te queda',
        texto:
          'La existencia de cada producto sale de lo que entró y de lo que salió. Se acabó el cuaderno que no coincide con el estante.',
      },
      {
        id: 'caja',
        titulo: 'Cierras la caja sin adivinar',
        texto:
          'Cada turno tiene su apertura, sus cobros y su conteo. Al cerrar, VSD Stock te dice cuánto falta o cuánto sobra.',
      },
      {
        id: 'iva',
        titulo: 'El IVA ya viene separado',
        texto:
          'Tus precios llevan el IVA incluido. VSD Stock separa el valor sin IVA y el IVA, y los dos siempre suman el total.',
      },
    ],
  },

  antesYDespues: {
    titulo: 'De la libreta y la calculadora a un solo lugar',
    columnaAntes: 'Sin VSD Stock',
    columnaDespues: 'Con VSD Stock',
    filas: [
      {
        antes: 'Se cae la red y la venta se anota en papel para digitarla después.',
        despues: 'La venta se guarda en el equipo y se envía sola cuando vuelve la conexión.',
      },
      {
        antes: 'La caja no cuadra y nadie sabe de dónde salió la diferencia.',
        despues:
          'Cada turno tiene su apertura, sus cobros y su conteo, y ves cuánto falta o cuánto sobra.',
      },
      {
        antes: 'El cuaderno dice una cosa y el estante, otra.',
        despues:
          'La existencia sale de los movimientos de cada producto: lo que entró y lo que salió.',
      },
      {
        antes: 'El IVA de cada precio se saca a mano, con calculadora.',
        despues: 'VSD Stock separa el valor sin IVA y el IVA de cada precio con una sola regla.',
      },
    ],
  },

  /** El diagrama de «cómo viaja una venta»: lo que dice cada nodo y cada estado. */
  diagrama: {
    titulo: 'Cómo viaja una venta',
    nodos: {
      mostrador: 'Mostrador',
      cola: 'Ventas por enviar',
      servidor: 'Tu cuenta',
      libro: 'Libro de movimientos',
    },
    // Dice que es una simulación: quien lo toca no está cortando el internet de nadie.
    interruptor: 'Simular una caída de internet',
    estados: { conectado: 'Conectado', sinConexion: 'Sin conexión' },
    // El formato del número de un comprobante (serie del equipo y consecutivo): un ejemplo, no una venta real.
    folio: 'K7-000142',
    porEnviar: 'por enviar',
    // Las dos notas de la ultima venta son las del comprobante de la aplicacion (ReceiptPage): la que espera y la que ya llego.
    guardada: 'Guardada en este equipo. Se envía cuando haya conexión.',
    enviada: 'Venta guardada en tu cuenta.',
    ultimaVenta: 'Última venta',
    telefono: 'Pantalla del teléfono del mostrador',
    descripcion:
      'Con internet, la venta sale del mostrador y llega a tu cuenta, donde queda anotada en el libro de movimientos. Sin internet, se queda guardada en el equipo, entre las ventas por enviar, hasta que vuelva la conexión.',
  },

  funciones: {
    titulo: 'Todo lo que necesita tu mostrador, y nada que estorbe',
    destacadas: [
      {
        id: 'vender',
        titulo: 'Vende desde el celular o el computador',
        texto:
          'Busca el producto por nombre o lee su código con tu lector (USB o Bluetooth), arma la venta y cobra. Registras cómo pagó cada cliente: efectivo, tarjeta o transferencia.',
        puntos: [
          'El estante manda: si el sistema dice que no hay y en el estante sí, vendes y la venta queda marcada para ajustar.',
        ],
        captura: 'cobrar',
      },
      {
        id: 'caja',
        // No promete que la caja siempre cuadre: promete decir cuánto falta o sobra (auditoría de QA).
        titulo: 'Sabes cuánto falta o sobra al cerrar.',
        texto:
          'Abres el turno con el efectivo que hay, vendes y, al cerrar, escribes lo que contaste: VSD Stock te dice si cuadra mientras escribes. Cerrar con diferencia se permite: queda registrada para que el dueño o administrador la revise.',
        puntos: [],
        captura: 'cierre',
      },
      {
        id: 'inventario',
        titulo: 'Un inventario que se explica',
        texto:
          'La existencia sale de sumar y restar los movimientos de cada producto. Si anulas una venta, VSD Stock registra la anulación y su efecto en el inventario y la caja, sin borrar la venta.',
        puntos: [],
        captura: 'existencias',
      },
      {
        id: 'reporte',
        titulo: 'El resumen del mes, listo para quien lleva tus cuentas',
        texto:
          'Lo que vendiste en el mes, separado por tarifa de IVA, con las anulaciones y lo cobrado por medio de pago. Es un resumen para tu control interno: no es tu declaración de IVA.',
        puntos: [],
        captura: 'reporte',
      },
    ] as readonly Destacada[],
    tarjetas: [
      {
        id: 'sin-conexion',
        titulo: 'Sin conexión, de verdad.',
        texto:
          'Se instala como aplicación y abre sin internet. Vender, registrar el cobro, abrir y cerrar turno y consultar existencias funcionan sin red; lo probamos con la red cortada en navegadores reales. Cada equipo numera sus propios comprobantes (K7-000142): dos cajas sin red no repiten número.',
      },
      {
        id: 'iva',
        titulo: 'IVA que siempre suma.',
        texto:
          'Los precios llevan el IVA incluido (0 %, 5 % o 19 %). VSD Stock separa el valor sin IVA y el IVA con una sola regla de redondeo: el valor sin IVA más el IVA es siempre el total.',
        ejemplo: ejemploDeApertura,
        nota: 'Una revisión contable externa comprobó estos ejemplos. Antes de empezar a vender, lo validamos con quien lleva las declaraciones de tu tienda.',
      },
      {
        id: 'roles',
        titulo: 'Cada persona, lo suyo.',
        texto:
          'Tres roles: dueño, administrador y cajero. El cajero vende y cuadra su turno; no ve utilidades ni anula ventas. Los datos guardados en el equipo están protegidos mediante cifrado.',
        roles: ['dueño', 'administrador', 'cajero'],
      },
    ] as readonly Tarjeta[],
    /**
     * Lo que muestra cada tarjeta chica debajo de su titulo. Son datos, no frases: la pagina los pinta con el dominio (formatPesos,
     * splitTaxIncluded), asi no dice un numero distinto del que calcula el producto.
     */
    miniaturas: {
      sinConexion: { pendientes: 1 },
      iva: { precio: 'Precio', base: 'Valor sin IVA', iva: 'IVA' },
    },
  },

  /** Los ejemplos de IVA de la calculadora y de la tarjeta: datos, no frases. */
  ejemplosIva,

  /** La calculadora de IVA. Los nombres de lo que calcula (precio, valor sin IVA, IVA) son los de `funciones.miniaturas.iva`. */
  calculadora: {
    ejemplo: ejemploDeApertura,
    titulo: 'Pruébalo con un precio.',
    texto:
      'Escribe un precio con el IVA incluido y mira cómo VSD Stock separa el valor sin IVA y el IVA.',
    campo: 'Precio con IVA incluido',
    ayuda: 'Escribe solo números, sin puntos ni comas.',
    tarifa: 'Tarifa de IVA',
    ejemplos: 'O mira otro ejemplo',
    suma: 'Valor sin IVA más IVA',
  },

  /**
   * El arqueo de ejemplo: el efectivo que debe haber y el que la pagina muestra contado al abrir, en pesos. El mensaje lo escribe
   * el dominio (`describeCount`).
   */
  arqueo: {
    esperado: 170000,
    contado: 168000,
    titulo: 'Pruébalo con una caja de ejemplo.',
    texto: 'Cambia el efectivo contado y mira lo que te diría VSD Stock al cerrar el turno.',
    campo: 'Efectivo contado',
    ayuda: 'Escribe solo números, sin puntos ni comas.',
    esperadoEtiqueta: 'Efectivo esperado',
  },

  pruebalo: {
    titulo: 'Míralo funcionar, sin crear nada.',
    // Las pestañas de la banda: una demostración por pestaña.
    pestanas: { etiqueta: 'Elige una demostración', vender: 'Vender', iva: 'IVA', caja: 'Caja' },
    // Lo que se lee, sin verse, mientras baja el código de una pestaña que todavía no se había abierto.
    cargando: 'Cargando la demostración…',
    vender: {
      titulo: 'Corta la red. Sigue vendiendo.',
      texto:
        'Simula una caída de internet con el interruptor. La venta se guarda en el equipo y aumenta el número de ventas pendientes de enviar; cuando vuelve la red, se envían una tras otra.',
    },
  },

  comoEmpezar: {
    titulo: 'Empezar es sencillo',
    pasos: [
      {
        titulo: 'Cuéntanos de tu negocio.',
        texto: 'Con el botón de arriba nos dices quién eres y cómo se llama tu negocio.',
      },
      {
        titulo: 'Habla con un asesor.',
        texto:
          'Un asesor te contacta, resuelve tus dudas, te cotiza según tu negocio y activa tu cuenta cuando todo está confirmado.',
      },
      {
        titulo: 'Empieza a vender.',
        texto:
          'Cargas tus productos, abres tu primer turno y registras tu primera venta. Te acompañamos desde el primer turno.',
      },
    ],
  },

  paraQuien: {
    titulo: 'Hecho para negocios como el tuyo',
    items: [
      {
        titulo: 'Tiendas de barrio y minimercados',
        texto:
          'Vendes todo el día y necesitas saber qué queda en el estante y cuánto debe haber en la caja.',
      },
      {
        titulo: 'Negocios con cajeros o ayudantes',
        texto:
          'Cada persona entra con su rol: el cajero vende y cuadra su turno; el dueño y el administrador ven el resto.',
      },
      {
        titulo: 'Lugares donde el internet va y viene',
        texto:
          'Si la señal se cae, la venta queda guardada y se envía sola cuando vuelve. No pierdes la fila.',
      },
    ],
  },

  incluye: {
    titulo: 'Lo que incluye VSD Stock',
    columnaHace: 'Lo que ya hace por ti',
    columnaNoHace: 'Lo que sigue como lo haces hoy',
    // La palabra que lee un lector de pantalla donde la vista ve una marca (✓ o ✕).
    marcas: { hace: 'Sí', noHace: 'No' },
    hace: [
      'Vende y registra el cobro sin conexión',
      'Cuadra la caja por turno',
      'Separa el IVA que ya está incluido en el precio',
      'Mantiene la existencia al día',
      'Anula ventas sin borrar nada',
    ],
    noHace: [
      'Tu factura electrónica: VSD Stock no la emite y tu proceso ante la DIAN sigue como hoy',
      'Procesar tarjetas (registra la referencia; el cobro lo hace tu datáfono)',
      'Tu contabilidad: sigue con quien la lleva hoy',
    ],
    pie: 'El comprobante de VSD Stock dice «Comprobante de venta — no es factura», y es para tu control interno.',
  },

  preguntas: {
    titulo: 'Preguntas frecuentes',
    items: [
      {
        pregunta: '¿Cuánto cuesta VSD Stock?',
        respuesta:
          'Depende del tamaño de tu negocio. Cotiza con un asesor y te damos una propuesta a tu medida.',
      },
      {
        pregunta: '¿Cómo activo mi cuenta?',
        respuesta:
          'Solicitas tu acceso desde esta página. Un asesor te contacta, resuelve tus dudas y activa tu cuenta cuando todo está confirmado. Desde ahí te acompañamos en tu primer turno.',
      },
      {
        pregunta: '¿Funciona sin internet?',
        respuesta:
          'Sí: vender, registrar el cobro, abrir y cerrar turno y consultar existencias. Administrar el catálogo, los precios, las personas y los reportes sí necesita conexión.',
      },
      {
        pregunta: '¿Qué pasa con las ventas hechas sin red?',
        respuesta:
          'Quedan guardadas, cifradas, en el equipo y se envían solas cuando vuelve la conexión. La pantalla te dice cuáles esperan; si el sistema no acepta alguna, queda para que el dueño o administrador la revise.',
      },
      {
        pregunta: '¿Emite factura electrónica?',
        respuesta:
          'No. Tu facturación ante la DIAN sigue como hoy. El comprobante de VSD Stock es para tu control interno y lo dice.',
      },
      {
        pregunta: '¿Cobra con tarjeta?',
        respuesta: 'No. Registras cómo pagó el cliente; el cobro lo hace tu datáfono o tu banco.',
      },
      {
        pregunta: '¿Funciona en un teléfono barato? ¿En iPhone?',
        respuesta:
          'Lo estamos probando en un Android real; hasta terminar no prometemos velocidad en equipos de gama baja. En iPhone todavía no lo probamos: Safari puede borrar lo guardado si no se usa en varios días, por eso allí conviene enviar las ventas pronto.',
      },
      {
        pregunta: '¿Qué pasa con mis datos?',
        respuesta:
          'Los datos guardados en cada equipo están protegidos mediante cifrado y son de cada persona. Las ventas que no se han enviado quedan guardadas en el equipo. Si cierras sesión antes de enviarlas, esas ventas se perderán; la aplicación te avisa cuántas son antes de cerrar.',
      },
    ],
  },

  cta: {
    titulo: 'Empieza a llevar tu negocio con orden',
    subtitulo:
      'Cuéntanos de tu negocio o habla con un asesor. Te acompañamos desde el primer turno.',
    principal: { texto: 'Solicitar mi acceso', href: APP_REGISTRARSE } as Enlace,
    secundario: { texto: 'Hablar con un asesor', href: WHATSAPP_URL } as Enlace,
    avisoAsesor: 'Se abre WhatsApp',
  },

  pie: {
    columnas: [
      {
        titulo: 'Producto',
        enlaces: [
          { texto: 'Beneficios', href: `#${anclas.beneficios}` },
          { texto: 'Funciones', href: `#${anclas.funciones}` },
          { texto: 'Cómo empezar', href: `#${anclas.comoEmpezar}` },
          { texto: 'Preguntas', href: `#${anclas.preguntas}` },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Tu cuenta',
        enlaces: [
          { texto: 'Iniciar sesión', href: APP_INGRESAR },
          { texto: 'Solicitar mi acceso', href: APP_REGISTRARSE },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Contacto',
        enlaces: [{ texto: 'Hablar con un asesor', href: WHATSAPP_URL }] as readonly Enlace[],
      },
    ],
    aviso:
      'VSD Stock es control interno de inventario y cuadre de caja. No es un facturador electrónico.',
  },
};

// Lo que falta resolver antes de publicar en la direccion publica vive en `pendientes.ts` (una hoja sin imports que el script de
// publicacion puede leer en Node); se reexporta aqui para que la pagina y las pruebas lo sigan leyendo de `contenido`.
export { PENDIENTES_DE_PUBLICAR, puedePublicar } from './pendientes';
export type { Pendiente } from './pendientes';
