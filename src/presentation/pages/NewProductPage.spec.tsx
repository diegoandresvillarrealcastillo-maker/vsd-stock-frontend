import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeCatalog, testCategory, testProduct } from '../../../test/support/catalog';
import { renderScreen } from '../../../test/support/screens';
import { NewProductPage } from './NewProductPage';

const CATEGORIES = [
  testCategory({ id: 'granos', name: 'Granos' }),
  testCategory({ id: 'aseo', name: 'Aseo y cocina' }),
];

function setup(catalog = createFakeCatalog([], CATEGORIES)) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(<NewProductPage />, { path: '/catalogo/nuevo', auth, catalog });
  return { ...view, catalog };
}

const problem = (code: string, errors?: Problem['errors']): Problem => ({
  type: `urn:vsd-stock:problem:${code}`,
  title: 't',
  status: 409,
  detail: 'texto del servidor',
  instance: '/v1/products',
  code,
  traceId: 't-1',
  ...(errors === undefined ? {} : { errors }),
});
const refused = (code: string, errors?: Problem['errors']) =>
  new ApiError({
    class: 'conflict',
    status: 409,
    problem: problem(code, errors),
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }));

async function fillBasics() {
  await screen.findByLabelText('Nombre');
  type('Nombre', '  Arroz 500 g ');
  type('SKU (código interno)', 'ARR-500');
  type('Precio de venta (IVA incluido)', '3200');
}

describe('NewProductPage', () => {
  it('shows the form once the categories arrive', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nuevo producto' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver al catálogo' }).getAttribute('href')).toBe(
      '/catalogo',
    );
  });

  it('starts with a unit, 0 % of IVA and no category', async () => {
    setup();
    await screen.findByLabelText('Nombre');

    expect(screen.getByLabelText<HTMLSelectElement>('Unidad').value).toBe('unit');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: '0 %' }).checked).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>('Categoría').value).toBe('');
  });

  it('offers the six units, the three rates and the categories of the business', async () => {
    setup();
    await screen.findByLabelText('Nombre');

    const units = Array.from(screen.getByLabelText<HTMLSelectElement>('Unidad').options);
    expect(units.map((option) => option.text)).toEqual([
      'Unidad (und)',
      'Kilogramo (kg)',
      'Gramo (g)',
      'Libra (lb)',
      'Litro (L)',
      'Mililitro (mL)',
    ]);
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      '0',
      '500',
      '1900',
    ]);
    const categories = Array.from(screen.getByLabelText<HTMLSelectElement>('Categoría').options);
    expect(categories.map((option) => option.text)).toEqual([
      'Sin categoría',
      'Granos',
      'Aseo y cocina',
    ]);
  });

  describe('what it says while the person writes', () => {
    it('shows the price as it will be seen, and the IVA that is inside it', async () => {
      setup();
      await screen.findByLabelText('Nombre');

      type('Precio de venta (IVA incluido)', '3200');
      fireEvent.click(screen.getByRole('radio', { name: '19 %' }));

      expect(screen.getByText('Se verá como $ 3.200.')).toBeDefined();
      expect(screen.getByText('De $ 3.200 con IVA 19 %, el IVA es $ 511.')).toBeDefined();
    });

    it('says there is no IVA inside when the rate is 0 %', async () => {
      setup();
      await screen.findByLabelText('Nombre');

      type('Precio de venta (IVA incluido)', '3200');

      expect(screen.getByText('De $ 3.200 con IVA 0 %, el IVA es $ 0.')).toBeDefined();
    });

    it('asks for numbers only while the price is not valid', async () => {
      setup();
      await screen.findByLabelText('Nombre');

      expect(
        screen.getByText('Solo números, sin puntos ni comas. Por ejemplo: 3200.'),
      ).toBeDefined();
      type('Precio de venta (IVA incluido)', '3.200');

      expect(
        screen.getByText('Solo números, sin puntos ni comas. Por ejemplo: 3200.'),
      ).toBeDefined();
      expect(screen.queryByText(/Se verá como/)).toBeNull();
    });

    it('says when the minimum will warn, in the unit of the product', async () => {
      setup();
      await screen.findByLabelText('Nombre');

      type('Existencia mínima (opcional)', '10');

      expect(screen.getByText('Te avisamos cuando haya menos de 10 und.')).toBeDefined();

      fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'kilogram' } });
      type('Existencia mínima (opcional)', '1,5');

      expect(screen.getByText('Te avisamos cuando haya menos de 1,5 kg.')).toBeDefined();
    });
  });

  describe('saving', () => {
    it('creates the product with what was written, and goes back to the catalog saying it saved it', async () => {
      const { catalog } = setup();
      await fillBasics();
      type('Código de barras (opcional)', ' 7701234567897 ');
      fireEvent.click(screen.getByRole('radio', { name: '5 %' }));
      fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'granos' } });
      type('Existencia mínima (opcional)', '10');

      save();

      await screen.findByText('/catalogo');
      expect(screen.getByTestId('estado').textContent).toContain('Guardamos «Arroz 500 g».');
      expect(catalog.createProduct).toHaveBeenCalledWith({
        name: 'Arroz 500 g',
        sku: 'ARR-500',
        barcode: '7701234567897',
        unit: 'unit',
        unitPrice: 3200,
        taxRateBp: 500,
        categoryId: 'granos',
        minStockMilli: 10_000,
      });
    });

    it('leaves out what was not written: no barcode, no category, no minimum', async () => {
      const { catalog } = setup();
      await fillBasics();

      save();

      await screen.findByText('/catalogo');
      expect(catalog.createProduct).toHaveBeenCalledWith({
        name: 'Arroz 500 g',
        sku: 'ARR-500',
        barcode: null,
        unit: 'unit',
        unitPrice: 3200,
        taxRateBp: 0,
        categoryId: null,
        minStockMilli: null,
      });
    });

    it('sends a fractional minimum in thousandths for what is weighed', async () => {
      const { catalog } = setup();
      await fillBasics();
      fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'kilogram' } });
      type('Existencia mínima (opcional)', '2,5');

      save();

      await screen.findByText('/catalogo');
      expect(catalog.createProduct.mock.calls[0]?.[0].minStockMilli).toBe(2500);
      expect(catalog.createProduct.mock.calls[0]?.[0].unit).toBe('kilogram');
    });

    it('does not send twice if the button is pressed again while it is sending', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockReturnValue(new Promise(() => undefined));
      setup(catalog);
      await fillBasics();

      save();
      const sending = await screen.findByRole('button', { name: 'Enviando…' });
      fireEvent.click(sending);

      expect(catalog.createProduct).toHaveBeenCalledTimes(1);
      expect(sending.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('what it asks for before sending anything', () => {
    it('asks for the name first, and puts the cursor there', async () => {
      const { catalog } = setup();
      await screen.findByLabelText('Nombre');

      save();

      expect(screen.getByText('Escribe el nombre del producto.')).toBeDefined();
      expect(document.activeElement?.id).toBe('nombre');
      expect(catalog.createProduct).not.toHaveBeenCalled();
    });

    it('asks for the SKU when only the name is written', async () => {
      setup();
      await screen.findByLabelText('Nombre');
      type('Nombre', 'Arroz');

      save();

      expect(screen.getByText('Escribe el SKU.')).toBeDefined();
      expect(document.activeElement?.id).toBe('sku');
    });

    it('asks for the price, and does not guess what «3.200» means', async () => {
      const { catalog } = setup();
      await screen.findByLabelText('Nombre');
      type('Nombre', 'Arroz');
      type('SKU (código interno)', 'ARR');

      save();
      expect(screen.getAllByText('Escribe el precio.').length).toBeGreaterThan(0);
      expect(document.activeElement?.id).toBe('precio');

      type('Precio de venta (IVA incluido)', '3.200');
      save();

      expect(
        screen.getAllByText(
          'Escribe solo números, sin puntos, comas ni símbolos. Por ejemplo: 3200.',
        ).length,
      ).toBeGreaterThan(0);
      expect(catalog.createProduct).not.toHaveBeenCalled();
    });

    it('rejects a fractional minimum for what is counted in whole units', async () => {
      const { catalog } = setup();
      await fillBasics();
      type('Existencia mínima (opcional)', '2,5');

      save();

      expect(screen.getByText('Este producto se cuenta por unidades enteras.')).toBeDefined();
      expect(document.activeElement?.id).toBe('minimo');
      expect(catalog.createProduct).not.toHaveBeenCalled();
    });

    it('does not guess whether «1.500» is one and a half or one thousand five hundred', async () => {
      setup();
      await fillBasics();
      fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'kilogram' } });
      type('Existencia mínima (opcional)', '1.500');

      save();

      expect(
        screen.getByText(
          'Para los decimales usa coma y no escribas puntos de miles. Por ejemplo: 1,5.',
        ),
      ).toBeDefined();
    });

    it('takes the message away when the person starts to fix it', async () => {
      setup();
      await screen.findByLabelText('Nombre');
      save();
      expect(screen.getByText('Escribe el nombre del producto.')).toBeDefined();

      type('Nombre', 'A');

      expect(screen.queryByText('Escribe el nombre del producto.')).toBeNull();
    });
  });

  describe('when the server refuses', () => {
    it('says which product already has the SKU, and offers to see it', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'viejo', name: 'Arroz Diana 500 g', sku: 'ARR-500', active: false }),
      );
      setup(catalog);
      await fillBasics();

      save();

      expect(await screen.findByText('Ese SKU ya lo tiene otro producto')).toBeDefined();
      expect(
        screen.getByText(
          'ARR-500 es de «Arroz Diana 500 g», que está archivado. Puedes reactivarlo en vez de crear uno nuevo, o usar otro SKU.',
        ),
      ).toBeDefined();
      expect(
        screen.getByText('Ya existe. Cambia el SKU o reactiva el producto archivado.'),
      ).toBeDefined();
      expect(
        screen.getByRole('link', { name: 'Ver el producto archivado' }).getAttribute('href'),
      ).toBe('/catalogo/viejo');
      expect(catalog.findProductByCode).toHaveBeenCalledWith('sku', 'ARR-500');
      expect(document.activeElement?.getAttribute('role')).toBe('alert');
    });

    it('says it plainly when the one that has the SKU is active', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'otro', name: 'Arroz Diana 500 g', sku: 'ARR-500' }),
      );
      setup(catalog);
      await fillBasics();

      save();

      expect(
        await screen.findByText('ARR-500 es de «Arroz Diana 500 g». Usa otro SKU.'),
      ).toBeDefined();
      expect(screen.getByText('Ya existe. Usa otro SKU.')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Ver el producto' }).getAttribute('href')).toBe(
        '/catalogo/otro',
      );
    });

    it('says which product has the barcode', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('barcode-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({
          id: 'viejo',
          name: 'Arroz Diana 500 g',
          barcode: '7701234567897',
          active: false,
        }),
      );
      setup(catalog);
      await fillBasics();
      type('Código de barras (opcional)', '7701234567897');

      save();

      expect(
        await screen.findByText('Ese código de barras ya lo tiene otro producto'),
      ).toBeDefined();
      expect(
        screen.getByText('Ese código ya es de «Arroz Diana 500 g» (archivado).'),
      ).toBeDefined();
      expect(catalog.findProductByCode).toHaveBeenCalledWith('barcode', '7701234567897');
    });

    it('still says it when it cannot find out who has it', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockRejectedValue(network);
      setup(catalog);
      await fillBasics();

      save();

      expect(await screen.findByText('No pudimos guardar el producto')).toBeDefined();
      expect(screen.getAllByText('Ese SKU ya lo tiene otro producto.').length).toBeGreaterThan(0);
      expect(screen.queryByRole('link', { name: /Ver el producto/ })).toBeNull();
    });

    it('puts what the server says about each field on that field', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(
        refused('validation-failed', [
          { pointer: '/name', code: 'invalid', detail: 'El nombre es muy largo.' },
          { pointer: '/unitPrice', code: 'invalid', detail: 'El precio es muy alto.' },
          { pointer: '/barcode', code: 'invalid', detail: 'El código no es válido.' },
          { pointer: '/minStockMilli', code: 'invalid', detail: 'El mínimo es muy alto.' },
        ]),
      );
      setup(catalog);
      await fillBasics();

      save();

      expect(await screen.findByText('El nombre es muy largo.')).toBeDefined();
      expect(screen.getByText('El precio es muy alto.')).toBeDefined();
      expect(screen.getByText('El código no es válido.')).toBeDefined();
      expect(screen.getByText('El mínimo es muy alto.')).toBeDefined();
      expect(screen.getByLabelText('Nombre').getAttribute('aria-invalid')).toBe('true');
    });

    it('says there is no connection, and keeps what was written', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(network);
      setup(catalog);
      await fillBasics();

      save();

      expect(await screen.findByText('No pudimos guardar el producto')).toBeDefined();
      expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
      expect(screen.getByLabelText<HTMLInputElement>('SKU (código interno)').value).toBe('ARR-500');
    });
  });

  describe('when the categories do not arrive', () => {
    it('says so and offers to try again', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.listAllCategories.mockRejectedValueOnce(network);
      setup(catalog);

      expect(await screen.findByText('No pudimos cargar las categorías')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByLabelText('Nombre')).toBeDefined();
    });
  });

  describe('what is sent and what goes away', () => {
    it('sends the SKU without the spaces around it', async () => {
      const { catalog } = setup();
      await fillBasics();
      type('SKU (código interno)', '  ARR-500  ');

      save();

      await screen.findByText('/catalogo');
      expect(catalog.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'ARR-500' }),
      );
    });

    it('says it plainly when the one that has the barcode is active', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('barcode-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'otro', name: 'Arroz Diana 500 g', barcode: '7701234567897' }),
      );
      setup(catalog);
      await fillBasics();
      type('Código de barras (opcional)', '7701234567897');

      save();

      expect(await screen.findByText('Ese código ya es de «Arroz Diana 500 g».')).toBeDefined();
      expect(screen.queryByText(/archivado/)).toBeNull();
    });

    it('encodes the id of the product that has the code in the link to it', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'a/b', name: 'Raro', sku: 'ARR-500' }),
      );
      setup(catalog);
      await fillBasics();

      save();

      const link = await screen.findByRole('link', { name: 'Ver el producto' });
      expect(link.getAttribute('href')).toBe('/catalogo/a%2Fb');
    });

    it('takes away who has the SKU as soon as the person writes another one', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(refused('sku-taken'));
      catalog.findProductByCode.mockResolvedValue(
        testProduct({ id: 'otro', name: 'Arroz Diana 500 g', sku: 'ARR-500' }),
      );
      setup(catalog);
      await fillBasics();
      save();
      await screen.findByText('ARR-500 es de «Arroz Diana 500 g». Usa otro SKU.');

      type('SKU (código interno)', 'ARR-501');

      expect(screen.queryByText('ARR-500 es de «Arroz Diana 500 g». Usa otro SKU.')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Ver el producto' })).toBeNull();
    });

    it('takes away what the server said as soon as the person writes again', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.createProduct.mockRejectedValue(network);
      setup(catalog);
      await fillBasics();
      save();
      await screen.findByText('No pudimos guardar el producto');

      type('Nombre', 'Arroz');

      expect(screen.queryByText('No pudimos guardar el producto')).toBeNull();
    });

    it('does not take a value that is not one of the units for a unit', async () => {
      setup();
      await screen.findByLabelText('Nombre');

      fireEvent.change(screen.getByLabelText('Unidad'), { target: { value: 'caja-rara' } });

      expect(screen.getByLabelText<HTMLSelectElement>('Unidad').value).toBe('unit');
    });
  });
});
