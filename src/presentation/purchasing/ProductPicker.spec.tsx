import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/model/catalog';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeCatalog, testProduct } from '../../../test/support/catalog';
import { renderScreen } from '../../../test/support/screens';
import { ProductPicker } from './ProductPicker';

function setup(products: Product[], options: { disabled?: boolean } = {}) {
  const catalog = createFakeCatalog(products, []);
  const onChange = vi.fn<(product: Product | null) => void>();
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  renderScreen(<ProductPicker value={null} onChange={onChange} {...options} />, {
    path: '/compras/nueva',
    auth,
    catalog,
  });
  return { catalog, onChange };
}

const many = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    testProduct({
      id: `p-${String(index)}`,
      name: `Producto ${String(index)}`,
      sku: `SKU-${String(index)}`,
    }),
  );

describe('ProductPicker', () => {
  it('asks only for the active products', async () => {
    const { catalog } = setup(many(2));
    await screen.findByRole('list', { name: 'Productos para elegir' });

    expect(catalog.listProducts).toHaveBeenCalledWith({ active: true });
  });

  it('shows at most eight products, so that the person writes more to narrow the search', async () => {
    setup(many(10));

    const list = await screen.findByRole('list', { name: 'Productos para elegir' });

    expect(within(list).getAllByRole('button')).toHaveLength(8);
    expect(within(list).getByRole('button', { name: /Producto 7/ })).toBeDefined();
    expect(within(list).queryByRole('button', { name: /Producto 8/ })).toBeNull();
  });

  it('says there are no active products when the business has none, and not that a search found nothing', async () => {
    setup([]);

    expect(await screen.findByText('No hay productos activos.')).toBeDefined();
    expect(screen.queryByText(/No encontramos/)).toBeNull();
  });

  it('gives back the product the person chooses', async () => {
    const { onChange } = setup(many(2));

    fireEvent.click(await screen.findByRole('button', { name: /Producto 1/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]?.id).toBe('p-1');
  });

  it('does not let the person search or choose while it is disabled', async () => {
    const { onChange } = setup(many(2), { disabled: true });
    const list = await screen.findByRole('list', { name: 'Productos para elegir' });

    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Producto' }).disabled).toBe(
      true,
    );
    for (const button of within(list).getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.click(within(list).getAllByRole('button')[0]!);
    expect(onChange).not.toHaveBeenCalled();
  });
});
