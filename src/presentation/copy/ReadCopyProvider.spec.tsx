import { act, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { copiedProduct } from '../../../test/support/fake-copy';
import { FakeReadCopy } from '../../../test/support/read-copy';
import { ReadCopyProvider, useReadCopy } from './ReadCopyProvider';

function Probe() {
  const { state, refresh, search, product, stockOf } = useReadCopy();
  return (
    <>
      <p data-testid="productos">{String(state.productCount)}</p>
      <p data-testid="encontrados">
        {search('producto')
          .map((item) => item.name)
          .join(',')}
      </p>
      <p data-testid="limitados">
        {search('producto', { limit: 1 })
          .map((item) => item.name)
          .join(',')}
      </p>
      <p data-testid="uno">{product(copiedProduct(1).id)?.name ?? 'ninguno'}</p>
      <p data-testid="existencia">{String(stockOf(copiedProduct(1).id))}</p>
      <button type="button" onClick={refresh}>
        actualizar
      </button>
    </>
  );
}

const mount = (copy: FakeReadCopy, strict = false) => {
  const tree = (
    <ReadCopyProvider copy={copy}>
      <Probe />
    </ReadCopyProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
};

describe('ReadCopyProvider', () => {
  it('starts the copy when the interface appears and stops it when it goes away', () => {
    const copy = new FakeReadCopy();

    const { unmount } = mount(copy);
    expect(copy.starts).toBe(1);
    expect(copy.stops).toBe(0);

    unmount();
    expect(copy.stops).toBe(1);
  });

  it('can be started twice in a row (the development double mount) and ends up with one watch', () => {
    const copy = new FakeReadCopy();

    mount(copy, true);

    expect(copy.starts - copy.stops).toBe(1);
    expect(copy.subscribers).toBe(1);
  });

  it('shows what the copy says and every change at once', () => {
    const copy = new FakeReadCopy({ productCount: 2 });
    mount(copy);
    expect(screen.getByTestId('productos').textContent).toBe('2');

    act(() => {
      copy.set({ productCount: 3 });
    });

    expect(screen.getByTestId('productos').textContent).toBe('3');
  });

  it('searches, finds a product and gives its stock', () => {
    const copy = new FakeReadCopy({}, [copiedProduct(1), copiedProduct(2)]);
    copy.hold([copiedProduct(1), copiedProduct(2)], { [copiedProduct(1).id]: 4_000 });

    mount(copy);

    expect(screen.getByTestId('encontrados').textContent).toBe('Producto 1,Producto 2');
    expect(screen.getByTestId('limitados').textContent).toBe('Producto 1');
    expect(screen.getByTestId('uno').textContent).toBe('Producto 1');
    expect(screen.getByTestId('existencia').textContent).toBe('4000');
  });

  it('asks the copy to update when the person asks', () => {
    const copy = new FakeReadCopy();
    mount(copy);

    act(() => {
      screen.getByRole('button', { name: 'actualizar' }).click();
    });

    expect(copy.refreshes).toBe(1);
  });

  it('stops listening to the copy when it goes away', () => {
    const copy = new FakeReadCopy();
    const { unmount } = mount(copy);
    expect(copy.subscribers).toBe(1);

    unmount();

    expect(copy.subscribers).toBe(0);
  });

  it('refuses to be used outside the provider, saying where it goes', () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow(
        'useReadCopy debe usarse dentro de <ReadCopyProvider>',
      );
    } finally {
      console.error = quiet;
    }
  });
});
