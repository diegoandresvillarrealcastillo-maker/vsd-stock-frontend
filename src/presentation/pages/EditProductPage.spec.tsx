import { fireEvent, screen } from '@testing-library/react';
import { Link, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Product } from '../../domain/model/catalog';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeCatalog, testCategory, testProduct } from '../../../test/support/catalog';
import { renderScreen } from '../../../test/support/screens';
import { EditProductPage } from './EditProductPage';

const ARROZ = testProduct({
  id: 'arroz',
  name: 'Arroz 500 g',
  sku: 'ARR-500',
  barcode: '7701234567897',
  unit: 'unit',
  unitPrice: 3200,
  taxRateBp: 500,
  categoryId: 'granos',
  minStockMilli: 10_000,
});
const CATEGORIES = [
  testCategory({ id: 'granos', name: 'Granos' }),
  testCategory({ id: 'aseo', name: 'Aseo y cocina' }),
];

function setup(catalog = createFakeCatalog([ARROZ], CATEGORIES), path = '/catalogo/arroz') {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(
    <Routes>
      <Route path="/catalogo/:productId" element={<EditProductPage />} />
    </Routes>,
    { path, auth, catalog },
  );
  return { ...view, catalog };
}

const problem = (code: string): Problem => ({
  type: `urn:vsd-stock:problem:${code}`,
  title: 't',
  status: 409,
  detail: 'texto del servidor',
  instance: '/v1/products/arroz',
  code,
  traceId: 't-1',
});
const refused = (code: string, status = 409) =>
  new ApiError({
    class: status === 404 ? 'permanent' : 'conflict',
    status,
    problem: { ...problem(code), status },
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

const value = (label: string) => screen.getByLabelText<HTMLInputElement>(label).value;
const type = (label: string, text: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: text } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));

describe('EditProductPage', () => {
  it('asks for the product by the id in the address, and says it is loading', async () => {
    const { catalog } = setup(undefined, '/catalogo/a%2Fb');

    expect(screen.getByRole('status').textContent).toContain('Cargando el producto');
    await screen.findByRole('heading', { level: 1 });
    expect(catalog.getProduct).toHaveBeenCalledWith('a/b');
  });

  it('shows the product in the form, with its name and its SKU as the title', async () => {
    setup();

    expect(await screen.findByRole('heading', { level: 1, name: 'Arroz 500 g' })).toBeDefined();
    expect(value('Nombre')).toBe('Arroz 500 g');
    expect(value('SKU (código interno)')).toBe('ARR-500');
    expect(value('Código de barras (opcional)')).toBe('7701234567897');
    expect(value('Unidad')).toBe('unit');
    expect(value('Precio de venta (IVA incluido)')).toBe('3200');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: '5 %' }).checked).toBe(true);
    expect(value('Categoría')).toBe('granos');
    expect(value('Existencia mínima (opcional)')).toBe('10');
    expect(screen.getByText('ARR-500')).toBeDefined();
  });

  it('shows a product without barcode, category or minimum as empty fields', async () => {
    setup(
      createFakeCatalog(
        [testProduct({ id: 'arroz', barcode: null, categoryId: null, minStockMilli: null })],
        CATEGORIES,
      ),
    );
    await screen.findByRole('heading', { level: 1 });

    expect(value('Código de barras (opcional)')).toBe('');
    expect(value('Categoría')).toBe('');
    expect(value('Existencia mínima (opcional)')).toBe('');
  });

  it('writes a big minimum without the dots of the thousands, so it can be read back', async () => {
    setup(
      createFakeCatalog(
        [testProduct({ id: 'arroz', unit: 'kilogram', minStockMilli: 12_345_678 })],
        CATEGORIES,
      ),
    );
    await screen.findByRole('heading', { level: 1 });

    expect(value('Existencia mínima (opcional)')).toBe('12345,678');
  });

  it('marks an archived product as archived', async () => {
    setup(createFakeCatalog([testProduct({ id: 'arroz', active: false })], CATEGORIES));

    await screen.findByRole('heading', { level: 1 });

    expect(screen.getAllByText('Archivado').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Reactivar producto' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Archivar producto' })).toBeNull();
  });

  describe('saving', () => {
    it('sends only what changed', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      type('Nombre', '  Arroz Diana 500 g ');
      type('Precio de venta (IVA incluido)', '3500');
      save();

      expect(await screen.findByText('Cambios guardados.')).toBeDefined();
      expect(catalog.updateProduct).toHaveBeenCalledWith('arroz', {
        name: 'Arroz Diana 500 g',
        unitPrice: 3500,
      });
    });

    it('sends every field that changed, and null for what was cleared', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      type('SKU (código interno)', 'ARR-501');
      type('Código de barras (opcional)', '');
      fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'kilogram' } });
      fireEvent.click(screen.getByRole('radio', { name: '19 %' }));
      fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '' } });
      type('Existencia mínima (opcional)', '');
      save();

      await screen.findByText('Cambios guardados.');
      expect(catalog.updateProduct).toHaveBeenCalledWith('arroz', {
        sku: 'ARR-501',
        barcode: null,
        unit: 'kilogram',
        taxRateBp: 1900,
        categoryId: null,
        minStockMilli: null,
      });
    });

    it('sends a new category and a new minimum', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'aseo' } });
      type('Existencia mínima (opcional)', '12');
      save();

      await screen.findByText('Cambios guardados.');
      expect(catalog.updateProduct).toHaveBeenCalledWith('arroz', {
        categoryId: 'aseo',
        minStockMilli: 12_000,
      });
    });

    it('says nothing changed, and sends nothing, when nothing changed', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      save();

      expect(await screen.findByText('No hiciste ningún cambio.')).toBeDefined();
      expect(catalog.updateProduct).not.toHaveBeenCalled();
    });

    it('does not count the spaces around the name as a change', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      type('Nombre', '  Arroz 500 g  ');
      save();

      expect(await screen.findByText('No hiciste ningún cambio.')).toBeDefined();
      expect(catalog.updateProduct).not.toHaveBeenCalled();
    });

    it('follows the new name in the title, and takes the next change from what was saved', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });
      type('Nombre', 'Arroz Diana 500 g');
      save();
      await screen.findByRole('heading', { level: 1, name: 'Arroz Diana 500 g' });

      type('Precio de venta (IVA incluido)', '3600');
      save();

      await screen.findByText('Cambios guardados.');
      expect(catalog.updateProduct).toHaveBeenLastCalledWith('arroz', { unitPrice: 3600 });
    });

    it('does not change the price twice for the same value: the second save sees nothing new', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });
      type('Precio de venta (IVA incluido)', '3500');
      save();
      await screen.findByText('Cambios guardados.');

      save();

      expect(await screen.findByText('No hiciste ningún cambio.')).toBeDefined();
      expect(catalog.updateProduct).toHaveBeenCalledTimes(1);
    });

    it('does not let a fraction in for what is counted in whole units', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      type('Existencia mínima (opcional)', '2,5');
      save();

      expect(screen.getByText('Este producto se cuenta por unidades enteras.')).toBeDefined();
      expect(catalog.updateProduct).not.toHaveBeenCalled();
    });
  });

  describe('when the server refuses', () => {
    it('says the unit can not change once the product has movements', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockRejectedValue(refused('unit-locked'));
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });

      fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'kilogram' } });
      save();

      expect(
        (
          await screen.findAllByText(
            'La unidad no se puede cambiar porque el producto ya tiene movimientos de existencias.',
          )
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.getByLabelText('Unidad').getAttribute('aria-invalid')).toBe('true');
    });

    it('says which product already has the SKU it tried to take', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'otro', name: 'Arroz Diana', sku: 'ARR-900' }),
      );
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });

      type('SKU (código interno)', 'ARR-900');
      save();

      expect(await screen.findByText('ARR-900 es de «Arroz Diana». Usa otro SKU.')).toBeDefined();
      expect(catalog.findProductByCode).toHaveBeenCalledWith('sku', 'ARR-900');
    });

    it('says there is no connection and keeps what was written', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockRejectedValue(network);
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });

      type('Nombre', 'Otro nombre');
      save();

      expect(await screen.findByText('No pudimos guardar el producto')).toBeDefined();
      expect(value('Nombre')).toBe('Otro nombre');
      expect(screen.queryByText('Cambios guardados.')).toBeNull();
    });
  });

  describe('archiving', () => {
    it('archives the product, says what that means and offers to reactivate it', async () => {
      const { catalog } = setup();
      await screen.findByRole('heading', { level: 1 });

      fireEvent.click(screen.getByRole('button', { name: 'Archivar producto' }));

      expect(
        await screen.findByText('Producto archivado. Ya no se vende, pero conserva su historia.'),
      ).toBeDefined();
      expect(catalog.updateProduct).toHaveBeenCalledWith('arroz', { active: false });
      expect(await screen.findByRole('button', { name: 'Reactivar producto' })).toBeDefined();
      expect(screen.getAllByText('Archivado').length).toBeGreaterThan(0);
    });

    it('reactivates an archived product', async () => {
      const { catalog } = setup(
        createFakeCatalog([testProduct({ id: 'arroz', active: false })], CATEGORIES),
      );
      await screen.findByRole('heading', { level: 1 });

      fireEvent.click(screen.getByRole('button', { name: 'Reactivar producto' }));

      expect(await screen.findByText('Producto reactivado. Ya se puede vender.')).toBeDefined();
      expect(catalog.updateProduct).toHaveBeenCalledWith('arroz', { active: true });
      expect(await screen.findByRole('button', { name: 'Archivar producto' })).toBeDefined();
    });

    it('says why it could not archive', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockRejectedValue(network);
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });

      fireEvent.click(screen.getByRole('button', { name: 'Archivar producto' }));

      expect(await screen.findByText('No pudimos guardar el producto')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Archivar producto' })).toBeDefined();
    });
  });

  describe('when it can not load', () => {
    it('says the product does not exist', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.getProduct.mockRejectedValue(refused('product-not-found', 404));
      setup(catalog);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'No encontramos ese producto' }),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Volver al catálogo' }).getAttribute('href')).toBe(
        '/catalogo',
      );
    });

    it('says it could not load the product, and tries again when asked', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.getProduct.mockRejectedValueOnce(network);
      setup(catalog);

      expect(await screen.findByText('No pudimos cargar el producto')).toBeDefined();
      expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Arroz 500 g' })).toBeDefined();
    });

    it('says it could not load when the categories fail', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.listAllCategories.mockRejectedValueOnce(network);
      setup(catalog);

      expect(await screen.findByText('No pudimos cargar el producto')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Arroz 500 g' })).toBeDefined();
    });
  });

  describe('what the form shows after saving: what the server kept, and not what was typed', () => {
    const saved = async (serverVersion: Partial<Product>, edit: () => void) => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockResolvedValue(testProduct({ ...ARROZ, ...serverVersion }));
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });
      edit();
      save();
      await screen.findByText('Cambios guardados.');
    };

    it('the name', async () => {
      await saved({ name: 'ARROZ DIANA 500 G' }, () => type('Nombre', 'Arroz Diana 500 g'));

      expect(value('Nombre')).toBe('ARROZ DIANA 500 G');
    });

    it('the SKU', async () => {
      await saved({ sku: 'ARR-900' }, () => type('SKU (código interno)', 'arr-900'));

      expect(value('SKU (código interno)')).toBe('ARR-900');
    });

    it('the barcode, without the spaces around it', async () => {
      await saved({ barcode: '7701234567898' }, () =>
        type('Código de barras (opcional)', ' 7701234567898 '),
      );

      expect(value('Código de barras (opcional)')).toBe('7701234567898');
    });

    it('the unit', async () => {
      await saved({ unit: 'gram' }, () =>
        fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'kilogram' } }),
      );

      expect(screen.getByLabelText<HTMLSelectElement>('Unidad').value).toBe('gram');
    });

    it('the price, without the zeros to the left', async () => {
      await saved({ unitPrice: 3500 }, () => type('Precio de venta (IVA incluido)', '03500'));

      expect(value('Precio de venta (IVA incluido)')).toBe('3500');
    });

    it('the IVA', async () => {
      await saved({ taxRateBp: 1900 }, () =>
        fireEvent.click(screen.getByRole('radio', { name: '0 %' })),
      );

      expect(screen.getByRole<HTMLInputElement>('radio', { name: '19 %' }).checked).toBe(true);
      expect(screen.getByRole<HTMLInputElement>('radio', { name: '0 %' }).checked).toBe(false);
    });

    it('the category', async () => {
      await saved({ categoryId: 'aseo' }, () =>
        fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '' } }),
      );

      expect(screen.getByLabelText<HTMLSelectElement>('Categoría').value).toBe('aseo');
    });

    it('the minimum, written without the dots of the thousands so it can be read back', async () => {
      await saved({ minStockMilli: 1_500_000 }, () => type('Existencia mínima (opcional)', '1500'));

      expect(value('Existencia mínima (opcional)')).toBe('1500');
    });
  });

  describe('what goes away when the person writes again', () => {
    it('who has the SKU', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'otro', name: 'Arroz Diana', sku: 'ARR-900' }),
      );
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });
      type('SKU (código interno)', 'ARR-900');
      save();
      await screen.findByText('ARR-900 es de «Arroz Diana». Usa otro SKU.');

      type('SKU (código interno)', 'ARR-901');

      expect(screen.queryByText('ARR-900 es de «Arroz Diana». Usa otro SKU.')).toBeNull();
    });

    it('the notice that the changes were saved', async () => {
      setup();
      await screen.findByRole('heading', { level: 1 });
      type('Precio de venta (IVA incluido)', '3500');
      save();
      await screen.findByText('Cambios guardados.');

      type('Precio de venta (IVA incluido)', '3600');

      expect(screen.queryByText('Cambios guardados.')).toBeNull();
    });

    it('what the server said when it could not save', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.updateProduct.mockRejectedValue(network);
      setup(catalog);
      await screen.findByRole('heading', { level: 1 });
      type('Nombre', 'Otro nombre');
      save();
      await screen.findByText('No pudimos guardar el producto');

      type('Nombre', 'Otro nombre más');

      expect(screen.queryByText('No pudimos guardar el producto')).toBeNull();
    });
  });

  describe('when the address changes to another product', () => {
    it('asks for that product, titles the page with it and starts its form from what it has', async () => {
      const aceite = testProduct({
        id: 'aceite',
        name: 'Aceite 1 L',
        sku: 'ACE-1L',
        unitPrice: 12_500,
        categoryId: null,
      });
      const catalog = createFakeCatalog([ARROZ, aceite], CATEGORIES);
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testMe('ana', 'owner'));
      renderScreen(
        <>
          <Link to="/catalogo/aceite">ir al aceite</Link>
          <Routes>
            <Route path="/catalogo/:productId" element={<EditProductPage />} />
          </Routes>
        </>,
        { path: '/catalogo/arroz', auth, catalog },
      );
      await screen.findByRole('heading', { level: 1, name: 'Arroz 500 g' });
      type('Nombre', 'Arroz Diana 500 g');
      save();
      await screen.findByRole('heading', { level: 1, name: 'Arroz Diana 500 g' });

      fireEvent.click(screen.getByRole('link', { name: 'ir al aceite' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Aceite 1 L' })).toBeDefined();
      expect(catalog.getProduct).toHaveBeenLastCalledWith('aceite');
      expect(value('Nombre')).toBe('Aceite 1 L');
      expect(value('SKU (código interno)')).toBe('ACE-1L');
    });
  });
});
