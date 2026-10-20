import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { addProduct, EMPTY_CART } from '../../domain/model/sale-cart';
import { item } from '../../../test/support/fake-selling';
import { FakeSelling } from '../../../test/support/selling';
import { SellingProvider, useSelling } from './SellingProvider';

const product = item(1, { name: 'Arroz 500 g', unitPrice: 3_200 });

function Probe() {
  const { state, add, setQuantity, setDiscount, remove, clear, confirm, newSale } = useSelling();
  return (
    <>
      <p data-testid="lineas">{String(state.cart.lines.length)}</p>
      <p data-testid="total">{String(state.summary.total.amount)}</p>
      <button type="button" onClick={() => add(product)}>
        agregar
      </button>
      <button type="button" onClick={() => setQuantity(product.id, 3_000)}>
        cantidad
      </button>
      <button type="button" onClick={() => setDiscount(product.id, 200)}>
        descuento
      </button>
      <button type="button" onClick={() => remove(product.id)}>
        quitar
      </button>
      <button type="button" onClick={clear}>
        vaciar
      </button>
      <button
        type="button"
        onClick={() => void confirm({ method: 'card', reference: null }).catch(() => undefined)}
      >
        cobrar
      </button>
      <button type="button" onClick={newSale}>
        nueva
      </button>
    </>
  );
}

const mount = (selling: FakeSelling, strict = false) => {
  const tree = (
    <SellingProvider selling={selling}>
      <Probe />
    </SellingProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

const press = (name: string) => {
  act(() => {
    screen.getByRole('button', { name }).click();
  });
};

describe('SellingProvider', () => {
  it('starts the point of sale when the interface appears and stops it when it goes away', () => {
    const selling = new FakeSelling();

    const { unmount } = mount(selling);
    expect(selling.starts).toBe(1);
    expect(selling.stops).toBe(0);

    unmount();
    expect(selling.stops).toBe(1);
  });

  it('can be started twice in a row (the development double mount) and ends up with one watch', () => {
    const selling = new FakeSelling();

    mount(selling, true);

    expect(selling.starts - selling.stops).toBe(1);
    expect(selling.subscribers).toBe(1);
  });

  it('shows the sale as it changes, and its total', () => {
    const selling = new FakeSelling();
    mount(selling);
    expect(screen.getByTestId('lineas').textContent).toBe('0');

    act(() => {
      selling.set(addProduct(EMPTY_CART, product), null);
    });

    expect(screen.getByTestId('lineas').textContent).toBe('1');
    expect(screen.getByTestId('total').textContent).toBe('3200');
  });

  it('hands every action to the point of sale, with what it was given', () => {
    const selling = new FakeSelling();
    mount(selling);

    press('agregar');
    press('cantidad');
    press('descuento');
    press('quitar');
    press('vaciar');
    press('cobrar');
    press('nueva');

    expect(selling.added).toEqual([product]);
    expect(selling.quantities).toEqual([[product.id, 3_000]]);
    expect(selling.discounts).toEqual([[product.id, 200]]);
    expect(selling.removed).toEqual([product.id]);
    expect(selling.clears).toBe(1);
    expect(selling.confirmed).toEqual([{ method: 'card', reference: null }]);
    expect(selling.newSales).toBe(1);
  });

  it('keeps the same actions between changes: the lines that did not change are not drawn again', () => {
    const selling = new FakeSelling();
    const seen: unknown[] = [];
    function Spy() {
      const { add, remove } = useSelling();
      seen.push([add, remove]);
      return null;
    }
    render(
      <SellingProvider selling={selling}>
        <Spy />
      </SellingProvider>,
    );

    act(() => {
      selling.set(addProduct(EMPTY_CART, product), null);
    });

    expect(seen.length).toBeGreaterThan(1);
    const [first, ...rest] = seen as [unknown, unknown][];
    for (const next of rest) {
      expect(next[0]).toBe(first?.[0]);
      expect(next[1]).toBe(first?.[1]);
    }
  });

  it('stops listening to the point of sale when it goes away', () => {
    const selling = new FakeSelling();
    const { unmount } = mount(selling);
    expect(selling.subscribers).toBe(1);

    unmount();

    expect(selling.subscribers).toBe(0);
  });

  it('refuses to be used outside the provider, saying where it goes', () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow('useSelling debe usarse dentro de <SellingProvider>');
    } finally {
      console.error = quiet;
    }
  });
});
