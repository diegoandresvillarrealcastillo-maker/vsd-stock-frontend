import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeIntersectionObserver,
  installIntersectionObserver,
} from '../../../test/support/intersection-observer';
import { setPrefersReducedMotion } from '../../../test/support/match-media';
import { contenido } from '../contenido';
import { LIMITE_EN_COLA, VENTAS_AL_CORTAR } from '../diagrama/maquina';
import { PAUSA_MS, VIAJE_MS } from '../diagrama/ritmo';
import { DiagramaVenta } from './DiagramaVenta';

// El diagrama «Cortar internet» (C4-L4) visto desde fuera: lo que una persona ve y toca, con el reloj en la mano. La logica de las
// ventas ya se prueba aparte (`diagrama/maquina.spec.ts`); aqui se vigila que el dibujo la cuente bien: que el interruptor corte de
// verdad el enlace, que la ficha del telefono cambie, que Ori solo este feliz cuando hay algo en el libro y que se detenga cuando
// nadie lo mira o cuando alguien pidio menos movimiento.

const { diagrama } = contenido;

let quitarObservador: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  quitarObservador = installIntersectionObserver();
});

afterEach(() => {
  vi.useRealTimers();
  quitarObservador();
});

/** Monta el diagrama y avisa que ya se ve en la pantalla (o no, si se pide). */
function montar({ enPantalla = true }: { enPantalla?: boolean } = {}) {
  const vista = render(<DiagramaVenta />);
  const figura = vista.container.querySelector('figure');
  if (enPantalla) entraEnPantalla(true);
  return { ...vista, figura };
}

/** Avisa al observador que de verdad mira la figura; si nadie la mira, falla en vez de avisar al aire. */
function entraEnPantalla(entra: boolean): void {
  const figura = document.querySelector('figure');
  const observador = FakeIntersectionObserver.alive().find(
    (o) => figura !== null && o.targets.has(figura),
  );
  if (observador === undefined) throw new Error('nadie esta mirando la figura del diagrama');
  act(() => {
    observador.emit([[figura, entra]]);
  });
}

/**
 * Pasa el tiempo en trozos chicos, dejando que React reaccione entre uno y otro: cada paso del dibujo programa el siguiente cuando
 * termina el anterior, asi que un solo salto largo se saltaria los pasos de en medio.
 */
function avanzar(ms: number): void {
  for (let falta = ms; falta > 0; falta -= 100) {
    act(() => {
      vi.advanceTimersByTime(Math.min(100, falta));
    });
  }
}

/** Un paso completo del dibujo: lo que espera y lo que tarda en llegar. */
function darPaso(evento: 'vender' | 'enviar'): void {
  avanzar(PAUSA_MS[evento] + VIAJE_MS[evento]);
}

const interruptor = (): HTMLElement => screen.getByRole('switch', { name: diagrama.interruptor });
const ficha = (): HTMLElement => screen.getByRole('status');
const telefono = (): HTMLElement => screen.getByRole('group', { name: diagrama.telefono });
const ori = (): HTMLElement => screen.getByRole('img', { name: /^Ori,/ });
const puesto = (nombre: string): Element => {
  const nodo = document.querySelector(`[data-puesto="${nombre}"]`);
  if (nodo === null) throw new Error(`falta el puesto ${nombre}`);
  return nodo;
};
const enlace = (): string | null =>
  document.querySelector('[data-enlace]')?.getAttribute('data-enlace') ?? null;
const viaje = (): Element | null => document.querySelector('[data-viaje]');

/** Cuantas ventas dice la etiqueta «N por enviar» del puesto de la cola (0 si no se dibuja). */
function porEnviar(): number {
  const etiqueta = new RegExp(`^(\\d+) ${diagrama.porEnviar}$`);
  const texto = within(puesto('cola') as HTMLElement).queryByText(etiqueta)?.textContent ?? '';
  return Number(etiqueta.exec(texto)?.[1] ?? 0);
}

/** Los folios que el libro de movimientos muestra, del mas viejo al mas nuevo. */
const librados = (): string[] =>
  Array.from(puesto('libro').querySelectorAll('[data-folio]')).map((n) => n.textContent ?? '');

describe('the diagram at rest', () => {
  it('shows the four posts of the sale, the switch off and the connection up', () => {
    montar();

    expect(interruptor().getAttribute('aria-checked')).toBe('false');
    expect(ficha().textContent).toBe(diagrama.estados.conectado);
    expect(enlace()).toBe('activo');
    for (const nombre of Object.values(diagrama.nodos)) {
      expect(screen.getByText(nombre)).toBeTruthy();
    }
  });

  it('shows on the phone that the last sale is saved and already sent, and Ori happy: “Todo enviado”', () => {
    montar();

    const pantalla = within(telefono());
    expect(pantalla.getByText('K7-000141')).toBeTruthy();
    expect(pantalla.getByText(diagrama.enviada)).toBeTruthy();
    expect(pantalla.getByText('Todo enviado')).toBeTruthy();
    expect(ori().getAttribute('alt')).toBe('Ori, feliz');
  });

  it('does not move by itself until it is on the screen', () => {
    montar({ enPantalla: false });

    avanzar(60_000);

    expect(viaje()).toBeNull();
    expect(porEnviar()).toBe(0);
    expect(librados()).toEqual(['K7-000140', 'K7-000141']);
  });

  it('starts moving as soon as it is on the screen: it sells and the queue goes down by itself', () => {
    montar({ enPantalla: false });
    avanzar(60_000);

    entraEnPantalla(true);
    darPaso('vender');

    expect(porEnviar()).toBe(1);
    darPaso('enviar');
    expect(porEnviar()).toBe(0);
    expect(librados().at(-1)).toBe('K7-000142');
  });
});

describe('cutting the internet', () => {
  it('cuts at once: the switch says so, the phone says “Sin conexión”, the link breaks and Ori falls asleep', () => {
    montar();

    fireEvent.click(interruptor());

    expect(interruptor().getAttribute('aria-checked')).toBe('true');
    expect(ficha().textContent).toBe(diagrama.estados.sinConexion);
    expect(enlace()).toBe('cortado');
    expect(ori().getAttribute('alt')).toBe('Ori, durmiendo');
  });

  it('brings everything back when pressed again: the connection, the link and the switch', () => {
    montar();

    fireEvent.click(interruptor());
    fireEvent.click(interruptor());

    expect(interruptor().getAttribute('aria-checked')).toBe('false');
    expect(ficha().textContent).toBe(diagrama.estados.conectado);
    expect(enlace()).toBe('activo');
  });

  it('keeps selling at the counter: the queue grows one sale at a time and the phone says what the product says', () => {
    montar();
    fireEvent.click(interruptor());

    darPaso('vender');

    expect(porEnviar()).toBe(1);
    const pantalla = within(telefono());
    expect(pantalla.getByText('Sin conexión')).toBeTruthy();
    expect(
      pantalla.getByText('1 registro por enviar. Está guardado solo en este equipo.'),
    ).toBeTruthy();
    expect(pantalla.getByText('K7-000142')).toBeTruthy();
    expect(pantalla.getByText(diagrama.guardada)).toBeTruthy();

    darPaso('vender');

    expect(porEnviar()).toBe(2);
    expect(
      pantalla.getByText('2 registros por enviar. Están guardados solo en este equipo.'),
    ).toBeTruthy();
  });

  it('stops selling when the queue is full, and the book stays as it was: nothing reaches the server without a connection', () => {
    montar();
    fireEvent.click(interruptor());

    for (let i = 0; i < LIMITE_EN_COLA + 3; i++) darPaso('vender');

    expect(porEnviar()).toBe(LIMITE_EN_COLA);
    expect(librados()).toEqual(['K7-000140', 'K7-000141']);
    expect(viaje()).toBeNull();
  });

  it('draws the sale that travels with its folio, and it is gone when it arrives', () => {
    montar();
    fireEvent.click(interruptor());

    avanzar(PAUSA_MS.vender + 1);
    const enCamino = viaje();
    expect(enCamino?.getAttribute('data-viaje')).toBe('vender');
    expect(enCamino?.textContent).toContain('K7-000142');

    avanzar(VIAJE_MS.vender);
    expect(viaje()).toBeNull();
  });

  it('calls off the sale that is travelling when the switch is pressed, so nothing is left floating or counted twice', () => {
    montar();

    avanzar(PAUSA_MS.vender + 1);
    expect(viaje()?.getAttribute('data-viaje')).toBe('vender');

    fireEvent.click(interruptor());

    expect(viaje()).toBeNull();
    expect(porEnviar()).toBe(0);
  });

  it('does not let a sale that was called off arrive late: the queue only grows with the sales that really travel', () => {
    montar();
    avanzar(PAUSA_MS.vender + 1);
    expect(viaje()?.getAttribute('data-viaje')).toBe('vender');

    fireEvent.click(interruptor());
    avanzar(VIAJE_MS.vender);

    expect(porEnviar()).toBe(0);
    expect(viaje()).toBeNull();
  });
});

describe('bringing the internet back', () => {
  /** Corta y deja la cola llena. */
  function conLaColaLlena(): void {
    montar();
    fireEvent.click(interruptor());
    for (let i = 0; i < LIMITE_EN_COLA; i++) darPaso('vender');
  }

  it('empties the queue one sale after another and the book receives them oldest first', () => {
    conLaColaLlena();
    fireEvent.click(interruptor());

    const cuenta: number[] = [];
    const ultimos: (string | undefined)[] = [];
    for (let i = 0; i < LIMITE_EN_COLA; i++) {
      darPaso('enviar');
      cuenta.push(porEnviar());
      ultimos.push(librados().at(-1));
    }

    expect(cuenta).toEqual([5, 4, 3, 2, 1, 0]);
    expect(ultimos).toEqual([
      'K7-000142',
      'K7-000143',
      'K7-000144',
      'K7-000145',
      'K7-000146',
      'K7-000147',
    ]);
  });

  it('draws each sale going down the link and into the book while it is sent', () => {
    conLaColaLlena();
    fireEvent.click(interruptor());

    avanzar(PAUSA_MS.enviar + 1);

    expect(viaje()?.getAttribute('data-viaje')).toBe('enviar');
    expect(viaje()?.textContent).toContain('K7-000142');
  });

  it('wakes Ori up happy when everything arrived: with something in the book to celebrate', () => {
    conLaColaLlena();
    fireEvent.click(interruptor());

    for (let i = 0; i < LIMITE_EN_COLA; i++) darPaso('enviar');

    expect(ori().getAttribute('alt')).toBe('Ori, feliz');
    expect(within(telefono()).getByText('Todo enviado')).toBeTruthy();
    expect(within(telefono()).getByText(diagrama.enviada)).toBeTruthy();
  });

  it('keeps Ori calm, not happy, while the queue is still going out', () => {
    conLaColaLlena();
    fireEvent.click(interruptor());

    darPaso('enviar');

    expect(ori().getAttribute('alt')).toBe('Ori, con gesto tranquilo');
    expect(within(telefono()).getByText('Enviando…')).toBeTruthy();
  });
});

describe('when nobody is looking', () => {
  it('stops when the diagram leaves the screen, and goes on from where it was when it comes back', () => {
    montar();
    fireEvent.click(interruptor());
    darPaso('vender');
    expect(porEnviar()).toBe(1);

    entraEnPantalla(false);
    avanzar(60_000);
    expect(porEnviar()).toBe(1);
    expect(viaje()).toBeNull();

    entraEnPantalla(true);
    darPaso('vender');
    expect(porEnviar()).toBe(2);
  });

  it('ignores a notice from the screen watcher that says nothing, and keeps going', () => {
    montar();

    act(() => {
      FakeIntersectionObserver.alive()[0]?.emit([]);
    });
    darPaso('vender');

    expect(porEnviar()).toBe(1);
    darPaso('enviar');
    expect(porEnviar()).toBe(0);
    expect(librados().at(-1)).toBe('K7-000142');
  });

  it('works as if it were on the screen in a browser that cannot tell, so it is never left dead', () => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    render(<DiagramaVenta />);

    fireEvent.click(interruptor());
    darPaso('vender');

    expect(porEnviar()).toBe(1);
  });

  it('leaves no timer behind when it leaves the page', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = montar();
    fireEvent.click(interruptor());
    avanzar(PAUSA_MS.vender + 1);

    unmount();
    avanzar(60_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('stops watching the screen and the system preference when it leaves the page', () => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    const escucha = vi.spyOn(consulta, 'addEventListener');
    const deja = vi.spyOn(consulta, 'removeEventListener');
    const { unmount } = montar();

    expect(FakeIntersectionObserver.alive()).toHaveLength(1);
    expect(escucha).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();

    expect(FakeIntersectionObserver.alive()).toEqual([]);
    expect(deja).toHaveBeenCalledWith('change', escucha.mock.calls[0]?.[1]);
    escucha.mockRestore();
    deja.mockRestore();
  });
});

describe('for who asked for less motion', () => {
  beforeEach(() => {
    setPrefersReducedMotion(true);
  });

  it('nothing moves by itself and no sale is drawn travelling', () => {
    montar();

    avanzar(60_000);

    expect(viaje()).toBeNull();
    expect(porEnviar()).toBe(0);
    expect(librados()).toEqual(['K7-000140', 'K7-000141']);
  });

  it('cutting the internet shows the result at once: several sales waiting, with no wait and no animation', () => {
    montar();

    fireEvent.click(interruptor());

    expect(ficha().textContent).toBe(diagrama.estados.sinConexion);
    expect(enlace()).toBe('cortado');
    expect(porEnviar()).toBeGreaterThanOrEqual(2);
    expect(porEnviar()).toBeLessThanOrEqual(LIMITE_EN_COLA);
    expect(viaje()).toBeNull();
    expect(ori().getAttribute('alt')).toBe('Ori, durmiendo');
  });

  it('bringing it back sends everything at once, in order, and leaves Ori happy', () => {
    montar();
    fireEvent.click(interruptor());
    const guardadas = porEnviar();

    fireEvent.click(interruptor());

    expect(porEnviar()).toBe(0);
    expect(enlace()).toBe('activo');
    expect(librados().at(-1)).toBe(`K7-${String(141 + guardadas).padStart(6, '0')}`);
    expect(ori().getAttribute('alt')).toBe('Ori, feliz');
  });

  it('stops what was moving when the person asks for less motion in the middle of it', () => {
    setPrefersReducedMotion(false);
    montar();
    fireEvent.click(interruptor());
    darPaso('vender');
    expect(porEnviar()).toBe(1);

    act(() => {
      setPrefersReducedMotion(true);
    });
    avanzar(60_000);

    expect(porEnviar()).toBe(1);
    expect(viaje()).toBeNull();
  });

  it('shows the result at once if the person asks for less motion in the middle of it and then presses the switch', () => {
    setPrefersReducedMotion(false);
    montar();

    act(() => {
      setPrefersReducedMotion(true);
    });
    fireEvent.click(interruptor());

    expect(porEnviar()).toBe(VENTAS_AL_CORTAR);
    expect(viaje()).toBeNull();

    fireEvent.click(interruptor());

    expect(porEnviar()).toBe(0);
    expect(librados().at(-1)).toBe(`K7-${String(141 + VENTAS_AL_CORTAR).padStart(6, '0')}`);
  });
});

describe('the ids of the drawing, when it is on the page more than once', () => {
  const ids = (raiz: ParentNode): string[] => [...raiz.querySelectorAll('[id]')].map((e) => e.id);
  const referencias = (raiz: ParentNode): string[] =>
    [...raiz.querySelectorAll('svg')].flatMap((svg) => [
      svg.getAttribute('aria-labelledby') ?? '',
      svg.getAttribute('aria-describedby') ?? '',
      ...[...svg.querySelectorAll('[marker-end]')].map(
        (e) => /url\(#(.+)\)/.exec(e.getAttribute('marker-end') ?? '')?.[1] ?? '',
      ),
    ]);

  it('starts the ids of its parts with “diagrama” when nobody says otherwise', () => {
    const { container } = render(<DiagramaVenta />);

    expect(ids(container).sort()).toEqual([
      'diagrama-descripcion',
      'diagrama-flecha',
      'diagrama-flecha-acento',
      'diagrama-titulo',
    ]);
  });

  it('starts the ids with the one it is given, and points at them from the drawing', () => {
    const { container } = render(<DiagramaVenta id="demo-diagrama" />);

    expect(ids(container).sort()).toEqual([
      'demo-diagrama-descripcion',
      'demo-diagrama-flecha',
      'demo-diagrama-flecha-acento',
      'demo-diagrama-titulo',
    ]);
    const existentes = new Set(ids(container));
    for (const referencia of referencias(container)) expect(existentes.has(referencia)).toBe(true);
    expect(referencias(container)).toContain('demo-diagrama-titulo');
    expect(referencias(container)).toContain('demo-diagrama-flecha');
  });

  it('can be twice on the page without repeating an id: each drawing points at its own parts', () => {
    render(
      <>
        <DiagramaVenta />
        <DiagramaVenta id="demo-diagrama" />
      </>,
    );

    const todos = ids(document.body);
    expect(new Set(todos).size).toBe(todos.length);
    const [primero, segundo] = [...document.querySelectorAll('svg')];
    expect(primero?.getAttribute('aria-labelledby')).toBe('diagrama-titulo');
    expect(segundo?.getAttribute('aria-labelledby')).toBe('demo-diagrama-titulo');
    expect(screen.getAllByRole('img', { name: diagrama.titulo })).toHaveLength(2);
  });
});

describe('the card of the diagram inside the dark band of the demo', () => {
  it('paints its own text along with its own background: otherwise it inherits the white of the band and cannot be read in the light theme', () => {
    const { container } = render(<DiagramaVenta />);

    const figura = container.querySelector('figure');
    expect(figura?.className).toMatch(/\bbg-surface-raised\b/);
    expect(figura?.className).toMatch(/\btext-fg\b/);
  });
});
