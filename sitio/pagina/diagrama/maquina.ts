import { Folio, nextFolio } from '../../../src/domain/model/folio';
import { summarizeSync } from '../../../src/domain/model/sync-summary';
import type { Estado } from '../../../src/presentation/assets/mascotas/mascotas';

// La logica del diagrama «Cortar internet» (C4-L4), sin animacion ni React: que pasa con una venta cuando hay red, cuando no la hay y
// cuando vuelve. Es la regla del producto (ADR 0009) dibujada: la venta se guarda primero en el equipo, se envia cuando hay conexion
// y sale una por una, la mas vieja primero. Los folios son los del dominio y los textos de «Sin conexion» o «por enviar» los escribe
// `summarizeSync`, el mismo codigo que los dice en la aplicacion; asi el dibujo no puede decir otra cosa que el producto.

/** Cuantas ventas se acumulan en la cola sin red antes de que el dibujo deje de vender: mas ya no se lee, y no es una regla del producto. */
export const LIMITE_EN_COLA = 6;

/** Las ventas que el dibujo ya deja guardadas al cortar sin animar: las suficientes para que «por enviar» se vea de un vistazo. */
export const VENTAS_AL_CORTAR = 3;

/** Las ventas que el libro ya tiene al abrir la pagina: una tienda que lleva un rato vendiendo. */
const ANOTADAS_AL_EMPEZAR = 2;

/** La fecha de «la ultima vez que se envio algo». Solo importa que exista: el dibujo nunca escribe la hora (ver `resumenDeEnvio`). */
const ALGUNA_VEZ = new Date(0);

export interface EstadoDeLaVenta {
  readonly conectado: boolean;
  /** El folio de la proxima venta que cobre el mostrador. */
  readonly siguiente: Folio;
  /** Las ventas guardadas en el equipo que todavia no llegan al servidor. La primera es la mas vieja y la primera en salir. */
  readonly cola: readonly Folio[];
  /** Las que el servidor ya anoto en el libro de movimientos, en el orden en que llegaron. */
  readonly libro: readonly Folio[];
}

/**
 * - `vender`: el mostrador cobra una venta; se guarda en la cola del equipo, con o sin conexion.
 * - `enviar`: con conexion, la venta mas vieja de la cola llega al servidor y queda en el libro.
 * - `cortar` y `volver`: el interruptor «Cortar internet».
 */
export type EventoDeLaVenta = 'vender' | 'enviar' | 'cortar' | 'volver';

/** El dibujo al abrir la pagina: con red, nada por enviar y dos ventas ya anotadas. `primerFolio` es el de la proxima venta. */
export function estadoInicial(primerFolio: string): EstadoDeLaVenta {
  const siguiente = Folio.parse(primerFolio);
  const libro = Array.from({ length: ANOTADAS_AL_EMPEZAR }, (_, i) =>
    Folio.of(siguiente.device, siguiente.serial - ANOTADAS_AL_EMPEZAR + i),
  );
  return { conectado: true, siguiente, cola: [], libro };
}

/** Un paso. Devuelve un estado nuevo y no toca el que recibe. */
export function reducir(estado: EstadoDeLaVenta, evento: EventoDeLaVenta): EstadoDeLaVenta {
  switch (evento) {
    case 'vender':
      return {
        ...estado,
        cola: [...estado.cola, estado.siguiente],
        siguiente: nextFolio(estado.siguiente.device, estado.siguiente.serial),
      };
    case 'enviar': {
      const [primera, ...resto] = estado.cola;
      if (!estado.conectado || primera === undefined) return estado;
      return { ...estado, cola: resto, libro: [...estado.libro, primera] };
    }
    case 'cortar':
      return { ...estado, conectado: false };
    case 'volver':
      return { ...estado, conectado: true };
  }
}

/** Hay algo que enviar ahora mismo: hay red y hay una venta esperando. */
export function hayQueMover(estado: EstadoDeLaVenta): boolean {
  return estado.conectado && estado.cola.length > 0;
}

/**
 * Lo que hace el dibujo despues y la venta que protagoniza: con red envia la mas vieja de la cola antes de vender mas, y sin red
 * vende hasta llenar la cola y se queda quieto (`null`). Es solo la decision; cuanto tarda cada paso es de quien lo anima.
 */
export function siguientePaso(
  estado: EstadoDeLaVenta,
): { evento: 'vender' | 'enviar'; folio: Folio } | null {
  const primera = estado.cola[0];
  if (estado.conectado && primera !== undefined) return { evento: 'enviar', folio: primera };
  return estado.cola.length < LIMITE_EN_COLA ? { evento: 'vender', folio: estado.siguiente } : null;
}

/**
 * La cara de Ori, la que sincroniza, y solo una que el producto ya hace (`docs/mascotas.md`): dormida sin conexion, feliz cuando
 * todo llego al servidor («Todo enviado») y tranquila el resto del tiempo. Para estar feliz tiene que haber algo en el libro:
 * sin ninguna venta enviada no hay nada que celebrar.
 */
export function rostroDeOri(estado: EstadoDeLaVenta): Estado {
  if (!estado.conectado) return 'dormida';
  if (estado.cola.length === 0 && estado.libro.length > 0) return 'feliz';
  return 'normal';
}

/**
 * Lo que dice el telefono sobre el envio, con las palabras del producto (`summarizeSync`). El detalle solo se escribe cuando hay algo
 * por enviar: el de «Todo enviado» trae la hora de la ultima vez, que el servidor y el navegador escribirian distinto.
 */
export function resumenDeEnvio(estado: EstadoDeLaVenta): {
  titular: string;
  detalle: string | null;
} {
  const pendientes = estado.cola.length;
  const resumen = summarizeSync(estado.conectado ? 'online' : 'offline', {
    phase: hayQueMover(estado) ? 'sending' : 'idle',
    pending: pendientes,
    attention: 0,
    lastSyncedAt: estado.libro.length > 0 ? ALGUNA_VEZ : null,
    sessionExpired: false,
    nextTryAt: null,
    fault: null,
  });
  return { titular: resumen.headline, detalle: pendientes > 0 ? resumen.detail : null };
}

/**
 * La venta mas reciente, la que muestra el telefono, y si ya llego al servidor. Mientras espera en la cola esta guardada solo en el
 * equipo, aunque haya conexion: asi lo dice el comprobante de la aplicacion. `null` si todavia no se ha vendido nada.
 */
export function ultimaVenta(estado: EstadoDeLaVenta): { folio: Folio; enviada: boolean } | null {
  const enCola = estado.cola.at(-1);
  if (enCola !== undefined) return { folio: enCola, enviada: false };
  const enLibro = estado.libro.at(-1);
  return enLibro === undefined ? null : { folio: enLibro, enviada: true };
}

/** Envia toda la cola de golpe, una venta tras otra. Da como mucho una vuelta por venta: no puede quedarse dando vueltas. */
export function vaciarCola(estado: EstadoDeLaVenta): EstadoDeLaVenta {
  let actual = estado;
  for (let pendientes = estado.cola.length; pendientes > 0; pendientes--) {
    actual = reducir(actual, 'enviar');
  }
  return actual;
}

/** «Cortar internet» sin animar: la red se va y quedan varias ventas guardadas en el equipo. Si ya estaba cortada, no cambia nada. */
export function cortarInternet(estado: EstadoDeLaVenta): EstadoDeLaVenta {
  if (!estado.conectado) return estado;
  let actual = reducir(estado, 'cortar');
  for (let i = 0; i < VENTAS_AL_CORTAR; i++) actual = reducir(actual, 'vender');
  return actual;
}

/** Volver la red sin animar: todo lo guardado llega al servidor, en orden. Si nunca se cortó, no cambia nada. */
export function volverLaRed(estado: EstadoDeLaVenta): EstadoDeLaVenta {
  if (estado.conectado) return estado;
  return vaciarCola(reducir(estado, 'volver'));
}
