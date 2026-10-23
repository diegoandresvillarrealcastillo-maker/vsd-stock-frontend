import { describe, expect, it } from 'vitest';
import type { Folio } from '../../../src/domain/model/folio';
import { YA_CORRESPONDEN } from '../../../src/presentation/assets/mascotas/mascotas';
import {
  LIMITE_EN_COLA,
  VENTAS_AL_CORTAR,
  cortarInternet,
  estadoInicial,
  hayQueMover,
  reducir,
  resumenDeEnvio,
  rostroDeOri,
  siguientePaso,
  ultimaVenta,
  vaciarCola,
  volverLaRed,
  type EstadoDeLaVenta,
  type EventoDeLaVenta,
} from './maquina';

// La logica del diagrama «Cortar internet» (C4-L4) sin una sola linea de animacion: que pasa con una venta cuando hay red, cuando
// no la hay y cuando vuelve. Es la regla del producto (ADR 0009: la venta se guarda en el equipo y se envia al volver la red,
// una tras otra y la mas vieja primero), dibujada. Los folios son los del dominio y los textos de «Sin conexion» o «por enviar»
// los escribe `summarizeSync`, el mismo codigo que los dice en la aplicacion.

const texto = (folios: readonly Folio[]): string[] => folios.map((folio) => folio.toString());

const inicial = (): EstadoDeLaVenta => estadoInicial('K7-000142');

/** Aplica el mismo evento varias veces. */
function repetir(estado: EstadoDeLaVenta, evento: EventoDeLaVenta, veces: number): EstadoDeLaVenta {
  let actual = estado;
  for (let i = 0; i < veces; i++) actual = reducir(actual, evento);
  return actual;
}

/**
 * Lo que haria el dibujo solo: pide el siguiente evento y lo aplica, hasta que ya no haya nada que hacer o se acaben los pasos.
 * El tope es de la prueba y no del codigo: si la maquina no se detuviera, la prueba falla en vez de quedarse colgada.
 */
function marchar(estado: EstadoDeLaVenta, pasos: number) {
  const eventos: EventoDeLaVenta[] = [];
  let actual = estado;
  for (let i = 0; i < pasos; i++) {
    const paso = siguientePaso(actual);
    if (paso === null) return { estado: actual, eventos, termino: true };
    eventos.push(paso.evento);
    actual = reducir(actual, paso.evento);
  }
  return { estado: actual, eventos, termino: false };
}

describe('the start of the drawing', () => {
  it('starts with the connection up, nothing waiting and two sales already in the book, so the first thing seen is a store that works', () => {
    const estado = inicial();

    expect(estado.conectado).toBe(true);
    expect(texto(estado.cola)).toEqual([]);
    expect(texto(estado.libro)).toEqual(['K7-000140', 'K7-000141']);
    expect(estado.siguiente.toString()).toBe('K7-000142');
  });

  it('only starts from a folio written the way the product writes it (ADR 0016)', () => {
    expect(() => estadoInicial('hola')).toThrow(RangeError);
    expect(() => estadoInicial('K7-1')).toThrow(RangeError);
  });
});

describe('selling at the counter', () => {
  it('saves every sale in the device first, even with a connection: it goes to the queue and never straight to the book', () => {
    const estado = reducir(inicial(), 'vender');

    expect(texto(estado.cola)).toEqual(['K7-000142']);
    expect(texto(estado.libro)).toEqual(['K7-000140', 'K7-000141']);
  });

  it('gives each sale the next folio, without repeating or skipping one', () => {
    const estado = repetir(inicial(), 'vender', 3);

    expect(texto(estado.cola)).toEqual(['K7-000142', 'K7-000143', 'K7-000144']);
    expect(estado.siguiente.toString()).toBe('K7-000145');
  });

  it('sells the same with the connection cut: that is the whole point of the product', () => {
    const estado = reducir(reducir(inicial(), 'cortar'), 'vender');

    expect(estado.conectado).toBe(false);
    expect(texto(estado.cola)).toEqual(['K7-000142']);
  });

  it('does not change the state it receives: every step makes a new one', () => {
    const antes = inicial();
    reducir(antes, 'vender');

    expect(texto(antes.cola)).toEqual([]);
    expect(antes.siguiente.toString()).toBe('K7-000142');
  });
});

describe('sending to the server', () => {
  it('sends the oldest sale first: the queue leaves in the order it was made', () => {
    const estado = reducir(repetir(inicial(), 'vender', 3), 'enviar');

    expect(texto(estado.cola)).toEqual(['K7-000143', 'K7-000144']);
    expect(texto(estado.libro)).toEqual(['K7-000140', 'K7-000141', 'K7-000142']);
  });

  it('sends one sale at a time, never the whole queue at once', () => {
    const estado = repetir(inicial(), 'vender', 3);

    expect(reducir(estado, 'enviar').cola).toHaveLength(2);
    expect(reducir(reducir(estado, 'enviar'), 'enviar').cola).toHaveLength(1);
  });

  it('sends nothing without a connection and keeps the queue as it was', () => {
    const cortado = reducir(repetir(inicial(), 'vender', 2), 'cortar');

    expect(reducir(cortado, 'enviar')).toEqual(cortado);
  });

  it('sends nothing when nothing is waiting', () => {
    expect(reducir(inicial(), 'enviar')).toEqual(inicial());
  });
});

describe('the connection', () => {
  it('cutting it and bringing it back changes only the connection, and no sale in the queue is lost', () => {
    const conVentas = repetir(inicial(), 'vender', 2);
    const cortado = reducir(conVentas, 'cortar');
    const vuelto = reducir(cortado, 'volver');

    expect(cortado).toEqual({ ...conVentas, conectado: false });
    expect(vuelto).toEqual(conVentas);
  });

  it.each([
    { conectado: true, enCola: 0, hayQueMover: false },
    { conectado: true, enCola: 2, hayQueMover: true },
    { conectado: false, enCola: 2, hayQueMover: false },
    { conectado: false, enCola: 0, hayQueMover: false },
  ])(
    'says there is something to move only with a connection and a sale waiting ($conectado, $enCola waiting)',
    ({ conectado, enCola, hayQueMover: esperado }) => {
      const base = repetir(inicial(), 'vender', enCola);
      const estado = conectado ? base : reducir(base, 'cortar');

      expect(hayQueMover(estado)).toBe(esperado);
    },
  );
});

describe('when the connection comes back', () => {
  it('empties the queue one sale after another, oldest first, and the book receives them in that same order', () => {
    let estado = reducir(repetir(reducir(inicial(), 'cortar'), 'vender', 3), 'volver');
    const enCola: number[] = [];

    // Con tope: si `hayQueMover` fuera siempre verdadero, la prueba falla en vez de colgarse.
    for (let i = 0; i < 10 && hayQueMover(estado); i++) {
      estado = reducir(estado, 'enviar');
      enCola.push(estado.cola.length);
    }

    expect(enCola).toEqual([2, 1, 0]);
    expect(texto(estado.libro)).toEqual([
      'K7-000140',
      'K7-000141',
      'K7-000142',
      'K7-000143',
      'K7-000144',
    ]);
  });

  it('empties it in one call too, and stops by itself however many are waiting', () => {
    const muchas = repetir(inicial(), 'vender', 50);

    const vaciada = vaciarCola(muchas);

    expect(vaciada.cola).toHaveLength(0);
    expect(vaciada.libro).toHaveLength(52);
    expect(vaciada.libro.at(-1)?.toString()).toBe('K7-000191');
  });

  it('does not empty anything while the connection is cut', () => {
    const cortado = reducir(repetir(inicial(), 'vender', 2), 'cortar');

    expect(vaciarCola(cortado)).toEqual(cortado);
  });
});

describe('the pace of the drawing: what happens next', () => {
  it.each([
    {
      que: 'with a connection and nothing waiting, sells',
      conectado: true,
      enCola: 0,
      sigue: 'vender',
    },
    {
      que: 'with a connection and something waiting, sends before selling more',
      conectado: true,
      enCola: 1,
      sigue: 'enviar',
    },
    {
      que: 'without a connection and room in the queue, sells',
      conectado: false,
      enCola: 0,
      sigue: 'vender',
    },
    {
      que: 'without a connection and one place left, still sells',
      conectado: false,
      enCola: LIMITE_EN_COLA - 1,
      sigue: 'vender',
    },
    {
      que: 'without a connection and the queue full, waits',
      conectado: false,
      enCola: LIMITE_EN_COLA,
      sigue: null,
    },
  ] as const)('$que', ({ conectado, enCola, sigue }) => {
    const base = repetir(inicial(), 'vender', enCola);
    const estado = conectado ? base : reducir(base, 'cortar');

    expect(siguientePaso(estado)?.evento ?? null).toBe(sigue);
  });

  it('carries, when it sells, the folio the new sale will have', () => {
    expect(siguientePaso(inicial())?.folio.toString()).toBe('K7-000142');
    expect(
      siguientePaso(reducir(repetir(inicial(), 'vender', 2), 'cortar'))?.folio.toString(),
    ).toBe('K7-000144');
  });

  it('carries, when it sends, the folio of the OLDEST sale in the queue and not the newest', () => {
    const paso = siguientePaso(repetir(inicial(), 'vender', 3));

    expect(paso?.evento).toBe('enviar');
    expect(paso?.folio.toString()).toBe('K7-000142');
  });

  it('with a connection it goes on forever, one sale out for every sale in', () => {
    const { eventos, termino } = marchar(inicial(), 6);

    expect(termino).toBe(false);
    expect(eventos).toEqual(['vender', 'enviar', 'vender', 'enviar', 'vender', 'enviar']);
  });

  it('without a connection it sells until the queue is full and then stops, with the book as it was', () => {
    const { estado, eventos, termino } = marchar(reducir(inicial(), 'cortar'), 50);

    expect(termino).toBe(true);
    expect(eventos).toEqual(Array<EventoDeLaVenta>(LIMITE_EN_COLA).fill('vender'));
    expect(estado.cola).toHaveLength(LIMITE_EN_COLA);
    expect(texto(estado.libro)).toEqual(['K7-000140', 'K7-000141']);
  });

  it('when the connection comes back it sends everything that piled up before it sells one more', () => {
    const lleno = marchar(reducir(inicial(), 'cortar'), 50).estado;

    const { eventos } = marchar(reducir(lleno, 'volver'), LIMITE_EN_COLA + 1);

    expect(eventos).toEqual([...Array<EventoDeLaVenta>(LIMITE_EN_COLA).fill('enviar'), 'vender']);
  });
});

describe('the face of Ori, the one who syncs', () => {
  it.each([
    {
      que: 'sleeps without a connection, with sales waiting',
      conectado: false,
      enCola: 3,
      libro: 2,
      cara: 'dormida',
    },
    {
      que: 'sleeps without a connection even if nothing is waiting',
      conectado: false,
      enCola: 0,
      libro: 2,
      cara: 'dormida',
    },
    {
      que: 'is happy when everything already reached the server (“Todo enviado”)',
      conectado: true,
      enCola: 0,
      libro: 2,
      cara: 'feliz',
    },
    {
      que: 'is not happy while there is nothing in the book: with nothing sent there is nothing to celebrate',
      conectado: true,
      enCola: 0,
      libro: 0,
      cara: 'normal',
    },
    {
      que: 'is calm while she carries sales to the server',
      conectado: true,
      enCola: 2,
      libro: 2,
      cara: 'normal',
    },
  ] as const)('$que', ({ conectado, enCola, libro, cara }) => {
    const base = {
      ...repetir(inicial(), 'vender', enCola),
      libro: inicial().libro.slice(0, libro),
    };
    const estado = conectado ? base : reducir(base, 'cortar');

    expect(rostroDeOri(estado)).toBe(cara);
  });

  it('only ever shows a face that the product already does (docs/mascotas.md)', () => {
    for (const conectado of [true, false]) {
      for (const enCola of [0, 1, 4]) {
        for (const libro of [0, 1, 2]) {
          const base = {
            ...repetir(inicial(), 'vender', enCola),
            libro: inicial().libro.slice(0, libro),
          };
          const estado = conectado ? base : reducir(base, 'cortar');

          expect(
            YA_CORRESPONDEN.ori,
            `${String(conectado)} ${String(enCola)} ${String(libro)}`,
          ).toContain(rostroDeOri(estado));
        }
      }
    }
  });
});

describe('what the phone says about the sending: the words of the product', () => {
  it('says “Sin conexión” and that the sales are kept only in this device, in the plural', () => {
    const estado = reducir(repetir(inicial(), 'vender', 3), 'cortar');

    expect(resumenDeEnvio(estado)).toEqual({
      titular: 'Sin conexión',
      detalle: '3 registros por enviar. Están guardados solo en este equipo.',
    });
  });

  it('says the same in the singular when only one is waiting', () => {
    const estado = reducir(reducir(inicial(), 'vender'), 'cortar');

    expect(resumenDeEnvio(estado)).toEqual({
      titular: 'Sin conexión',
      detalle: '1 registro por enviar. Está guardado solo en este equipo.',
    });
  });

  it('says “Enviando…” while the queue goes out with a connection', () => {
    expect(resumenDeEnvio(repetir(inicial(), 'vender', 2))).toEqual({
      titular: 'Enviando…',
      detalle: '2 registros por enviar.',
    });
  });

  it('says “Todo enviado” when the queue is empty and the book has sales, with no date: the server and the browser would write it differently', () => {
    expect(resumenDeEnvio(inicial())).toEqual({ titular: 'Todo enviado', detalle: null });
  });

  it('says “Nada por enviar” when nothing was ever sold', () => {
    expect(resumenDeEnvio({ ...inicial(), libro: [] })).toEqual({
      titular: 'Nada por enviar',
      detalle: null,
    });
  });
});

describe('the last sale, the one the phone shows', () => {
  it('is the newest one made, and it is already sent when it reached the book', () => {
    const venta = ultimaVenta(inicial());

    expect(venta?.folio.toString()).toBe('K7-000141');
    expect(venta?.enviada).toBe(true);
  });

  it('is the one just made while it waits in the queue, even with a connection: it is saved in the device first', () => {
    const venta = ultimaVenta(reducir(inicial(), 'vender'));

    expect(venta?.folio.toString()).toBe('K7-000142');
    expect(venta?.enviada).toBe(false);
  });

  it('stays the newest while an older one leaves: sending the oldest does not make the newest "sent"', () => {
    const venta = ultimaVenta(reducir(repetir(inicial(), 'vender', 2), 'enviar'));

    expect(venta?.folio.toString()).toBe('K7-000143');
    expect(venta?.enviada).toBe(false);
  });

  it('is the newest one in the book when the book has many, not the second one', () => {
    const venta = ultimaVenta(repetir(repetir(inicial(), 'vender', 2), 'enviar', 2));

    expect(texto(repetir(repetir(inicial(), 'vender', 2), 'enviar', 2).libro)).toHaveLength(4);
    expect(venta?.folio.toString()).toBe('K7-000143');
    expect(venta?.enviada).toBe(true);
  });

  it('does not exist before anything was sold', () => {
    expect(ultimaVenta({ ...inicial(), libro: [] })).toBeNull();
  });
});

describe('without animation (for who asked for less motion)', () => {
  it('cutting the internet leaves it cut with several sales waiting, so “por enviar” is seen without waiting for anything', () => {
    const estado = cortarInternet(inicial());
    const folios = texto(estado.cola);

    expect(estado.conectado).toBe(false);
    expect(folios).toHaveLength(VENTAS_AL_CORTAR);
    expect(folios.length).toBeGreaterThanOrEqual(2);
    expect(folios.length).toBeLessThanOrEqual(LIMITE_EN_COLA);
    expect(folios[0]).toBe('K7-000142');
    expect(texto(estado.libro)).toEqual(['K7-000140', 'K7-000141']);
  });

  it('cutting what is already cut changes nothing', () => {
    const cortado = cortarInternet(inicial());

    expect(cortarInternet(cortado)).toEqual(cortado);
  });

  it('bringing the network back leaves everything sent, in order, with nothing waiting', () => {
    const cortado = cortarInternet(inicial());

    const vuelto = volverLaRed(cortado);

    expect(vuelto.conectado).toBe(true);
    expect(vuelto.cola).toHaveLength(0);
    expect(texto(vuelto.libro)).toEqual([...texto(inicial().libro), ...texto(cortado.cola)]);
  });

  it('bringing back what was never cut changes nothing, not even a sale that is waiting in the queue', () => {
    const conVentas = repetir(inicial(), 'vender', 2);

    expect(volverLaRed(inicial())).toEqual(inicial());
    expect(volverLaRed(conVentas)).toEqual(conVentas);
  });
});
