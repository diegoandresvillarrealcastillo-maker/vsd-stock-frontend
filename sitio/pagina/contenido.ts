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

import {
  APP_INGRESAR,
  APP_REGISTRARSE,
  DEMO_DE_PRE,
  REPOSITORIO_BACKEND,
  REPOSITORIO_FRONTEND,
  WHATSAPP_URL,
} from './destinos';

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

/** Con lo que abren la tarjeta de IVA y la calculadora: un solo ejemplo, para que la pagina cuente uno. */
const ejemploDeApertura = { total: 11900, tarifaBp: 1900 } as const;

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
      'VSD Stock es el punto de venta de la tienda de barrio: vende aunque se caiga el internet, separa el IVA que ya está incluido en el precio y cuadra la caja por turno. Versión en pruebas.',
  },

  marca: 'VSD Stock',

  anclas,

  /** Lo que un lector de pantalla necesita oir y la vista no necesita ver. */
  accesibilidad: {
    externo: 'se abre en otra pestaña',
  },

  anuncio: {
    nombre: 'Aviso',
    etiqueta: 'EN PRUEBAS',
    texto: 'Vender, caja y modo sin conexión ya funcionan. Buscamos tiendas para probarlo',
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
    ingresar: { texto: 'Iniciar sesión', href: APP_INGRESAR } as Enlace,
    cta: { texto: 'Crear cuenta', href: APP_REGISTRARSE } as Enlace,
    abrirMenu: 'Abrir el menú',
    cerrarMenu: 'Cerrar el menú',
    // Un solo nombre para los dos estados: el servidor no sabe que tema eligio la persona, y el nombre no debe cambiar al cargar.
    cambiarTema: 'Cambiar entre tema claro y oscuro',
  },

  /** La barra de abajo del telefono: aparece cuando el hero ya paso. */
  barraContacto: {
    etiqueta: 'Invitación a probar VSD Stock en tu tienda',
    texto: 'Buscamos tiendas para probar VSD Stock.',
    boton: 'Escríbenos',
    href: WHATSAPP_URL,
    cerrar: 'Cerrar este aviso',
  },

  hero: {
    etiqueta: 'PUNTO DE VENTA · INVENTARIO · CAJA',
    // El componente separa las partes con un espacio: aqui ninguna lleva espacios en los extremos.
    titulo: { antes: 'Vende aunque se caiga el', marca: 'internet', despues: '.' },
    subtitulo:
      'Registra tus ventas, controla cuántos productos te quedan y revisa cuánto dinero debe haber en caja al terminar el turno. Las ventas se guardan en el equipo y se envían a tu cuenta cuando vuelve la conexión.',
    ctaPrincipal: { texto: 'Crear mi cuenta', href: APP_REGISTRARSE } as Enlace,
    ctaSecundario: { texto: 'Escríbenos por WhatsApp', href: WHATSAPP_URL } as Enlace,
    // La factura se dice aquí, junto al primer botón (auditoría de QA): una tienda lo lee antes de crear su cuenta. Mientras no exista
    // PROD, la cuenta se crea en PRE: se dice aquí, junto al botón, para que nadie cargue datos reales creyendo que es producción.
    nota: 'Versión en pruebas, con acompañamiento. La cuenta se crea en el ambiente de pruebas: todavía no cargues los datos reales de tu tienda. La prueba con ventas de ejemplo usa datos ficticios. VSD Stock no emite factura electrónica; esa obligación se gestiona por separado.',
    sellos: [
      'Funciona sin conexión (en pruebas)',
      'Código publicado para revisión',
      'IVA con revisión contable externa',
    ],
  },

  /** El diagrama de «cómo viaja una venta» (C4-L4): lo que dice cada nodo y cada estado. */
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
    // El formato del folio de una venta (serie del equipo y consecutivo): un ejemplo, no una venta real.
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
          'Sin un turno con su apertura, sus cobros y su conteo, es difícil saber de dónde salió la diferencia.',
      },
      {
        etiqueta: 'INVENTARIO',
        titulo: 'El cuaderno dice una cosa; el estante, otra.',
        texto: 'Cuando la existencia es una cifra que alguien edita a mano, deja de ser confiable.',
      },
      {
        etiqueta: 'IVA',
        titulo: 'El IVA, con calculadora.',
        texto: 'Sacar el valor sin IVA y el IVA de cada precio a mano… y que al final no sume.',
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
     * el dominio (`describeCount`); la diferencia entre los dos es la de la tarjeta «Sabes cuánto falta o sobra al cerrar» (`miniaturas.caja`).
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
          'Se instala como aplicación y abre sin internet. Vender, registrar el cobro, abrir y cerrar turno y consultar existencias funcionan sin red; lo probamos con la red cortada en navegadores reales. Cada equipo numera sus propios comprobantes (K7-000142): dos cajas sin red no repiten número.',
      },
      {
        id: 'iva',
        titulo: 'IVA que siempre suma.',
        texto:
          'Los precios llevan el IVA incluido (0 %, 5 % o 19 %). VSD Stock separa el valor sin IVA y el IVA con una sola regla de redondeo: el valor sin IVA más el IVA es siempre el total.',
        ejemplo: ejemploDeApertura,
        nota: 'Una revisión contable externa comprobó estos ejemplos. Antes de usarlo con ventas reales lo validamos con quien lleva las declaraciones de tu tienda.',
      },
      {
        id: 'caja',
        // No promete que la caja siempre cuadre: promete decir cuánto falta o sobra (auditoría de QA).
        titulo: 'Sabes cuánto falta o sobra al cerrar.',
        texto:
          'Turno con apertura, cobros en efectivo y otros medios por separado, conteo al cierre y la diferencia anotada. Cerrar con diferencia se permite: queda registrada para que el dueño o administrador la revise.',
      },
      {
        id: 'inventario',
        titulo: 'Un inventario que se explica.',
        texto:
          'La existencia sale de sumar y restar los movimientos de cada producto. Si anulas una venta, VSD Stock registra la anulación y su efecto en el inventario y la caja, sin borrar la venta.',
      },
      {
        id: 'estante',
        titulo: 'El estante manda.',
        texto:
          'Si el sistema dice que no hay y en el estante sí, vendes: el producto aparece con una advertencia y la venta queda marcada para ajustar. Hoy lees códigos con tu lector USB o Bluetooth, o buscas por nombre.',
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
     * Lo que muestra cada tarjeta debajo de su titulo. Son datos, no frases: la pagina los pinta con el dominio (formatPesos,
     * describeDifference, formatSignedQuantity), asi no dice un numero distinto del que calcula el producto.
     */
    miniaturas: {
      sinConexion: { pendientes: 1 },
      iva: { precio: 'Precio', base: 'Valor sin IVA', iva: 'IVA' },
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
    ejemplo: ejemploDeApertura,
    titulo: 'Pruébalo con un precio.',
    texto:
      'Escribe un precio con el IVA incluido y mira cómo VSD Stock separa el valor sin IVA y el IVA.',
    campo: 'Precio con IVA incluido',
    ayuda: 'Escribe solo números, sin puntos ni comas.',
    tarifa: 'Tarifa de IVA',
    ejemplos: 'O prueba con un ejemplo',
    suma: 'Valor sin IVA más IVA',
  },

  demo: {
    etiqueta: 'LA PRUEBA',
    titulo: 'Corta la red. Sigue vendiendo.',
    // Las pestañas de la banda (C4-L6): una demo por pestaña, las mismas que están más arriba en la página.
    pestanas: { etiqueta: 'Elige una demostración', vender: 'Vender', iva: 'IVA', caja: 'Caja' },
    // Lo que se lee, sin verse, mientras baja el código de una pestaña que todavía no se había abierto.
    cargando: 'Cargando la demostración…',
    vender: {
      titulo: 'Mira qué pasa con una venta sin red.',
      texto:
        'Simula una caída de internet con el interruptor. La venta se guarda en el equipo y aumenta el número de ventas pendientes de enviar; cuando vuelve la red, se envían una tras otra.',
    },
    cifras: [
      {
        valor: '5 de 5',
        texto: 'ejemplos de IVA que una revisión contable externa comprobó, y coinciden',
      },
      {
        valor: '6 cajas',
        texto: 'simuladas vendiendo sin red en pruebas automáticas: la caja cuadró',
      },
      { valor: '3 roles', texto: 'dueño, administrador y cajero' },
    ],
    boton: { texto: 'Abrir la prueba con ventas de ejemplo', href: DEMO_DE_PRE } as Enlace,
    nota: 'Datos ficticios. La primera carga puede tardar unos 25 segundos.',
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
      'Separa el IVA que ya está incluido en el precio',
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
        titulo: 'Código publicado para revisión',
        texto: 'El código está publicado para que especialistas puedan revisarlo.',
        enlaces: [
          { texto: 'Código de la parte que guarda los datos', href: REPOSITORIO_BACKEND },
          { texto: 'Código de la aplicación', href: REPOSITORIO_FRONTEND },
        ] as readonly Enlace[],
      },
      {
        titulo: 'Decisiones escritas',
        texto:
          'Cada decisión técnica importante está escrita, con las alternativas que descartamos y lo que cuesta.',
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
          'Una revisión contable externa comprobó nuestros ejemplos y coinciden. Antes de usarlo con ventas reales lo validamos con quien lleva las declaraciones de tu tienda.',
        enlaces: [
          {
            texto: 'Leer la revisión',
            href: adr('0032-un-contador-reviso-la-mecanica-del-iva.md'),
          },
        ] as readonly Enlace[],
      },
    ],
    sellosTitulo: 'Información técnica, para especialistas',
    sellos: [
      {
        texto: 'Decisión 0014',
        detalle: 'Dinero, impuestos y redondeo',
        href: adr('0014-dinero-impuestos-y-redondeo.md'),
      },
      {
        texto: 'Decisión 0017',
        detalle: 'Roles, permisos y modo sin conexión',
        href: adr('0017-roles-permisos-y-modo-sin-conexion.md'),
      },
      {
        texto: 'Decisión 0032',
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
      { estado: 'PENDIENTE', texto: 'Un número propio para cada anulación.' },
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
        pregunta: '¿Dos cajas pueden vender a la vez sin red?',
        respuesta:
          'Sí. Cada equipo tiene su propio código y numera sus comprobantes, así que los números no se repiten. En pruebas automáticas simulamos seis.',
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
    titulo: 'Prueba VSD Stock en tu mostrador.',
    subtitulo: 'Buscamos las primeras tiendas para probarlo. Te acompañamos desde el primer turno.',
    boton: { texto: 'Quiero probarlo en mi tienda', href: WHATSAPP_URL } as Enlace,
    avisoBoton: 'Se abre WhatsApp',
    enlaceDemo: { texto: 'O prueba con ventas de ejemplo', href: DEMO_DE_PRE } as Enlace,
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
        titulo: 'Información técnica',
        enlaces: [
          { texto: 'Código de la parte que guarda los datos', href: REPOSITORIO_BACKEND },
          { texto: 'Código de la aplicación', href: REPOSITORIO_FRONTEND },
          {
            texto: 'Decisiones técnicas escritas',
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
    verificando: 'Revisando si la prueba está lista… Usa datos ficticios.',
    despierta: 'Prueba con ventas de ejemplo disponible · datos ficticios',
    dormida: 'Prueba en reposo; la primera carga puede tardar ~25 s · datos ficticios',
  },
};

// Lo que falta resolver antes de publicar en la direccion publica vive en `pendientes.ts` (una hoja sin imports que el script de
// publicacion puede leer en Node); se reexporta aqui para que la pagina y las pruebas lo sigan leyendo de `contenido`.
export { PENDIENTES_DE_PUBLICAR, puedePublicar } from './pendientes';
export type { Pendiente } from './pendientes';
