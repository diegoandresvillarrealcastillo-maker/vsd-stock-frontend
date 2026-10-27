import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installIntersectionObserver } from '../../../test/support/intersection-observer';
import { contenido } from '../contenido';
import { Pruebalo } from './Pruebalo';

// La banda «Pruébalo» (C4-L6, rediseñada en LND-2) vista desde fuera: las tres pestanas y que cada una abra la demostracion de su sitio.
// Ya no lleva el enlace a la web con datos ficticios ni el chip de su estado: la gente pide su acceso, no entra a una prueba. Cada
// demostracion se prueba aparte (`DiagramaVenta`, `CalculadoraIva`, `ArqueoDeEjemplo`); aqui se vigila que la banda las junte bien y
// que las de IVA y Caja no se descarguen hasta que alguien las pide.

const hoisted = vi.hoisted(() => {
  /** Retiene la descarga de la calculadora hasta que la prueba la deje pasar. */
  let abrirPuerta = (): void => undefined;
  const puerta = new Promise<void>((resolver) => {
    abrirPuerta = resolver;
  });
  return { puerta, abrirPuerta };
});

vi.mock('./CalculadoraIva', async (importOriginal) => {
  await hoisted.puerta;
  return importOriginal<typeof import('./CalculadoraIva')>();
});

const { pruebalo, calculadora, arqueo, diagrama } = contenido;

let quitarObservador: () => void;

beforeEach(() => {
  quitarObservador = installIntersectionObserver();
});

afterEach(() => {
  quitarObservador();
});

const pestana = (nombre: string): HTMLElement => screen.getByRole('tab', { name: nombre });
const elegir = (nombre: string): void => {
  fireEvent.click(pestana(nombre));
};
const campoDeIva = (): HTMLElement | null => screen.queryByLabelText(calculadora.campo);
const campoDeCaja = (): HTMLElement | null => screen.queryByLabelText(arqueo.campo);

// Las pruebas que esperan a que baje una calculadora o el arqueo (importacion perezosa) esperaban el segundo por defecto de `findBy`, y con la
// suite completa y la maquina cargada la descarga se pasaba (issue #82). Ahora esperan hasta 10 s y la prueba tiene mas margen que la espera.
const ESPERA_DE_LA_DESCARGA_MS = 10_000;
const LIMITE_DE_LA_PRUEBA_MS = 20_000;

// Esta prueba va primera a proposito: la descarga de la calculadora se hace una sola vez por archivo de pruebas, y la puerta solo
// sirve para verla mientras todavia no ha bajado. Si otra prueba la pidiera antes, esta fallaria en voz alta.
describe('la banda de la demo: lo que se descarga y cuando', () => {
  it(
    'muestra un esqueleto mientras baja la calculadora, y la calculadora cuando llega',
    async () => {
      render(<Pruebalo />);

      elegir('IVA');

      expect(screen.getByText(pruebalo.cargando)).toBeTruthy();
      expect(campoDeIva()).toBeNull();

      hoisted.abrirPuerta();
      expect(
        await screen.findByLabelText(calculadora.campo, undefined, {
          timeout: ESPERA_DE_LA_DESCARGA_MS,
        }),
      ).toBeTruthy();
      expect(screen.queryByText(pruebalo.cargando)).toBeNull();
    },
    LIMITE_DE_LA_PRUEBA_MS,
  );

  it('no descarga ni arma la demo de IVA ni la de Caja hasta que alguien las elige', () => {
    render(<Pruebalo />);

    expect(campoDeIva()).toBeNull();
    expect(campoDeCaja()).toBeNull();
    expect(screen.queryByText(pruebalo.cargando)).toBeNull();
  });
});

describe('la banda de la demo: las pestanas', () => {
  it('es la seccion de la demo, con su titulo, y tiene las pestanas Vender, IVA y Caja en ese orden', () => {
    render(<Pruebalo />);

    expect(screen.getByRole('region', { name: pruebalo.titulo })).toBeTruthy();
    const lista = screen.getByRole('tablist', { name: pruebalo.pestanas.etiqueta });
    expect(
      within(lista)
        .getAllByRole('tab')
        .map((p) => p.textContent),
    ).toEqual([pruebalo.pestanas.vender, pruebalo.pestanas.iva, pruebalo.pestanas.caja]);
  });

  it('lleva la clase de las bandas oscuras: sin ella el foco se pierde sobre el azul', () => {
    render(<Pruebalo />);

    expect(screen.getByRole('region', { name: pruebalo.titulo }).classList.contains('banda')).toBe(
      true,
    );
  });

  it('da a cada pestana y a cada panel un id propio que dice cual es', () => {
    render(<Pruebalo />);

    const claves = ['vender', 'iva', 'caja'];
    const ids = ['Vender', 'IVA', 'Caja'].map((nombre) => pestana(nombre).id);
    expect(ids).toEqual(claves.map((clave) => `pruebalo-pestana-${clave}`));
    expect(
      ['Vender', 'IVA', 'Caja'].map((nombre) => pestana(nombre).getAttribute('aria-controls')),
    ).toEqual(claves.map((clave) => `pruebalo-panel-${clave}`));
  });

  it('abre en Vender con el diagrama vivo: el interruptor «Simular una caída de internet» esta ahi', () => {
    render(<Pruebalo />);

    expect(pestana('Vender').getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel', { name: 'Vender' });
    expect(within(panel).getByRole('switch', { name: diagrama.interruptor })).toBeTruthy();
    expect(within(panel).getByRole('img', { name: diagrama.titulo })).toBeTruthy();
    expect(within(panel).getByText(pruebalo.vender.texto)).toBeTruthy();
  });

  it(
    'en IVA abre la calculadora con el ejemplo de la tarjeta: 11.900 al 19 % es base 10.000 e IVA 1.900',
    async () => {
      hoisted.abrirPuerta();
      render(<Pruebalo />);

      elegir('IVA');

      const campo = await screen.findByLabelText<HTMLInputElement>(calculadora.campo, undefined, {
        timeout: ESPERA_DE_LA_DESCARGA_MS,
      });
      expect(campo.value).toBe('11900');
      const panel = screen.getByRole('tabpanel', { name: 'IVA' });
      expect(within(panel).getByText('$ 10.000', { selector: 'dd' })).toBeTruthy();
      expect(within(panel).getByText('$ 1.900', { selector: 'dd' })).toBeTruthy();
    },
    LIMITE_DE_LA_PRUEBA_MS,
  );

  it(
    'en Caja abre el arqueo con la caja de ejemplo: «Faltan $ 2.000»',
    async () => {
      render(<Pruebalo />);

      elegir('Caja');

      const campo = await screen.findByLabelText<HTMLInputElement>(arqueo.campo, undefined, {
        timeout: ESPERA_DE_LA_DESCARGA_MS,
      });
      expect(campo.value).toBe(String(arqueo.contado));
      const panel = screen.getByRole('tabpanel', { name: 'Caja' });
      expect(within(panel).getByText('Faltan $ 2.000')).toBeTruthy();
      expect(within(panel).getByText('Esperabas $ 170.000 y contaste $ 168.000.')).toBeTruthy();
    },
    LIMITE_DE_LA_PRUEBA_MS,
  );

  it(
    'guarda lo que se escribio en una demo al mirar otra y volver',
    async () => {
      hoisted.abrirPuerta();
      render(<Pruebalo />);
      elegir('Caja');
      const campo = await screen.findByLabelText<HTMLInputElement>(arqueo.campo, undefined, {
        timeout: ESPERA_DE_LA_DESCARGA_MS,
      });
      fireEvent.change(campo, { target: { value: '170000' } });

      elegir('Vender');
      elegir('Caja');

      expect(screen.getByLabelText<HTMLInputElement>(arqueo.campo).value).toBe('170000');
      expect(screen.getByText('La caja cuadra')).toBeTruthy();
    },
    LIMITE_DE_LA_PRUEBA_MS,
  );

  it(
    'no repite ningun id con las tres pestanas abiertas',
    async () => {
      const { container } = render(<Pruebalo />);
      elegir('Caja');
      await screen.findByLabelText(arqueo.campo, undefined, {
        timeout: ESPERA_DE_LA_DESCARGA_MS,
      });
      hoisted.abrirPuerta();
      elegir('IVA');
      await screen.findByLabelText(calculadora.campo, undefined, {
        timeout: ESPERA_DE_LA_DESCARGA_MS,
      });

      const ids = [...container.querySelectorAll('[id]')].map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    },
    LIMITE_DE_LA_PRUEBA_MS,
  );
});
