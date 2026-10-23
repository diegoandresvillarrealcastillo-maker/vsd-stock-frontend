import { fireEvent, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../domain/model/catalog';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeCatalog, testCategory } from '../../../test/support/catalog';
import { renderScreen } from '../../../test/support/screens';
import { ProductForm } from './ProductForm';

const CATEGORIES = [testCategory({ id: 'granos', name: 'Granos' })];

function setup(onCreated: (created: Product) => void) {
  const catalog = createFakeCatalog([], CATEGORIES);
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  renderScreen(<ProductForm categories={CATEGORIES} onCreated={onCreated} />, {
    path: '/catalogo/nuevo',
    auth,
    catalog,
  });
  return catalog;
}

describe('ProductForm, used to create', () => {
  it('tells whoever uses it that the product was created, and then does nothing else', async () => {
    const onCreated = vi.fn<(created: Product) => void>();
    const catalog = setup(onCreated);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Arroz 500 g' } });
    fireEvent.change(screen.getByLabelText('SKU (código interno)'), {
      target: { value: 'ARR-500' },
    });
    fireEvent.change(screen.getByLabelText('Precio de venta (IVA incluido)'), {
      target: { value: '3200' },
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Gravado 19 %' }));

    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onCreated.mock.calls[0]?.[0].name).toBe('Arroz 500 g');
    // Lo que sigue a la creacion no debe tocar ni la pantalla ni el servidor.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(catalog.updateProduct).not.toHaveBeenCalled();
  });
});
