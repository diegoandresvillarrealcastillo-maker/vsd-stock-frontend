// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CLOCK_TOLERANCE_MS, COUNTER_RESUME_WINDOW_MS } from '../../src/domain/model/local-profile';

// El recorrido del Ciclo 3 (C3-16) lo hace una persona con un telefono en la mano: si una frase del documento ya no es la que la
// pantalla dice, la persona busca algo que no existe y lo anota como defecto. Estas pruebas vigilan que el documento exista, que el
// README lo enlace, que cada frase de pantalla que cita siga siendo la de la pantalla y que el codigo que se pega en las
// herramientas del navegador (el unico "programa" del documento) compile y de las cifras que dice dar.
const raiz = resolve(import.meta.dirname, '../..');

/** Lee un archivo con los saltos de linea de Unix. */
function leer(ruta: string): string {
  expect(existsSync(resolve(raiz, ruta)), `falta ${ruta}`).toBe(true);
  return readFileSync(resolve(raiz, ruta), 'utf8').replaceAll('\r\n', '\n');
}

/** Un documento como se lee: una frase partida entre dos lineas (Prettier ajusta la prosa) sigue siendo la misma frase. */
function prosa(ruta: string): string {
  return leer(ruta).replaceAll(/\s+/g, ' ');
}

const ruta = 'docs/recorrido-del-ciclo-3.md';
const crudo = leer(ruta);
const documento = prosa(ruta);

/** Una seccion `## titulo` del documento, hasta la siguiente. */
function seccion(titulo: string): string {
  const encontrada = crudo.split(/^## /m).find((parte) => parte.startsWith(`${titulo}\n`));
  expect(encontrada, `falta la seccion «${titulo}»`).toBeDefined();
  return encontrada ?? '';
}

const pantallas = 'src/presentation/pages';

describe('docs/recorrido-del-ciclo-3.md', () => {
  it('is linked from the README, next to the one of Ciclo 2', () => {
    const readme = leer('README.md');

    expect(readme).toContain('(docs/recorrido-del-ciclo-3.md)');
    expect(readme.indexOf('(docs/recorrido-del-ciclo-3.md)')).toBeGreaterThan(
      readme.indexOf('(docs/recorrido-del-ciclo-2.md)'),
    );
  });

  it.each([
    ['Ingresar', `${pantallas}/SignInPage.tsx`],
    ['Ir al mostrador', `${pantallas}/HomePage.tsx`],
    ['Continuar sin conexión', 'src/presentation/local/ResumePanel.tsx'],
    ['Comprobando conexión…', 'src/presentation/components/ConnectionPanel.tsx'],
    ['En línea', 'src/presentation/components/ConnectionPanel.tsx'],
    [
      'Lo guardado en este dispositivo está protegido.',
      'src/presentation/components/ConnectionPanel.tsx',
    ],
    [
      'El navegador podría borrar lo guardado si se queda sin espacio. Envía tus ventas pronto.',
      'src/presentation/components/ConnectionPanel.tsx',
    ],
    [
      'Este navegador no puede proteger lo guardado en el dispositivo.',
      'src/presentation/components/ConnectionPanel.tsx',
    ],
    ['Código del equipo', `${pantallas}/CounterPage.tsx`],
    ['Catálogo en este equipo', `${pantallas}/CounterPage.tsx`],
    ['Registrar', `${pantallas}/CounterPage.tsx`],
    ['Actualizar', 'src/presentation/copy/CopyStatus.tsx'],
    ['Efectivo inicial', 'src/presentation/shift/OpenShiftForm.tsx'],
    ['Abrir turno', 'src/presentation/shift/OpenShiftForm.tsx'],
    ['Este equipo todavía no está registrado', `${pantallas}/ShiftPage.tsx`],
    ['Buscar o leer un código', `${pantallas}/SellPage.tsx`],
    ['Cobrar', 'src/presentation/selling/ChargeBar.tsx'],
    ['Forma de pago', `${pantallas}/PayPage.tsx`],
    ['Efectivo recibido', `${pantallas}/PayPage.tsx`],
    ['Exacto', `${pantallas}/PayPage.tsx`],
    ['Vuelto', `${pantallas}/PayPage.tsx`],
    ['Referencia (opcional)', `${pantallas}/PayPage.tsx`],
    ['Confirmar venta', `${pantallas}/PayPage.tsx`],
    ['Guardada en este equipo. Se envía cuando haya conexión.', `${pantallas}/ReceiptPage.tsx`],
    ['Venta guardada en tu cuenta.', `${pantallas}/ReceiptPage.tsx`],
    ['Nueva venta', `${pantallas}/ReceiptPage.tsx`],
    ['Enviando…', 'src/domain/model/sync-summary.ts'],
    ['Sin conexión', 'src/domain/model/sync-summary.ts'],
    ['Todo enviado', 'src/domain/model/sync-summary.ts'],
    ['Por enviar', `${pantallas}/SalesPage.tsx`],
    ['Mi turno', `${pantallas}/SalesPage.tsx`],
    ['No pudimos cargar las ventas', `${pantallas}/SalesPage.tsx`],
    ['Enviada', 'src/domain/model/sales-history.ts'],
    ['Requiere atención', 'src/domain/model/sales-history.ts'],
    ['Qué pasó', `${pantallas}/SaleDetailPage.tsx`],
    ['Efectivo contado', `${pantallas}/CloseShiftPage.tsx`],
    ['Cerrar turno', `${pantallas}/CloseShiftPage.tsx`],
    ['Faltan', 'src/domain/model/shift.ts'],
    ['Falta confirmar con el servidor', `${pantallas}/ShiftPage.tsx`],
    ['El servidor ya tiene este turno', `${pantallas}/ShiftPage.tsx`],
    ['Cambiar de persona', 'src/presentation/local/SessionControls.tsx'],
    ['Cerrar sesión', 'src/presentation/local/SessionControls.tsx'],
    ['Hay una versión nueva de VSD Stock', 'src/presentation/pwa/UpdateNotice.tsx'],
  ])('quotes «%s» and the screen says it the same', (frase, pantalla) => {
    expect(documento).toContain(frase);
    expect(leer(pantalla)).toContain(frase);
  });

  it('numbers the rows of the walkthrough one after the other, so a lost row does not go unnoticed', () => {
    const filas = [...seccion('Lo que se recorre').matchAll(/^\| (\d+) +\|/gm)].map((fila) =>
      Number(fila[1]),
    );

    expect(filas.length).toBeGreaterThanOrEqual(25);
    expect(filas).toEqual(filas.map((_, indice) => indice + 1));
  });

  it('names the routes of the counter, which are the ones of the router', () => {
    const rutas = leer('src/presentation/routes/AppRoutes.tsx');

    for (const ruta of [
      '/mostrador',
      '/mostrador/turno',
      '/mostrador/ventas',
      '/mostrador/equipo',
    ]) {
      expect(documento).toContain(ruta);
    }
    for (const parte of ['path="equipo"', 'path="turno"', 'path="ventas"', 'path="cobrar"']) {
      expect(rutas).toContain(parte);
    }
  });

  it('says what is measured, with the numbers of the ADRs and the ones the code uses', () => {
    const medidas = seccion('Qué se mide');

    expect(medidas).toContain('100 ms'); // ADR 0008
    expect(medidas).toContain('60'); // cuadros por segundo, ADR 0008
    // Las dos cifras que el codigo usa: si cambian alla, el documento dice otra cosa que lo que hace el mostrador.
    expect(medidas).toContain(`${String(COUNTER_RESUME_WINDOW_MS / 3_600_000)} horas`);
    expect(medidas).toContain(`${String(CLOCK_TOLERANCE_MS / 60_000)} minutos`);
    expect(medidas).toContain('BarcodeDetector');
  });

  it('keeps a table of runs, with the columns to fill in', () => {
    const historial = seccion('Historial de corridas');

    expect(historial).toMatch(/\| Fecha +\| Teléfono +\| Quién +\| Resultado +\|/);
  });

  it('records the run on a real Android, who did it and what did not match, and no longer says none was done', () => {
    const historial = seccion('Historial de corridas');

    expect(historial).toContain('25 de octubre de 2026');
    expect(historial).toContain('Samuel');
    // Lo que no coincidio, con el Issue donde se sigue: sin esto la corrida parece limpia.
    for (const issue of ['#108', '#109', '#110', 'vsd-stock-backend#96']) {
      expect(historial, issue).toContain(issue);
    }
    // El telefono no se anoto: se dice, no se inventa un modelo.
    expect(historial).toContain('no informado');
    expect(historial).not.toContain('todavía no se hizo en un teléfono');
  });

  it('answers every measure of the table with what the run found, or says it was not reported', () => {
    const medidas = seccion('Qué se mide');
    const [tabla = '', resultados] = medidas.split(
      /^### Resultado de la corrida del 25 de octubre de 2026\n/m,
    );
    expect(resultados, 'falta la tabla de resultados de la corrida').toBeDefined();

    const nombres = [...tabla.matchAll(/^\| ([^|\n]+?) +\|/gm)]
      .map((fila) => fila[1] ?? '')
      .filter((nombre) => nombre !== 'Medida' && !/^-+$/.test(nombre));
    expect(nombres.length).toBeGreaterThanOrEqual(9);

    for (const nombre of nombres) {
      expect(resultados, `sin resultado para «${nombre}»`).toMatch(
        new RegExp(`^\\| ${nombre.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')} +\\|`, 'm'),
      );
    }
    // Lo que nadie midio se dice asi y no con una cifra puesta a ojo.
    expect(resultados).toContain('No se anotó');
    expect(resultados).toContain('Sin cifra');
  });

  it('says in the steps to repeat where the results of a run go', () => {
    expect(seccion('Cómo se repite')).toContain('Resultado de la corrida');
  });

  it('says what it does not cover', () => {
    expect(seccion('Lo que este recorrido no cubre')).toContain('contador');
  });
});

/** Un evento del Event Timing: un toque dispara varios (pointerdown, pointerup, click) y todos llevan el mismo `interactionId`. */
interface EntradaDeEvento {
  name: string;
  duration: number;
  interactionId: number;
}

/** Un navegador de mentira lo bastante grande para correr el codigo que el documento manda pegar. */
function montarNavegador(propio: { window?: object; navigator?: object } = {}) {
  const tablas: Record<string, unknown>[] = [];
  const cuadros: ((tiempo: number) => void)[] = [];
  const esperas: (() => void)[] = [];
  let entregar: ((lista: { getEntries: () => EntradaDeEvento[] }) => void) | null = null;
  const ventana: Record<string, unknown> = { ...propio.window };

  class Observador {
    constructor(callback: NonNullable<typeof entregar>) {
      entregar = callback;
    }
    observe = (): undefined => undefined;
  }

  const bloque = /```js\n([\s\S]*?)\n```/.exec(crudo)?.[1];
  expect(bloque, 'el documento no trae un bloque ```js').toBeDefined();

  runInNewContext(bloque ?? '', {
    window: ventana,
    performance: { now: () => 0 },
    PerformanceObserver: Observador,
    requestAnimationFrame: (callback: (tiempo: number) => void) => cuadros.push(callback),
    setTimeout: (callback: () => void) => esperas.push(callback),
    console: { table: (tabla: Record<string, unknown>) => tablas.push(tabla) },
    navigator: propio.navigator ?? {},
  });

  return {
    ventana,
    tablas,
    /** Lo que el navegador le avisa al medidor: los eventos tal cual, cada uno con la interaccion a la que pertenece. */
    avisar: (entradas: EntradaDeEvento[]): void => {
      expect(entregar, 'el codigo no creo un PerformanceObserver').not.toBeNull();
      entregar?.({ getEntries: () => entradas });
    },
    /** Un toque por duracion, cada uno una interaccion distinta. */
    tocar: (...duraciones: number[]): void => {
      expect(entregar, 'el codigo no creo un PerformanceObserver').not.toBeNull();
      entregar?.({
        getEntries: () =>
          duraciones.map((duration, indice) => ({
            name: 'pointerdown',
            duration,
            interactionId: indice + 1,
          })),
      });
    },
    /** Cuadros cuyos intervalos (ms) son los dados; despues vence el tiempo de la medicion. */
    correrCuadros: (intervalos: number[]): void => {
      let ahora = 0;
      for (const intervalo of intervalos) {
        ahora += intervalo;
        cuadros.shift()?.(ahora);
      }
      esperas.shift()?.();
    },
  };
}

describe('the snippet the document tells to paste in the browser tools of the computer', () => {
  it('is valid JavaScript that defines the three commands the document names', () => {
    const { ventana } = montarNavegador();

    for (const orden of ['__ficha', '__toques', '__medir']) {
      expect(typeof ventana[orden], orden).toBe('function');
      expect(documento).toContain(`${orden}(`);
    }
  });

  it('counts the taps that took 16 ms or more and says the worst and how many passed 100 ms', () => {
    const { ventana, tablas, tocar } = montarNavegador();

    tocar(24, 120, 40);
    (ventana['__toques'] as () => void)();

    expect(tablas[0]).toEqual({
      'toques o teclas que tardaron 16 ms o más': 3,
      'el peor (ms)': 120,
      'cuántos pasaron de 100 ms': 1,
    });
  });

  it('counts a tap once, with its slowest event, even though it fires several, and ignores hovers', () => {
    const { ventana, tablas, avisar } = montarNavegador();

    avisar([
      { name: 'pointerdown', duration: 24, interactionId: 7 },
      { name: 'pointerup', duration: 120, interactionId: 7 },
      { name: 'click', duration: 40, interactionId: 7 },
      { name: 'pointerover', duration: 90, interactionId: 0 },
    ]);
    (ventana['__toques'] as () => void)();

    expect(tablas[0]).toEqual({
      'toques o teclas que tardaron 16 ms o más': 1,
      'el peor (ms)': 120,
      'cuántos pasaron de 100 ms': 1,
    });
  });

  it('counts as slow only what passes 100 ms, not what is exactly 100', () => {
    const { ventana, tablas, tocar } = montarNavegador();

    tocar(100, 101);
    (ventana['__toques'] as () => void)();

    expect(tablas[0]).toMatchObject({ 'cuántos pasaron de 100 ms': 1 });
  });

  it('says "< 16" for the worst tap when none was slow, instead of a number that was never measured', () => {
    const { ventana, tablas } = montarNavegador();

    (ventana['__toques'] as () => void)();

    expect(tablas[0]).toEqual({
      'toques o teclas que tardaron 16 ms o más': 0,
      'el peor (ms)': '< 16',
      'cuántos pasaron de 100 ms': 0,
    });
  });

  it('measures frames per second over the seconds asked, and counts the frames over 20 ms', () => {
    const fluido = Array.from({ length: 300 }, () => 16.7);
    const conTiron = [...fluido.slice(0, 299), 50];
    // Un navegador por medicion: el segundo cuadro pedido de la primera quedaria esperando en la cola de la segunda.
    const primera = montarNavegador();
    const segunda = montarNavegador();

    (primera.ventana['__medir'] as (segundos: number) => string)(5);
    primera.correrCuadros(fluido);
    (segunda.ventana['__medir'] as (segundos: number) => string)(5);
    segunda.correrCuadros(conTiron);

    expect(primera.tablas[0]).toEqual({
      'cuadros por segundo': 60,
      'el peor cuadro (ms)': 17,
      'cuadros de más de 20 ms': 0,
    });
    expect(segunda.tablas[0]).toEqual({
      'cuadros por segundo': 60,
      'el peor cuadro (ms)': 50,
      'cuadros de más de 20 ms': 1,
    });
  });

  it('says no frame was painted, instead of a worst frame of -Infinity, when the screen was off', () => {
    const { ventana, tablas, correrCuadros } = montarNavegador();

    (ventana['__medir'] as (segundos: number) => string)(5);
    correrCuadros([]);

    expect(tablas[0]).toMatchObject({ 'cuadros por segundo': 0 });
    expect(String(tablas[0]?.['el peor cuadro (ms)'])).toContain('ningún cuadro');
  });

  it('tells the person to scroll right now, because the frames only count while the list moves', () => {
    const { ventana } = montarNavegador();

    expect(String((ventana['__medir'] as (segundos: number) => string)(5))).toContain('desplaza');
  });

  it('describes the phone: memory, cores, persistent storage, the camera reader and the clock', async () => {
    const { ventana, tablas } = montarNavegador({
      window: { BarcodeDetector: class {} },
      navigator: {
        userAgent: 'Pixel de prueba',
        deviceMemory: 2,
        hardwareConcurrency: 4,
        storage: {
          persisted: () => Promise.resolve(false),
          estimate: () => Promise.resolve({ quota: 5_000_000_000 }),
        },
        serviceWorker: { controller: {} },
      },
    });

    await (ventana['__ficha'] as () => Promise<void>)();

    expect(tablas[0]).toMatchObject({
      navegador: 'Pixel de prueba',
      'memoria (GB, aproximada)': 2,
      núcleos: 4,
      'almacenamiento persistente': false,
      'cuota (MB)': 5000,
      'lector de códigos por cámara (BarcodeDetector)': true,
      'service worker': 'activo',
    });
    expect(String(tablas[0]?.['hora del teléfono'])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not invent what the browser does not say', async () => {
    const { ventana, tablas } = montarNavegador();

    await (ventana['__ficha'] as () => Promise<void>)();

    expect(tablas[0]).toMatchObject({
      'memoria (GB, aproximada)': 'no lo dice',
      'almacenamiento persistente': 'no lo dice',
      'cuota (MB)': 'no lo dice',
      'lector de códigos por cámara (BarcodeDetector)': false,
      'service worker': 'no controla esta página',
    });
  });
});
