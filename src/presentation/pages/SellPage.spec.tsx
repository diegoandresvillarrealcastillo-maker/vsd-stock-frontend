import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../domain/model/catalog';
import { formatTime } from '../../domain/model/moment';
import { createTestSelling, item } from '../../../test/support/fake-selling';
import { FakeShifts } from '../../../test/support/shifts';
import { renderScreen } from '../../../test/support/screens';
import { SellPage } from './SellPage';

const arroz = item(1, {
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  barcode: '7701234567897',
  unitPrice: 3_200,
  taxRateBp: 1_900,
});
const aceite = item(2, { name: 'Aceite 1 L', sku: 'ACE-1L', unitPrice: 12_500, taxRateBp: 1_900 });
const aceiteOliva = item(3, {
  name: 'Aceite de oliva 500 ml',
  sku: 'ACE-OL5',
  unitPrice: 28_900,
  taxRateBp: 1_900,
});
const aceiteCinco = item(4, {
  name: 'Aceite 5 L',
  sku: 'ACE-5L',
  unitPrice: 54_000,
  taxRateBp: 1_900,
});
const queso = item(5, {
  name: 'Queso campesino',
  sku: 'QUE-1',
  unit: 'kilogram',
  unitPrice: 20_000,
  taxRateBp: 0,
});
const pan = item(6, { name: 'Pan tajado', sku: 'PAN-1', unitPrice: 2_800, taxRateBp: 500 });
const viejo = item(7, { name: 'Aceite viejo', sku: 'ACE-OLD', active: false });

const CATALOG: Product[] = [arroz, aceite, aceiteOliva, aceiteCinco, queso, pan, viejo];
const STOCK = {
  [arroz.id]: 20_000,
  [aceite.id]: 12_000,
  [aceiteOliva.id]: 3_000,
  [aceiteCinco.id]: 0,
  [queso.id]: 5_000,
  [pan.id]: 2_000,
};

async function mount(options: { shift?: 'open' | 'none' } = {}) {
  const t = await createTestSelling(options.shift === undefined ? {} : { shift: options.shift });
  t.copy.hold(CATALOG, STOCK);
  const view = renderScreen(<SellPage />, {
    local: t.local,
    shifts: t.shifts,
    selling: t.selling,
    copy: t.copy,
    sync: t.sync,
    path: '/mostrador',
  });
  return { ...view, t };
}

const search = () => screen.getByLabelText('Buscar o leer un código');
const write = (text: string) => {
  fireEvent.change(search(), { target: { value: text } });
};
const enter = () => {
  fireEvent.keyDown(search(), { key: 'Enter' });
};
const cart = () => screen.getByRole('list', { name: 'Venta en curso' });
const results = () => screen.getByRole('list', { name: 'Resultados de la búsqueda' });
const add = (name: string) => {
  fireEvent.click(within(results()).getByRole('button', { name: new RegExp(name) }));
};
const lineOf = (name: string) => within(cart()).getByRole('listitem', { name: name });

describe('SellPage', () => {
  it('shows nothing while nobody is working', () => {
    const { container } = renderScreen(<SellPage />, { path: '/mostrador' });

    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  describe('without a shift', () => {
    it('says a shift is needed, and why, and leads to opening one', async () => {
      await mount({ shift: 'none' });

      expect(await screen.findByRole('heading', { level: 1, name: 'Vender' })).toBeDefined();
      expect(screen.getByText('Abre un turno para vender')).toBeDefined();
      expect(
        screen.getByText(
          'Cada venta queda en un turno de caja: con el efectivo inicial se cuadra la caja al cerrar.',
        ),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Abrir turno' }).getAttribute('href')).toBe(
        '/mostrador/turno',
      );
      expect(screen.queryByLabelText('Buscar o leer un código')).toBeNull();
    });

    it('does not sell with a shift that was closed either', async () => {
      const t = await mount();
      await screen.findByLabelText('Buscar o leer un código');

      await act(async () => {
        await t.t.shifts.close(50_000);
      });

      expect(await screen.findByText('Abre un turno para vender')).toBeDefined();
    });

    it('waits while the shift is being read, and does not say there is none', () => {
      renderScreen(<SellPage />, {
        shifts: new FakeShifts({ status: 'loading' }),
        path: '/mostrador',
      });

      expect(screen.queryByText('Abre un turno para vender')).toBeNull();
    });
  });

  describe('with an open shift', () => {
    it('says since when the shift is open, and asks for what to sell', async () => {
      await mount();

      await screen.findByLabelText('Buscar o leer un código');
      const since = formatTime(new Date('2026-10-19T13:02:00.000Z'));
      expect(screen.getByText(`Turno abierto desde las ${since}`)).toBeDefined();
      expect(screen.getByText('Con el lector, apunta al código y listo.')).toBeDefined();
      expect(search().getAttribute('placeholder')).toBe('Nombre, código o escanéalo');
      expect(screen.getByText('La venta está vacía')).toBeDefined();
      expect(screen.getByText('Busca un producto o lee su código para agregarlo.')).toBeDefined();
    });

    it('says «sin venta» and a total of zero in the bar, and does not charge', async () => {
      await mount();

      const bar = await screen.findByRole('region', { name: 'Cobro' });
      expect(within(bar).getByText('Sin venta')).toBeDefined();
      expect(within(bar).getByText('$ 0')).toBeDefined();
      expect(within(bar).getByRole<HTMLButtonElement>('button', { name: 'Cobrar' }).disabled).toBe(
        true,
      );
    });
  });

  describe('searching', () => {
    it('offers what matches, with its code, what is left and its price, and says how many', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('aceite');

      expect(screen.getByText('3 productos. Toca uno para agregarlo.')).toBeDefined();
      const found = within(results()).getAllByRole('button');
      expect(found.map((button) => button.textContent)).toEqual([
        expect.stringContaining('Aceite 1 L'),
        expect.stringContaining('Aceite 5 L'),
        expect.stringContaining('Aceite de oliva 500 ml'),
      ]);
      expect(found[0]?.textContent).toContain('ACE-1L · quedan 12');
      expect(found[0]?.textContent).toContain('$ 12.500');
      expect(found[2]?.textContent).toContain('quedan 3');
    });

    it('says «agotado» for what has no stock, and still lets it be sold', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('aceite 5');

      const [row] = within(results()).getAllByRole('button');
      expect(row?.textContent).toContain('Agotado');
      fireEvent.click(row!);
      expect(within(cart()).getByText('Aceite 5 L')).toBeDefined();
    });

    it('does not offer what is archived', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('viejo');

      expect(screen.queryByRole('list', { name: 'Resultados de la búsqueda' })).toBeNull();
    });

    it('says nothing was found, and how to look for it', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('zzzz');

      expect(
        screen.getByText('No encontramos ese producto. Prueba con otra palabra o con el código.'),
      ).toBeDefined();
    });

    it('says one product, in the singular', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('queso');

      expect(screen.getByText('1 producto. Tócalo para agregarlo.')).toBeDefined();
    });

    it('shows no list when nothing is written', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('arroz');
      expect(screen.getByRole('list', { name: 'Resultados de la búsqueda' })).toBeDefined();

      write('');

      expect(screen.queryByRole('list', { name: 'Resultados de la búsqueda' })).toBeNull();
    });
  });

  describe('adding to the sale', () => {
    it('puts the product in the sale with one unit, and leaves the search ready for the next', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('arroz');

      add('Arroz 500 g');

      const line = lineOf('Arroz 500 g');
      expect(within(line).getByText('$ 3.200 c/u')).toBeDefined();
      expect(within(line).getByLabelText('Cantidad de Arroz 500 g')).toHaveProperty('value', '1');
      expect(within(line).getByText('$ 3.200')).toBeDefined();
      expect(search()).toHaveProperty('value', '');
      expect(document.activeElement).toBe(search());
      expect(screen.queryByRole('list', { name: 'Resultados de la búsqueda' })).toBeNull();
    });

    it('adds a unit more when the same product is added again, in the same line', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('arroz');
      add('Arroz 500 g');
      write('arroz');
      add('Arroz 500 g');

      expect(within(cart()).getAllByRole('listitem')).toHaveLength(1);
      expect(
        within(lineOf('Arroz 500 g')).getByLabelText('Cantidad de Arroz 500 g'),
      ).toHaveProperty('value', '2');
    });

    it('says how many products there are in the sale, and the total with the tax split', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('arroz');
      add('Arroz 500 g');
      write('aceite 1');
      add('Aceite 1 L');

      expect(screen.getByText('2 productos')).toBeDefined();
      const totals = screen.getByRole('group', { name: 'Totales de la venta' });
      expect(within(totals).getByText('Base sin IVA').nextSibling?.textContent).toBe('$ 13.193');
      expect(within(totals).getByText('IVA 19 % incluido').nextSibling?.textContent).toBe(
        '$ 2.507',
      );
      expect(within(totals).getByText('Total').nextSibling?.textContent).toBe('$ 15.700');
    });

    it('says one product in the singular', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('arroz');
      add('Arroz 500 g');

      expect(screen.getByText('1 producto')).toBeDefined();
    });

    it('splits the tax of each rate on its own, and leaves out the rate that has no tax', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      for (const [text, name] of [
        ['arroz', 'Arroz 500 g'],
        ['pan', 'Pan tajado'],
        ['queso', 'Queso campesino'],
      ] as const) {
        write(text);
        add(name);
      }

      const totals = screen.getByRole('group', { name: 'Totales de la venta' });
      expect(within(totals).getByText('IVA 19 % incluido')).toBeDefined();
      expect(within(totals).getByText('IVA 5 % incluido')).toBeDefined();
      expect(within(totals).queryByText(/IVA 0 %/)).toBeNull();
    });
  });

  describe('with the reader of codes', () => {
    it('adds what the code names when the reader presses enter, and is ready for the next', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('7701234567897');
      enter();

      expect(within(cart()).getByText('Arroz 500 g')).toBeDefined();
      expect(search()).toHaveProperty('value', '');
      expect(document.activeElement).toBe(search());
    });

    it('takes the code of the business too, whatever its capitals', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('ace-1l');
      enter();

      expect(within(cart()).getByText('Aceite 1 L')).toBeDefined();
    });

    it('adds another unit when the same code is read twice', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('ACE-1L');
      enter();
      write('ACE-1L');
      enter();

      expect(within(lineOf('Aceite 1 L')).getByLabelText('Cantidad de Aceite 1 L')).toHaveProperty(
        'value',
        '2',
      );
    });

    it('adds what is the only result when someone writes a name and presses enter', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('campesino');
      enter();

      expect(within(cart()).getByText('Queso campesino')).toBeDefined();
    });

    it('does not guess among several: it keeps the results and says to touch one', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('aceite');
      enter();

      expect(screen.queryByRole('list', { name: 'Venta en curso' })).toBeNull();
      expect(search()).toHaveProperty('value', 'aceite');
      expect(screen.getByText('3 productos. Toca uno para agregarlo.')).toBeDefined();
    });

    it('says when the code is not of any product, and keeps what was read to see it', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      write('9999999999999');
      enter();

      expect(
        screen.getByText('No encontramos ese producto. Prueba con otra palabra o con el código.'),
      ).toBeDefined();
      expect(search()).toHaveProperty('value', '9999999999999');
    });

    it('does nothing when enter is pressed with nothing written, or another key is', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');

      enter();
      write('arroz');
      fireEvent.keyDown(search(), { key: 'a' });

      expect(screen.queryByRole('list', { name: 'Venta en curso' })).toBeNull();
    });
  });

  describe('the line of the sale', () => {
    async function withRice() {
      const view = await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('arroz');
      add('Arroz 500 g');
      return view;
    }

    it('changes the quantity, and the total follows', async () => {
      await withRice();

      fireEvent.change(screen.getByLabelText('Cantidad de Arroz 500 g'), {
        target: { value: '3' },
      });

      expect(within(lineOf('Arroz 500 g')).getByText('$ 9.600')).toBeDefined();
      expect(screen.getByRole('region', { name: 'Cobro' }).textContent).toContain('$ 9.600');
    });

    it('takes decimals with a comma for what is weighed', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('queso');
      add('Queso campesino');

      fireEvent.change(screen.getByLabelText('Cantidad de Queso campesino'), {
        target: { value: '1,25' },
      });

      expect(within(lineOf('Queso campesino')).getByText('$ 25.000')).toBeDefined();
      expect(within(lineOf('Queso campesino')).getByText('kg')).toBeDefined();
    });

    it('says what is wrong with a quantity, and keeps the one that was good', async () => {
      await withRice();
      const input = screen.getByLabelText('Cantidad de Arroz 500 g');

      fireEvent.change(input, { target: { value: '1,5' } });

      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Este producto se cuenta por unidades enteras.')).toBeDefined();
      expect(within(lineOf('Arroz 500 g')).getByText('$ 3.200')).toBeDefined();
    });

    it('asks for a quantity when it is left empty, and puts the real one back on leaving', async () => {
      await withRice();
      const input = screen.getByLabelText('Cantidad de Arroz 500 g');

      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('Escribe la cantidad.')).toBeDefined();
      fireEvent.blur(input);

      expect(input).toHaveProperty('value', '1');
      expect(input.getAttribute('aria-invalid')).toBeNull();
    });

    it('does not take zero, nor more than the system holds', async () => {
      await withRice();
      const input = screen.getByLabelText('Cantidad de Arroz 500 g');

      fireEvent.change(input, { target: { value: '0' } });
      expect(input.getAttribute('aria-invalid')).toBe('true');
      fireEvent.change(input, { target: { value: '9999999999' } });
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('warns when there is not enough, with how much is left, and still lets it be sold', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('pan');
      add('Pan tajado');

      fireEvent.change(screen.getByLabelText('Cantidad de Pan tajado'), { target: { value: '3' } });

      expect(within(lineOf('Pan tajado')).getByText('Quedan 2')).toBeDefined();
      expect(within(lineOf('Pan tajado')).getByText('$ 8.400')).toBeDefined();
    });

    it('warns when there is none', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('aceite 5');
      add('Aceite 5 L');

      expect(within(lineOf('Aceite 5 L')).getByText('Sin existencias')).toBeDefined();
    });

    it('does not warn about a product that has enough', async () => {
      await withRice();

      expect(within(lineOf('Arroz 500 g')).queryByText(/Quedan|Sin existencias/)).toBeNull();
    });

    it('takes a discount in pesos off the line, and says it', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('aceite 1');
      add('Aceite 1 L');

      fireEvent.click(within(lineOf('Aceite 1 L')).getByRole('button', { name: 'Descuento' }));
      fireEvent.change(screen.getByLabelText('Descuento en pesos de Aceite 1 L'), {
        target: { value: '500' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar descuento' }));

      const line = lineOf('Aceite 1 L');
      expect(within(line).getByText('Descuento − $ 500')).toBeDefined();
      expect(within(line).getByText('$ 12.000')).toBeDefined();
      expect(screen.getByRole('region', { name: 'Cobro' }).textContent).toContain('$ 12.000');
    });

    it('says what is wrong with a discount: more than the line is worth, or not pesos', async () => {
      await withRice();
      fireEvent.click(within(lineOf('Arroz 500 g')).getByRole('button', { name: 'Descuento' }));
      const input = screen.getByLabelText('Descuento en pesos de Arroz 500 g');

      fireEvent.change(input, { target: { value: '3201' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar descuento' }));
      expect(
        screen.getByText('El descuento no puede pasar del valor de la línea: $ 3.200.'),
      ).toBeDefined();
      expect(input.getAttribute('aria-invalid')).toBe('true');

      fireEvent.change(input, { target: { value: '5o' } });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar descuento' }));
      expect(screen.getByText('Escribe el descuento en pesos, solo con números.')).toBeDefined();
    });

    it('takes the discount away, with a button or by leaving it empty', async () => {
      await withRice();
      fireEvent.click(within(lineOf('Arroz 500 g')).getByRole('button', { name: 'Descuento' }));
      fireEvent.change(screen.getByLabelText('Descuento en pesos de Arroz 500 g'), {
        target: { value: '200' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar descuento' }));
      expect(within(lineOf('Arroz 500 g')).getByText('Descuento − $ 200')).toBeDefined();

      fireEvent.click(within(lineOf('Arroz 500 g')).getByRole('button', { name: 'Descuento' }));
      fireEvent.click(screen.getByRole('button', { name: 'Quitar descuento' }));

      expect(within(lineOf('Arroz 500 g')).queryByText(/Descuento −/)).toBeNull();
      expect(within(lineOf('Arroz 500 g')).getByText('$ 3.200')).toBeDefined();
    });

    it('takes the line out of the sale', async () => {
      await withRice();

      fireEvent.click(
        within(lineOf('Arroz 500 g')).getByRole('button', { name: 'Quitar Arroz 500 g' }),
      );

      expect(screen.queryByRole('list', { name: 'Venta en curso' })).toBeNull();
      expect(screen.getByText('La venta está vacía')).toBeDefined();
    });

    it('empties the whole sale only after asking, and keeps it if the person changes their mind', async () => {
      await withRice();

      fireEvent.click(screen.getByRole('button', { name: 'Vaciar la venta' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Seguir con la venta' }));
      expect(within(cart()).getByText('Arroz 500 g')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Vaciar la venta' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, vaciar' }));
      await waitFor(() => {
        expect(screen.queryByRole('list', { name: 'Venta en curso' })).toBeNull();
      });
    });
  });

  describe('the bar to charge', () => {
    it('says the total, and leads to charging', async () => {
      await mount();
      await screen.findByLabelText('Buscar o leer un código');
      write('arroz');
      add('Arroz 500 g');
      write('aceite 1');
      add('Aceite 1 L');

      const bar = screen.getByRole('region', { name: 'Cobro' });

      expect(within(bar).getByText('Total')).toBeDefined();
      expect(within(bar).getByText('$ 15.700')).toBeDefined();
      expect(within(bar).getByRole('link', { name: 'Cobrar' }).getAttribute('href')).toBe(
        '/mostrador/cobrar',
      );
    });
  });
});
