// TODO el texto de la landing, en un solo archivo (ADR 0033). Los componentes no escriben frases: leen de aqui. Asi una prueba
// (test/sitio/afirmaciones.spec.ts) puede vigilar que la pagina no afirme lo que el producto no hace: factura electronica,
// tarjetas, precios, «open source», testimonios, velocidades que no se midieron, celulares que no se probaron, funciones que
// todavia no existen y competidores.
//
// Dos reglas para escribir aqui:
//  - Ninguna cifra de dinero va dentro de una frase: los ejemplos son datos (`ejemplosIva`, `arqueo`) y la pagina los pinta con el
//    dominio, asi no puede decir un numero distinto del que calcula el producto.
//  - Ninguna cifra que envejece (cantidad de pruebas, de decisiones): lo que se puede comprobar se dice sin numero, o se compara
//    con el contrato en la prueba (los tres roles, los cinco ejemplos).
//
// Lo que sostiene cada afirmacion esta en V2-DOCUMENTOS/PROPUESTA-LANDING-VSD-STOCK.md (tabla de afirmaciones) y en los ADR
// 0013 a 0032 del backend. Las preguntas y los sellos enlazan a esos documentos.

import { DEMO_DE_PRE, REPOSITORIO_BACKEND, REPOSITORIO_FRONTEND, WHATSAPP_URL } from './destinos';

export interface Enlace {
  readonly texto: string;
  readonly href: string;
}

export interface Tarjeta {
  readonly id: 'sin-conexion' | 'iva' | 'caja' | 'inventario' | 'estante' | 'roles';
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

/** Una decision escrita del backend que sostiene lo que la pagina dice: su numero, a donde lleva y de que trata. */
export interface Sello extends Enlace {
  readonly detalle: string;
}

export interface Testimonio {
  readonly cita: string;
  readonly autor: string;
  /** Donde esta el permiso por escrito de la persona. Sin permiso no se publica una cita. */
  readonly permiso: string;
}

/** Las secciones de la pagina y el nombre con que se las enlaza (`#como-funciona`). */
const anclas = {
  inicio: 'inicio',
  problema: 'problema',
  comoFunciona: 'como-funciona',
  funciones: 'funciones',
  demo: 'demo',
  limites: 'limites',
  confianza: 'confianza',
  loQueViene: 'lo-que-viene',
  preguntas: 'preguntas',
  piloto: 'piloto',
} as const;

const adr = (archivo: string): string =>
  `${REPOSITORIO_BACKEND}/blob/desarrollo/docs/adr/${archivo}`;

/** Los cinco ejemplos que una revision contable externa recalculo (ADR 0032). La prueba los compara con el dominio. */
const ejemplosIva: readonly EjemploIva[] = [
  { total: 10000, tarifaBp: 1900, base: 8403, iva: 1597 },
  { total: 11900, tarifaBp: 1900, base: 10000, iva: 1900 },
  { total: 10000, tarifaBp: 500, base: 9524, iva: 476 },
  { total: 3500, tarifaBp: 500, base: 3333, iva: 167 },
  { total: 800, tarifaBp: 500, base: 762, iva: 38 },
];

export const contenido = {
  meta: {
    titulo: 'VSD Stock — punto de venta, inventario y caja que no se detienen',
    descripcion:
      'VSD Stock es el punto de venta de la tienda de barrio: vende aunque se caiga el internet, calcula el IVA de cada precio y cuadra la caja por turno. Versión en pruebas.',
  },

  marca: 'VSD Stock',

  anclas,

  /** Lo que un lector de pantalla necesita oir y la vista no necesita ver. */
  accesibilidad: {
    externo: 'se abre en otra pestaña',
  },

  anuncio: {
    etiqueta: 'EN PRUEBAS',
    texto: 'Vender, caja y modo sin conexión ya funcionan. Buscamos tiendas piloto',
    enlace: { texto: 'Escríbenos por WhatsApp', href: WHATSAPP_URL },
  },

  navegacion: {
    saltar: 'Saltar al contenido',
    principal: 'Navegación principal',
    // El nombre visible del logo es «VSD Stock»: el nombre accesible lo contiene y dice a donde lleva.
    inicio: 'VSD Stock, ir al inicio',
    enlaces: [
      { texto: 'Cómo funciona', href: `#${anclas.comoFunciona}` },
      { texto: 'Funciones', href: `#${anclas.funciones}` },
      { texto: 'Confianza', href: `#${anclas.confianza}` },
      { texto: 'Preguntas', href: `#${anclas.preguntas}` },
    ] as readonly Enlace[],
    cta: { texto: 'Ser tienda piloto', href: WHATSAPP_URL } as Enlace,
    abrirMenu: 'Abrir el menú',
    cerrarMenu: 'Cerrar el menú',
    // Un solo nombre para los dos estados: el servidor no sabe que tema eligio la persona, y el nombre no debe cambiar al cargar.
    cambiarTema: 'Cambiar entre tema claro y oscuro',
  },

  /** La barra de abajo del telefono: aparece cuando el hero ya paso. */
  barraContacto: {
    etiqueta: 'Invitación a ser tienda piloto',
    texto: 'Buscamos tiendas piloto para probar VSD Stock.',
    boton: 'Escríbenos',
    cerrar: 'Cerrar este aviso',
  },

  hero: {
    etiqueta: 'PUNTO DE VENTA · INVENTARIO · CAJA',
    // El componente separa las partes con un espacio: aqui ninguna lleva espacios en los extremos.
    titulo: { antes: 'Vende aunque se caiga el', marca: 'internet', despues: '.' },
    subtitulo:
      'VSD Stock es el punto de venta de la tienda de barrio: registra el cobro sin conexión, calcula el IVA de cada precio y cuadra la caja cuando cierras el turno.',
    ctaPrincipal: { texto: 'Quiero ser tienda piloto', href: WHATSAPP_URL } as Enlace,
    ctaSecundario: { texto: 'Ver la demo de pruebas', href: DEMO_DE_PRE } as Enlace,
    nota: 'Versión en pruebas. La demo usa datos ficticios.',
    sellos: [
      'Funciona sin conexión (en pruebas)',
      'Código a la vista',
      'IVA con revisión contable externa',
    ],
  },

  /** El diagrama de «cómo viaja una venta» (C4-L4): lo que dice cada nodo y cada estado. */
  diagrama: {
    titulo: 'Cómo viaja una venta',
    nodos: {
      mostrador: 'Mostrador',
      cola: 'Cola de envío',
      servidor: 'Servidor',
      libro: 'Libro de movimientos',
    },
    interruptor: 'Cortar internet',
    estados: { conectado: 'Conectado', sinConexion: 'Sin conexión' },
    // El formato del folio de una venta (serie del equipo y consecutivo): un ejemplo, no una venta real.
    folio: 'K7-000142',
    porEnviar: 'por enviar',
    // Las dos notas de la ultima venta son las del comprobante de la aplicacion (ReceiptPage): la que espera y la que ya llego.
    guardada: 'Guardada en este equipo. Se envía cuando haya conexión.',
    enviada: 'Guardada y enviada al servidor.',
    ultimaVenta: 'Última venta',
    telefono: 'Pantalla del teléfono del mostrador',
    descripcion:
      'Con internet, la venta sale del mostrador, pasa por la cola de envío y llega al servidor, que la anota en el libro de movimientos. Sin internet, se queda en la cola, en el equipo, hasta que vuelva la conexión.',
  },

  problema: {
    etiqueta: 'EL PROBLEMA',
    titulo: 'Una tienda no puede parar porque falle la red.',
    tarjetas: [
      {
        etiqueta: 'CORTE',
        titulo: 'La red se cae, la fila no.',
        texto:
          'Si el punto de venta depende de internet, cada corte es una venta anotada en papel y digitada después.',
      },
      {
        etiqueta: 'CAJA',
        titulo: 'La caja no cuadra y nadie sabe por qué.',
        texto:
          'Sin un turno con su apertura, sus cobros y su conteo, la diferencia no tiene dueño.',
      },
      {
        etiqueta: 'INVENTARIO',
        titulo: 'El cuaderno dice una cosa; el estante, otra.',
        texto: 'Cuando la existencia es una cifra que alguien edita a mano, deja de ser confiable.',
      },
      {
        etiqueta: 'IVA',
        titulo: 'El IVA, con calculadora.',
        texto: 'Sacar la base y el IVA de cada precio a mano… y que al final no sume.',
      },
    ],
  },

  comoFunciona: {
    etiqueta: 'CÓMO FUNCIONA',
    titulo: 'Tres pasos, un turno.',
    pasos: [
      {
        titulo: 'Abre el turno.',
        texto:
          'Escribe el efectivo que hay en la caja. Desde ahí, todo lo que vendas queda en ese turno.',
      },
      {
        titulo: 'Vende, con o sin red.',
        texto:
          'Busca por nombre o lee el código con tu lector. Registra cómo te pagaron: efectivo, tarjeta o transferencia. La venta se guarda en el equipo y se envía cuando haya conexión.',
      },
      {
        titulo: 'Cierra y cuadra.',
        texto:
          'Cuenta el efectivo y escríbelo. VSD Stock te dice si cuadra, cuánto falta o cuánto sobra, mientras escribes.',
      },
    ],
    /**
     * El arqueo de ejemplo: el efectivo que debe haber y el que la pagina muestra contado al abrir, en pesos. El mensaje lo escribe
     * el dominio (`describeCount`); la diferencia entre los dos es la de la tarjeta «Una caja que cuadra» (`miniaturas.caja`).
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
  },

  funciones: {
    etiqueta: 'FUNCIONES',
    titulo: 'Lo que necesita un mostrador, y nada que estorbe.',
    tarjetas: [
      {
        id: 'sin-conexion',
        titulo: 'Sin conexión, de verdad.',
        texto:
          'Se instala como aplicación y abre sin internet. Vender, registrar el cobro, abrir y cerrar turno y consultar existencias funcionan sin red; lo probamos con la red cortada en navegadores reales. Cada equipo lleva su propia serie de folios (K7-000142): dos cajas sin red no repiten número.',
      },
      {
        id: 'iva',
        titulo: 'IVA que siempre suma.',
        texto:
          'Los precios llevan el IVA incluido (0 %, 5 % o 19 %). VSD Stock separa base e IVA con una sola regla de redondeo: base más IVA es siempre el total.',
        ejemplo: { total: 11900, tarifaBp: 1900 },
        nota: 'El cálculo lo recalculó una revisión contable externa. Antes de vender en vivo lo validamos con quien lleva las declaraciones de tu tienda.',
      },
      {
        id: 'caja',
        titulo: 'Una caja que cuadra.',
        texto:
          'Turno con apertura, cobros en efectivo y otros medios por separado, conteo al cierre y la diferencia anotada. Cerrar con diferencia se permite: queda registrada para la gerencia.',
      },
      {
        id: 'inventario',
        titulo: 'Un inventario que se explica.',
        texto:
          'La existencia es la suma de los movimientos. Anular una venta no borra nada: agrega los movimientos que la compensan, de existencia y de caja.',
      },
      {
        id: 'estante',
        titulo: 'El estante manda.',
        texto:
          'Si el sistema dice que no hay y en el estante sí, vendes: la línea te avisa y la venta queda marcada para ajustar. Hoy lees códigos con tu lector USB o Bluetooth, o buscas por nombre.',
      },
      {
        id: 'roles',
        titulo: 'Cada persona, lo suyo.',
        texto:
          'Tres roles: dueño, administrador y cajero. El cajero vende y cuadra su turno; no ve utilidades ni anula ventas. Lo guardado en cada equipo va cifrado.',
        roles: ['dueño', 'administrador', 'cajero'],
      },
    ] as readonly Tarjeta[],
    /**
     * Lo que muestra cada tarjeta debajo de su titulo. Son datos, no frases: la pagina los pinta con el dominio (formatPesos,
     * describeDifference, formatSignedQuantity), asi no dice un numero distinto del que calcula el producto.
     */
    miniaturas: {
      sinConexion: { pendientes: 1 },
      iva: { precio: 'Precio', base: 'Base', iva: 'IVA' },
      caja: { etiqueta: 'Al cerrar el turno', diferencia: -2000 },
      inventario: {
        etiqueta: 'Movimientos',
        movimientos: [
          { tipo: 'Venta', milesimas: -1000 },
          { tipo: 'Anulación', milesimas: 1000 },
        ],
      },
      estante: { sistema: 'El sistema dice que no hay', accion: 'Vendes igual y queda marcada' },
    },
  },

  /** Los ejemplos de IVA de la calculadora y de la tarjeta: datos, no frases. */
  ejemplosIva,

  /** La calculadora de IVA (C4-L5). Los nombres de lo que calcula (precio, base, IVA) son los de `funciones.miniaturas.iva`. */
  calculadora: {
    titulo: 'Pruébalo con un precio.',
    texto: 'Escribe un precio con el IVA incluido y mira cómo VSD Stock separa la base y el IVA.',
    campo: 'Precio con IVA incluido',
    ayuda: 'Escribe solo números, sin puntos ni comas.',
    tarifa: 'Tarifa de IVA',
    ejemplos: 'O prueba con un ejemplo',
    suma: 'Base más IVA',
  },

  demo: {
    etiqueta: 'LA DEMO',
    titulo: 'Corta la red. Sigue vendiendo.',
    pestanas: { precio: 'Un precio', venta: 'Una venta' },
    cifras: [
      {
        valor: '5 de 5',
        texto: 'ejemplos de IVA que una revisión contable externa recalculó, y coinciden',
      },
      {
        valor: '6 cajas',
        texto: 'simuladas vendiendo sin red en pruebas automáticas: la caja cuadró',
      },
      { valor: '3 roles', texto: 'dueño, administrador y cajero' },
    ],
    boton: { texto: 'Abrir la demo de pruebas', href: DEMO_DE_PRE } as Enlace,
    nota: 'Datos ficticios. Si lleva un rato sin uso, puede tardar unos 25 segundos en despertar.',
  },

  limites: {
    etiqueta: 'LÍMITES',
    titulo: 'Tu facturación sigue donde está. VSD Stock lleva el inventario y la caja.',
    columnaHace: 'Lo que hace hoy',
    columnaNoHace: 'Lo que no hace',
    // La palabra que lee un lector de pantalla donde la vista ve una marca (✓ o ✕).
    marcas: { hace: 'Sí', noHace: 'No' },
    hace: [
      'Vende y registra el cobro sin conexión',
      'Cuadra la caja por turno',
      'Calcula el IVA incluido en el precio',
      'Mantiene la existencia al día',
      'Anula ventas sin borrar nada',
    ],
    noHace: [
      'Emitir factura electrónica (tu proceso ante la DIAN sigue como hoy)',
      'Procesar tarjetas (registra la referencia; el cobro lo hace tu datáfono)',
      'Llevar tu contabilidad',
      'Reportes mensuales (vienen después)',
    ],
    pie: 'El comprobante de VSD Stock dice «Comprobante de venta — no es factura», y es para tu control interno.',
  },

  confianza: {
    etiqueta: 'CONFIANZA',
    titulo: 'Hecho para que se pueda comprobar.',
    puntos: [
      {
        titulo: 'Código a la vista',
        texto: 'Los dos repositorios son públicos en GitHub.',
        enlaces: [
          { texto: 'Backend', href: REPOSITORIO_BACKEND },
          { texto: 'Frontend', href: REPOSITORIO_FRONTEND },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Decisiones escritas',
        texto:
          'Cada decisión de arquitectura está escrita en el repositorio, con las alternativas que descartamos y lo que cuesta.',
        enlaces: [
          { texto: 'Leer las decisiones', href: `${REPOSITORIO_BACKEND}/tree/desarrollo/docs/adr` },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Pruebas que rompen el código a propósito',
        texto:
          'Alteramos el código para comprobar que las pruebas lo notan; si no lo notan, no sirven.',
        enlaces: [] as readonly Enlace[],
      },
      {
        titulo: 'IVA revisado',
        texto:
          'Una revisión contable externa recalculó nuestros ejemplos y coinciden. Antes de vender en vivo lo validamos con quien lleva las declaraciones de tu tienda.',
        enlaces: [
          {
            texto: 'Leer la revisión',
            href: adr('0032-un-contador-reviso-la-mecanica-del-iva.md'),
          },
        ] as readonly Enlace[],
      },
    ],
    sellosTitulo: 'Las decisiones que lo sostienen',
    sellos: [
      {
        texto: 'ADR 0014',
        detalle: 'Dinero, impuestos y redondeo',
        href: adr('0014-dinero-impuestos-y-redondeo.md'),
      },
      {
        texto: 'ADR 0017',
        detalle: 'Roles, permisos y modo sin conexión',
        href: adr('0017-roles-permisos-y-modo-sin-conexion.md'),
      },
      {
        texto: 'ADR 0032',
        detalle: 'Un contador revisó la mecánica del IVA',
        href: adr('0032-un-contador-reviso-la-mecanica-del-iva.md'),
      },
    ] as readonly Sello[],
    /**
     * Hoy no hay ninguno y la pagina no lo muestra. Una cita real entra aqui con el permiso por escrito de la persona; el
     * componente que la pinta solo existe cuando esta lista deja de estar vacia.
     */
    testimonios: [] as readonly Testimonio[],
  },

  loQueViene: {
    etiqueta: 'LO QUE VIENE',
    titulo: 'Lo que falta, dicho sin adornos.',
    items: [
      { estado: 'DECIDIDO', texto: 'Exento y excluido de IVA, antes de las ventas reales.' },
      {
        estado: 'DECIDIDO',
        texto: 'Reporte mensual por tarifa, con las anulaciones y los medios de pago aparte.',
      },
      { estado: 'PENDIENTE', texto: 'Folio propio para las anulaciones.' },
      { estado: 'PENDIENTE', texto: 'Lectura de códigos con la cámara del teléfono.' },
      { estado: 'PENDIENTE', texto: 'Varias formas de pago en una misma venta.' },
    ],
    pie: 'Es una lista de intenciones; no es una promesa de fechas.',
  },

  preguntas: {
    etiqueta: 'PREGUNTAS',
    titulo: 'Lo que suelen preguntar.',
    items: [
      {
        pregunta: '¿Funciona sin internet?',
        respuesta:
          'Sí: vender, registrar el cobro, abrir y cerrar turno y consultar existencias. Administrar el catálogo, los precios, las personas y los reportes sí necesita conexión.',
      },
      {
        pregunta: '¿Qué pasa con las ventas hechas sin red?',
        respuesta:
          'Quedan guardadas, cifradas, en el equipo y se envían solas cuando vuelve la conexión. La pantalla te dice cuáles esperan; si el servidor no acepta alguna, queda para que la gerencia la revise.',
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
        pregunta: '¿Dos cajas pueden vender a la vez sin red?',
        respuesta:
          'Sí. Cada equipo tiene su código y su serie de folios, así que no se repiten. En pruebas automáticas simulamos seis.',
      },
      {
        pregunta: '¿Funciona en un teléfono barato? ¿En iPhone?',
        respuesta:
          'Lo estamos probando en un Android real; hasta terminar no prometemos velocidad en equipos de gama baja. En iPhone todavía no lo probamos: Safari puede borrar lo guardado si no se usa en varios días, por eso allí conviene enviar las ventas pronto.',
      },
      {
        pregunta: '¿Qué pasa con mis datos?',
        respuesta:
          'Lo que se guarda en cada equipo va cifrado y es de cada persona. Al cerrar sesión, si quedan ventas sin enviar, la aplicación te avisa cuántas son antes de olvidar lo guardado.',
      },
    ],
  },

  cta: {
    titulo: 'Prueba VSD Stock en tu mostrador.',
    subtitulo: 'Buscamos las primeras tiendas piloto. Te acompañamos desde el primer turno.',
    boton: { texto: 'Quiero ser tienda piloto', href: WHATSAPP_URL } as Enlace,
    avisoBoton: 'Se abre WhatsApp',
    enlaceDemo: { texto: 'O mira la demo de pruebas', href: DEMO_DE_PRE } as Enlace,
  },

  pie: {
    columnas: [
      {
        titulo: 'Producto',
        enlaces: [
          { texto: 'Cómo funciona', href: `#${anclas.comoFunciona}` },
          { texto: 'Funciones', href: `#${anclas.funciones}` },
          { texto: 'Lo que viene', href: `#${anclas.loQueViene}` },
          { texto: 'Preguntas', href: `#${anclas.preguntas}` },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Confianza',
        enlaces: [
          { texto: 'Código del backend en GitHub', href: REPOSITORIO_BACKEND },
          { texto: 'Código del frontend en GitHub', href: REPOSITORIO_FRONTEND },
          {
            texto: 'Decisiones de arquitectura',
            href: `${REPOSITORIO_BACKEND}/tree/desarrollo/docs/adr`,
          },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Contacto',
        enlaces: [{ texto: 'WhatsApp', href: WHATSAPP_URL }] as readonly Enlace[],
      },
    ],
    aviso:
      'VSD Stock es control interno de inventario y cuadre de caja. No es un facturador electrónico.',
  },

  /** Lo que dice el chip del estado de la demo de PRE (C4-L6). Ninguno dice «caída»: un servidor gratuito dormido no esta roto. */
  estadoDemo: {
    verificando: 'Verificando la demo… Usa datos ficticios.',
    despierta: 'Demo de pruebas disponible · datos ficticios',
    dormida: 'Demo en reposo; puede tardar ~25 s en despertar · datos ficticios',
  },
};

export interface Pendiente {
  readonly que: string;
  readonly quien: string;
}

/**
 * Lo que alguien tiene que resolver antes de publicar la pagina en produccion. El script de publicacion (C4-L8) se detiene
 * mientras haya algo aqui: una vista previa puede mostrarse con pendientes, la direccion publica no.
 */
export const PENDIENTES_DE_PUBLICAR: readonly Pendiente[] = [
  {
    que: 'Leer el texto en voz alta con una persona que atienda una tienda: nadie del equipo lo ha hecho todavía',
    quien: 'Diego',
  },
  {
    que: 'Preguntar a quien lleve lo legal si hace falta un aviso en la primera respuesta de WhatsApp (Ley 1581 de 2012; la cito de memoria, no la verifiqué)',
    quien: 'Diego',
  },
  {
    que: 'Actualizar la respuesta sobre teléfonos con el resultado de la prueba en el Android real (C3-16)',
    quien: 'Samuel',
  },
];

/** Si la pagina puede publicarse en su direccion publica: solo cuando no queda nada pendiente. */
export function puedePublicar(pendientes: readonly Pendiente[]): {
  readonly puede: boolean;
  readonly pendientes: readonly string[];
} {
  return {
    puede: pendientes.length === 0,
    pendientes: pendientes.map((p) => `${p.que} (${p.quien})`),
  };
}
