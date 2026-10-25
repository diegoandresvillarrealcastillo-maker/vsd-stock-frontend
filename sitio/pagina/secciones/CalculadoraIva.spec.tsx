import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PESOS } from '../../../src/domain/model/money';
import { parsePesos } from '../../../src/domain/model/quantity';
import { TAX_RATES_BP } from '../../../src/domain/model/tax';
import { taxLabel } from '../../../src/domain/model/catalog';
import { contenido } from '../contenido';
import { CalculadoraIva } from './CalculadoraIva';

// La calculadora de IVA (C4-L5) vista desde fuera: lo que una persona escribe, toca y lee. La cuenta se prueba aparte
// (`demos/iva.spec.ts`); aqui se vigila que el dibujo la cuente bien: que el campo solo acepte numeros como el de la aplicacion,
// que los ejemplos pongan precio y tarifa, que base mas IVA se vea sumar el precio y que ninguna cifra de dinero cuente en regresiva.

const { calculadora, ejemplosIva, funciones } = contenido;
const { iva: rotulos } = funciones.miniaturas;

const ARRANQUE = { total: 11_900, tarifaBp: 1_900 } as const;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const montar = (): ReturnType<typeof render> =>
  render(<CalculadoraIva id="prueba" ejemplo={ARRANQUE} />);
const campo = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(calculadora.campo);
const tarifa = (bp: number): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>('radio', { name: taxLabel(bp) });
const escribir = (texto: string): void => {
  fireEvent.change(campo(), { target: { value: texto } });
};
const ejemplo = (indice: number): HTMLElement => {
  const e = ejemplosIva[indice];
  if (e === undefined) throw new Error(`no hay ejemplo ${String(indice)}`);
  return screen.getByRole('button', {
    name: new RegExp(`^\\$ ${puntos(e.total)} · ${taxLabel(e.tarifaBp)}$`),
  });
};

/** 11900 -> «11.900», como el dominio escribe los pesos: el punto separa los miles, tambien en los de cuatro cifras. */
const puntos = (n: number): string => String(n).replaceAll(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Lo que dice la fila de la lista (Precio, Base, IVA): la celda que sigue a su nombre. */
const fila = (nombre: string | RegExp): string =>
  screen.getByText(nombre).nextElementSibling?.textContent ?? '';
const soloDigitos = (texto: string): number => Number(texto.replaceAll(/\D/g, ''));

describe('the VAT calculator at rest', () => {
  it('introduces itself with its own title and sentence', () => {
    montar();

    expect(screen.getByRole('heading', { name: calculadora.titulo })).toBeTruthy();
    expect(screen.getByText(calculadora.texto)).toBeTruthy();
  });

  it('opens with the example it was given: 11.900 at 19 %, with the base and the VAT taken out', () => {
    montar();

    expect(campo().value).toBe('11900');
    expect(tarifa(1900).checked).toBe(true);
    expect(fila(rotulos.precio)).toBe('$ 11.900');
    expect(fila(rotulos.base)).toBe('$ 10.000');
    expect(fila(`${rotulos.iva} 19 %`)).toBe('$ 1.900');
  });

  it('shows that base plus VAT gives the price: the sum is written out, from the two parts', () => {
    montar();

    expect(screen.getByText(calculadora.suma)).toBeTruthy();
    expect(screen.getByText('$ 10.000 + $ 1.900 = $ 11.900')).toBeTruthy();
  });

  it('offers the three rates of the product, and the 19 % one is chosen', () => {
    montar();

    expect(screen.getAllByRole('radio').map((r) => r.parentElement?.textContent)).toEqual(
      TAX_RATES_BP.map((bp) => taxLabel(bp)),
    );
    expect(screen.getByRole('group', { name: calculadora.tarifa })).toBeTruthy();
  });

  it('tells what to write: only numbers, without points or commas', () => {
    montar();

    expect(screen.getByText(calculadora.ayuda)).toBeTruthy();
    expect(campo().getAttribute('inputmode')).toBe('numeric');
  });
});

describe('writing a price', () => {
  it('works out the base and the VAT as the person writes, at once', () => {
    montar();

    escribir('10000');

    expect(fila(rotulos.precio)).toBe('$ 10.000');
    expect(fila(rotulos.base)).toBe('$ 8.403');
    expect(fila(`${rotulos.iva} 19 %`)).toBe('$ 1.597');
    expect(screen.getByText('$ 8.403 + $ 1.597 = $ 10.000')).toBeTruthy();
  });

  it('changes the VAT when another rate is chosen, and writes the rate next to «IVA»', () => {
    montar();
    escribir('10000');

    fireEvent.click(tarifa(500));

    expect(tarifa(500).checked).toBe(true);
    expect(tarifa(1900).checked).toBe(false);
    expect(fila(rotulos.base)).toBe('$ 9.524');
    expect(fila(`${rotulos.iva} 5 %`)).toBe('$ 476');
    expect(screen.queryByText(`${rotulos.iva} 19 %`)).toBeNull();
  });

  it('charges nothing at 0 %', () => {
    montar();
    escribir('3500');

    fireEvent.click(tarifa(0));

    expect(fila(rotulos.base)).toBe('$ 3.500');
    expect(fila(`${rotulos.iva} 0 %`)).toBe('$ 0');
  });

  it('takes a zero as a price like any other', () => {
    montar();

    escribir('0');

    expect(fila(rotulos.precio)).toBe('$ 0');
    expect(fila(rotulos.base)).toBe('$ 0');
  });
});

describe('only numbers, like the app', () => {
  it('says what the app says when the price has a point, and does not guess: it shows no result', () => {
    montar();

    escribir('11.900');

    const mensaje = parsePesos('11.900');
    if (mensaje.ok) throw new Error('11.900 no debia leerse');
    expect(screen.getByText(mensaje.message)).toBeTruthy();
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(campo().value).toBe('11.900');
    expect(screen.queryByText(rotulos.base)).toBeNull();
    expect(screen.queryByText(calculadora.suma)).toBeNull();
  });

  it('asks for the price when the field is empty', () => {
    montar();

    escribir('');

    expect(screen.getByText('Escribe el precio.')).toBeTruthy();
    expect(screen.queryByText(rotulos.precio)).toBeNull();
  });

  it('refuses letters and signs', () => {
    montar();

    for (const texto of ['abc', '$ 11900', '-5', '1e3', '11900 pesos']) {
      escribir(texto);
      expect(campo().getAttribute('aria-invalid'), texto).toBe('true');
      expect(screen.queryByText(calculadora.suma), texto).toBeNull();
    }
  });

  it('refuses a price above what the product takes', () => {
    montar();

    escribir(String(MAX_PESOS + 1));

    expect(screen.getByText('Ese precio es demasiado alto.')).toBeTruthy();
  });

  it('goes back to the result as soon as the price reads again, and the help comes back with it', () => {
    montar();
    escribir('11.900');

    escribir('11900');

    expect(campo().getAttribute('aria-invalid')).toBe('false');
    expect(fila(rotulos.base)).toBe('$ 10.000');
    expect(screen.getByText(calculadora.ayuda)).toBeTruthy();
  });

  it('links the field with the help or the message, so the screen reader reads it with the field', () => {
    montar();
    const ayuda = screen.getByText(calculadora.ayuda);
    expect(campo().getAttribute('aria-describedby')).toBe(ayuda.id);

    escribir('11.900');

    const mensaje = screen.getByText(/Escribe solo números, sin puntos, comas ni símbolos/);
    expect(campo().getAttribute('aria-describedby')).toBe(mensaje.id);
  });
});

describe('as a piece of the page', () => {
  it('has the three rates in one group that the browser understands: the same name, so the arrows move between them', () => {
    montar();

    const nombres = screen.getAllByRole<HTMLInputElement>('radio').map((r) => r.name);

    expect(nombres).toHaveLength(TAX_RATES_BP.length);
    expect(new Set(nombres).size).toBe(1);
    expect(nombres[0]).not.toBe('');
  });

  it('does not let the browser underline a price as a misspelled word', () => {
    montar();

    expect(campo().getAttribute('spellcheck')).toBe('false');
  });

  it('draws and answers every touch without a warning from React: no repeated keys, no field that changes kind', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    montar();

    escribir('10000');
    escribir('11.900');
    fireEvent.click(tarifa(500));
    fireEvent.click(ejemplo(2));

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('the examples', () => {
  it('has the five that the accountant recalculated, each with its price and its rate', () => {
    montar();

    expect(screen.getAllByRole('button')).toHaveLength(ejemplosIva.length);
    ejemplosIva.forEach((_, indice) => {
      expect(ejemplo(indice)).toBeTruthy();
    });
  });

  it('puts the price and the rate of the example in the calculator, and shows the base and the VAT that were written down', () => {
    montar();

    ejemplosIva.forEach((e, indice) => {
      fireEvent.click(ejemplo(indice));

      expect(campo().value, `${String(e.total)} al ${String(e.tarifaBp)}`).toBe(String(e.total));
      expect(tarifa(e.tarifaBp).checked).toBe(true);
      expect(fila(rotulos.base)).toBe(`$ ${puntos(e.base)}`);
      expect(fila(`${rotulos.iva} ${String(e.tarifaBp / 100)} %`)).toBe(`$ ${puntos(e.iva)}`);
    });
  });

  it('marks the example that is on the screen, and only that one', () => {
    montar();
    fireEvent.click(ejemplo(3));

    ejemplosIva.forEach((_, indice) => {
      expect(ejemplo(indice).getAttribute('aria-pressed'), String(indice)).toBe(
        indice === 3 ? 'true' : 'false',
      );
    });

    escribir('3501');
    ejemplosIva.forEach((_, indice) => {
      expect(ejemplo(indice).getAttribute('aria-pressed'), String(indice)).toBe('false');
    });
  });

  it('marks the example by its price and its rate: 10.000 exists at 19 % and at 5 %, and only one is on', () => {
    montar();

    fireEvent.click(ejemplo(0));
    expect(ejemplo(0).getAttribute('aria-pressed')).toBe('true');
    expect(ejemplo(2).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(ejemplo(2));
    expect(ejemplo(0).getAttribute('aria-pressed')).toBe('false');
    expect(ejemplo(2).getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the example even if the price was written with spaces around it, because the app reads it the same', () => {
    montar();

    escribir(' 3500 ');
    fireEvent.click(tarifa(500));

    expect(ejemplo(3).getAttribute('aria-pressed')).toBe('true');
  });

  it('fixes the field when the example is chosen after a wrong price', () => {
    montar();
    escribir('11.900');

    fireEvent.click(ejemplo(0));

    expect(campo().getAttribute('aria-invalid')).toBe('false');
    expect(fila(rotulos.base)).toBe('$ 8.403');
  });
});

// Son unos 210 casos (71 precios por cada tarifa) y cada uno escribe en el campo y busca tres filas en el documento: sola tarda ~1,3 s, pero en
// la suite completa y con la maquina cargada pasaba de los 5 s por defecto (issue #82). Se alarga el limite; no se quita ningun precio ni tarifa.
const LIMITE_DE_LA_PRUEBA_DE_PROPIEDADES_MS = 30_000;

describe('base plus VAT is always the price', () => {
  it(
    'adds up, as the page shows it, for any price and any rate',
    () => {
      montar();
      const precios = [
        ...Array.from({ length: 60 }, (_, i) => i),
        99,
        101,
        999,
        1_001,
        3_333,
        9_999,
        12_345,
        100_001,
        7_777_777,
        MAX_PESOS - 1,
        MAX_PESOS,
      ];

      for (const bp of TAX_RATES_BP) {
        fireEvent.click(tarifa(bp));
        for (const precio of precios) {
          escribir(String(precio));
          const base = soloDigitos(fila(rotulos.base));
          const iva = soloDigitos(fila(new RegExp(`^${rotulos.iva} `)));

          expect(base + iva, `${String(precio)} al ${String(bp)}`).toBe(precio);
          expect(soloDigitos(fila(rotulos.precio))).toBe(precio);
          expect(
            screen.getByText(`$ ${puntos(base)} + $ ${puntos(iva)} = $ ${puntos(precio)}`),
          ).toBeTruthy();
        }
      }
    },
    LIMITE_DE_LA_PRUEBA_DE_PROPIEDADES_MS,
  );
});

describe('no countdown on money', () => {
  it('shows every figure at once: no timer is started and nothing waits to count up or down', () => {
    montar();

    escribir('10000');
    fireEvent.click(tarifa(500));
    fireEvent.click(ejemplo(2));

    expect(vi.getTimerCount()).toBe(0);
    expect(fila(rotulos.base)).toBe('$ 9.524');
  });

  it('writes the figures as text, not as an animation', () => {
    const { container } = montar();

    expect(container.querySelector('[class*="animate"], [style*="animation"]')).toBeNull();
    expect(within(container).getByText('$ 10.000')).toBeTruthy();
  });
});
