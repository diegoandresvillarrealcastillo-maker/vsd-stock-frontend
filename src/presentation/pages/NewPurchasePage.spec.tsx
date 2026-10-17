import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeCatalog, lastPage, testProduct } from '../../../test/support/catalog';
import { createFakePurchasing, testSupplier } from '../../../test/support/purchasing';
import { renderScreen } from '../../../test/support/screens';
import { NewPurchasePage } from './NewPurchasePage';

const ARROZ = testProduct({ id: 'arroz', name: 'Arroz 500 g', sku: 'ARR-500', unit: 'unit' });
const AZUCAR = testProduct({ id: 'azucar', name: 'Azúcar 1 kg', sku: 'AZU-1K', unit: 'kilogram' });
const SOL = testSupplier({ id: 'sol', name: 'Distribuidora El Sol' });
const VALLE = testSupplier({ id: 'valle', name: 'Granos del Valle' });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function setup(
  purchasing = createFakePurchasing([SOL, VALLE], []),
  catalog = createFakeCatalog([ARROZ, AZUCAR], []),
) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(<NewPurchasePage />, {
    path: '/compras/nueva',
    auth,
    purchasing,
    catalog,
  });
  return { ...view, purchasing, catalog };
}

const refused = (code: string, status: number, errors?: Problem['errors']) =>
  new ApiError({
    class: status === 409 ? 'conflict' : 'permanent',
    status,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status,
      detail: 'texto del servidor',
      instance: '/v1/purchases',
      code,
      traceId: 't-1',
      ...(errors === undefined ? {} : { errors }),
    },
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const register = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));
const addLine = () => fireEvent.click(screen.getByRole('button', { name: 'Agregar línea' }));

async function pick(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }));
}

async function addProduct(name: string, quantity: string, cost: string) {
  await pick(name);
  type('Cantidad', quantity);
  type('Costo por unidad', cost);
  addLine();
}

const lines = () =>
  within(screen.getByRole('list', { name: 'Líneas de la compra' })).getAllByRole('listitem');

describe('NewPurchasePage', () => {
  it('shows the form once the suppliers arrive', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nueva compra' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Volver a compras' }).getAttribute('href')).toBe(
      '/compras',
    );
  });

  it('offers the suppliers, with none as the first option', async () => {
    setup();
    await screen.findByLabelText('Proveedor (opcional)');

    const options = Array.from(
      screen.getByLabelText<HTMLSelectElement>('Proveedor (opcional)').options,
    );
    expect(options.map((option) => option.text)).toEqual([
      'Sin proveedor',
      'Distribuidora El Sol',
      'Granos del Valle',
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>('Proveedor (opcional)').value).toBe('');
  });

  it('says it could not load the suppliers, and tries again when asked', async () => {
    const purchasing = createFakePurchasing([SOL], []);
    purchasing.listAllSuppliers.mockRejectedValueOnce(network);
    setup(purchasing);

    expect(await screen.findByText('No pudimos cargar los proveedores')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByLabelText('Proveedor (opcional)')).toBeDefined();
  });

  describe('looking for a product', () => {
    it('offers the active products to choose from, and asks the server for what was typed', async () => {
      const { catalog } = setup();

      await screen.findByRole('button', { name: /Arroz 500 g/ });
      expect(catalog.listProducts).toHaveBeenCalledWith({ active: true });
      catalog.listProducts.mockResolvedValue(lastPage([AZUCAR]));
      fireEvent.change(screen.getByRole('searchbox', { name: 'Producto' }), {
        target: { value: '  azu ' },
      });
      fireEvent.submit(screen.getByRole('search'));

      expect(await screen.findByRole('button', { name: /Azúcar 1 kg/ })).toBeDefined();
      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: true, search: 'azu' });
      expect(screen.queryByRole('button', { name: /Arroz 500 g/ })).toBeNull();
    });

    it('says when nothing matches', async () => {
      const { catalog } = setup();
      await screen.findByRole('button', { name: /Arroz 500 g/ });
      catalog.listProducts.mockResolvedValue(lastPage([]));

      fireEvent.change(screen.getByRole('searchbox', { name: 'Producto' }), {
        target: { value: 'zzz' },
      });
      fireEvent.submit(screen.getByRole('search'));

      expect(await screen.findByText('No encontramos productos activos con «zzz».')).toBeDefined();
    });

    it('says it could not load the products, and tries again when asked', async () => {
      const catalog = createFakeCatalog([ARROZ], []);
      catalog.listProducts.mockRejectedValueOnce(network);
      setup(undefined, catalog);

      expect(await screen.findByText('No pudimos cargar los productos')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByRole('button', { name: /Arroz 500 g/ })).toBeDefined();
    });

    it('shows the chosen product and its unit, and lets the person change it', async () => {
      setup();
      await pick('Arroz 500 g');

      expect(screen.getByText('Arroz 500 g (ARR-500)')).toBeDefined();
      expect(screen.getByText('En und.')).toBeDefined();
      expect(screen.queryByRole('searchbox')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Cambiar producto' }));

      expect(await screen.findByRole('searchbox', { name: 'Producto' })).toBeDefined();
      expect(screen.queryByText('Arroz 500 g (ARR-500)')).toBeNull();
    });
  });

  describe('adding lines', () => {
    it('adds a line with the product, the quantity and the cost, and empties the draft', async () => {
      setup();

      await addProduct('Arroz 500 g', '24', '2500');

      expect(lines()).toHaveLength(1);
      expect(lines()[0]?.textContent).toContain('Línea 1');
      expect(lines()[0]?.textContent).toContain('Arroz 500 g · 24 und · $ 2.500 cada und');
      expect(screen.getByLabelText<HTMLInputElement>('Cantidad').value).toBe('');
      expect(screen.getByLabelText<HTMLInputElement>('Costo por unidad').value).toBe('');
      expect(await screen.findByRole('searchbox', { name: 'Producto' })).toBeDefined();
    });

    it('adds a second line in kilograms, with a comma for the decimals', async () => {
      setup();
      await addProduct('Arroz 500 g', '24', '2500');

      await addProduct('Azúcar 1 kg', '12,5', '4200');

      expect(lines()).toHaveLength(2);
      expect(lines()[1]?.textContent).toContain('Línea 2');
      expect(lines()[1]?.textContent).toContain('Azúcar 1 kg · 12,5 kg · $ 4.200 cada kg');
    });

    it('says how the quantity is written, in the unit of the product', async () => {
      setup();
      await pick('Azúcar 1 kg');

      expect(screen.getByText('En kg. Usa coma para los decimales.')).toBeDefined();
    });

    it('asks for a product first', async () => {
      setup();
      await screen.findByRole('button', { name: /Arroz 500 g/ });
      type('Cantidad', '2');
      type('Costo por unidad', '100');

      addLine();

      expect(screen.getByText('Elige un producto.')).toBeDefined();
      expect(document.activeElement?.id).toBe('producto');
      expect(screen.queryByRole('list', { name: 'Líneas de la compra' })).toBeNull();
    });

    it('asks for the quantity, and does not accept zero or a fraction for what is counted in units', async () => {
      setup();
      await pick('Arroz 500 g');
      type('Costo por unidad', '100');

      addLine();
      expect(screen.getAllByText('Escribe la cantidad.').length).toBeGreaterThan(0);
      expect(document.activeElement?.id).toBe('cantidad');

      type('Cantidad', '0');
      addLine();
      expect(screen.getAllByText('La cantidad no puede ser cero.').length).toBeGreaterThan(0);

      type('Cantidad', '1,5');
      addLine();
      expect(
        screen.getAllByText('Este producto se cuenta por unidades enteras.').length,
      ).toBeGreaterThan(0);
      expect(screen.queryByRole('list', { name: 'Líneas de la compra' })).toBeNull();
    });

    it('asks for the cost, in whole pesos without dots', async () => {
      setup();
      await pick('Arroz 500 g');
      type('Cantidad', '2');

      addLine();
      expect(screen.getAllByText('Escribe el precio.').length).toBeGreaterThan(0);
      expect(document.activeElement?.id).toBe('costo');

      type('Costo por unidad', '3.100');
      addLine();

      expect(
        screen.getAllByText(
          'Escribe solo números, sin puntos, comas ni símbolos. Por ejemplo: 3200.',
        ).length,
      ).toBeGreaterThan(0);
    });

    it('accepts a cost of zero', async () => {
      setup();

      await addProduct('Arroz 500 g', '2', '0');

      expect(lines()[0]?.textContent).toContain('$ 0 cada und');
    });

    it('does not repeat a product: it is one line per product', async () => {
      setup();
      await addProduct('Arroz 500 g', '24', '2500');

      await pick('Arroz 500 g');
      type('Cantidad', '2');
      type('Costo por unidad', '100');
      addLine();

      expect(
        screen.getByText(
          'Ese producto ya está en la compra: quita esa línea o cambia su cantidad.',
        ),
      ).toBeDefined();
      expect(lines()).toHaveLength(1);
    });

    it('takes a line away, and the numbering follows', async () => {
      setup();
      await addProduct('Arroz 500 g', '24', '2500');
      await addProduct('Azúcar 1 kg', '12,5', '4200');

      fireEvent.click(screen.getByRole('button', { name: 'Quitar la línea 1' }));

      expect(lines()).toHaveLength(1);
      expect(lines()[0]?.textContent).toContain('Línea 1');
      expect(lines()[0]?.textContent).toContain('Azúcar 1 kg');
    });

    it('lets a removed product be added again', async () => {
      setup();
      await addProduct('Arroz 500 g', '24', '2500');
      fireEvent.click(screen.getByRole('button', { name: 'Quitar la línea 1' }));

      await addProduct('Arroz 500 g', '5', '2600');

      expect(lines()).toHaveLength(1);
      expect(lines()[0]?.textContent).toContain('5 und · $ 2.600');
    });
  });

  describe('registering the purchase', () => {
    it('sends the supplier, the note and every line, and goes back to the purchases saying so', async () => {
      const { purchasing } = setup();
      await screen.findByLabelText('Proveedor (opcional)');
      fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: 'sol' } });
      type('Nota (opcional)', '  Pedido de octubre ');
      await addProduct('Arroz 500 g', '24', '2500');
      await addProduct('Azúcar 1 kg', '12,5', '4200');

      register();

      await screen.findByText('/compras');
      expect(purchasing.createPurchase).toHaveBeenCalledTimes(1);
      expect(purchasing.createPurchase).toHaveBeenCalledWith({
        operationId: expect.stringMatching(UUID) as string,
        supplierId: 'sol',
        note: 'Pedido de octubre',
        lines: [
          { productId: 'arroz', quantityMilli: 24_000, unitCost: 2500 },
          { productId: 'azucar', quantityMilli: 12_500, unitCost: 4200 },
        ],
      });
      expect(screen.getByTestId('estado').textContent).toContain(
        'Compra registrada: la existencia ya subió.',
      );
    });

    it('leaves out the supplier and the note that were not given', async () => {
      const { purchasing } = setup();
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');

      register();

      await screen.findByText('/compras');
      const sent = purchasing.createPurchase.mock.calls[0]?.[0];
      expect(sent?.supplierId).toBeNull();
      expect(sent?.note).toBeNull();
    });

    it('says the purchase was already registered when the server repeats its answer', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockImplementation((input) =>
        Promise.resolve({
          purchase: {
            id: 'c1',
            operationId: input.operationId,
            warehouseId: 'w',
            supplierId: null,
            note: null,
            createdAt: new Date(),
            createdByUserId: null,
            lines: [...input.lines],
          },
          replayed: true,
        }),
      );
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');

      register();

      await screen.findByText('/compras');
      expect(screen.getByTestId('estado').textContent).toContain(
        'Ya estaba registrada. La conexión falló antes de ver la respuesta y la enviamos otra vez; la existencia subió una sola vez.',
      );
    });

    it('asks for at least one line', async () => {
      const { purchasing } = setup();
      await screen.findByLabelText('Proveedor (opcional)');

      register();

      expect(screen.getByText('Agrega al menos una línea.')).toBeDefined();
      expect(purchasing.createPurchase).not.toHaveBeenCalled();
    });

    it('adds the line that is being written, if it is complete, instead of losing it', async () => {
      const { purchasing } = setup();
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');
      await pick('Azúcar 1 kg');
      type('Cantidad', '1,5');
      type('Costo por unidad', '4200');

      register();

      await screen.findByText('/compras');
      expect(purchasing.createPurchase.mock.calls[0]?.[0].lines).toEqual([
        { productId: 'arroz', quantityMilli: 24_000, unitCost: 2500 },
        { productId: 'azucar', quantityMilli: 1500, unitCost: 4200 },
      ]);
    });

    it('does not send when the line that is being written is not complete, and says what it lacks', async () => {
      const { purchasing } = setup();
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');
      await pick('Azúcar 1 kg');
      type('Cantidad', '1,5');

      register();

      expect(screen.getAllByText('Escribe el precio.').length).toBeGreaterThan(0);
      expect(purchasing.createPurchase).not.toHaveBeenCalled();
    });

    it('does not send twice if the button is pressed again while it is sending', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockReturnValue(new Promise(() => undefined));
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');

      register();
      const sending = await screen.findByRole('button', { name: 'Enviando…' });
      fireEvent.click(sending);

      expect(purchasing.createPurchase).toHaveBeenCalledTimes(1);
    });

    it('tries again with the same operation id after a failure, so the server never counts it twice', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockRejectedValueOnce(network);
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');

      register();
      expect(await screen.findByText('No pudimos registrar la compra')).toBeDefined();
      register();

      await screen.findByText('/compras');
      expect(purchasing.createPurchase).toHaveBeenCalledTimes(2);
      expect(purchasing.createPurchase.mock.calls[1]?.[0].operationId).toBe(
        purchasing.createPurchase.mock.calls[0]?.[0].operationId,
      );
    });

    it('uses a different operation id for each purchase screen it opens', async () => {
      const first = setup();
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');
      register();
      await screen.findByText('/compras');
      const firstId = first.purchasing.createPurchase.mock.calls[0]?.[0].operationId;
      first.unmount();

      const second = setup();
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');
      register();
      await screen.findByText('/compras');

      expect(second.purchasing.createPurchase.mock.calls[0]?.[0].operationId).not.toBe(firstId);
    });
  });

  describe('when the server refuses', () => {
    it('says which line has a problem, in the line itself', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockRejectedValue(
        refused('validation-failed', 400, [
          {
            pointer: '/lines/1/productId',
            code: 'archived-product',
            detail: 'Este producto está archivado: reactívalo antes de comprarlo.',
          },
          {
            pointer: '/lines/0/quantityMilli',
            code: 'not-whole',
            detail: 'Este producto se cuenta en unidades enteras.',
          },
        ]),
      );
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');
      await addProduct('Azúcar 1 kg', '12,5', '4200');

      register();

      expect(await screen.findByText('No pudimos registrar la compra')).toBeDefined();
      expect(
        within(lines()[0]!).getByText('Este producto se cuenta en unidades enteras.'),
      ).toBeDefined();
      expect(
        within(lines()[1]!).getByText(
          'Este producto está archivado: reactívalo antes de comprarlo.',
        ),
      ).toBeDefined();
    });

    it('puts the problems of the supplier and the note on their fields', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockRejectedValue(
        refused('validation-failed', 400, [
          {
            pointer: '/supplierId',
            code: 'unknown-supplier',
            detail: 'Ese proveedor ya no existe.',
          },
          { pointer: '/note', code: 'too-long', detail: 'La nota es muy larga.' },
        ]),
      );
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');

      register();

      expect(await screen.findByText('Ese proveedor ya no existe.')).toBeDefined();
      expect(screen.getByText('La nota es muy larga.')).toBeDefined();
    });

    it('says the operation id was already used with other data, and offers to see the purchases', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockRejectedValue(refused('operation-id-reused', 409));
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');

      register();

      expect(
        await screen.findByText(
          'Esto ya se había registrado con otros datos. Revisa lo que ya quedó guardado antes de repetirlo.',
        ),
      ).toBeDefined();
      expect(screen.getByRole('link', { name: 'Ver las compras' }).getAttribute('href')).toBe(
        '/compras',
      );
    });

    it('says there is no connection and keeps everything that was written', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockRejectedValue(network);
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      type('Nota (opcional)', 'Pedido');
      await addProduct('Arroz 500 g', '24', '2500');

      register();

      expect(await screen.findByText('No pudimos registrar la compra')).toBeDefined();
      expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
      expect(lines()).toHaveLength(1);
      expect(screen.getByLabelText<HTMLInputElement>('Nota (opcional)').value).toBe('Pedido');
      expect(screen.queryByRole('link', { name: 'Ver las compras' })).toBeNull();
    });

    it('takes the line problems away when the person changes the lines', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createPurchase.mockRejectedValue(
        refused('validation-failed', 400, [
          { pointer: '/lines/0/unitCost', code: 'invalid', detail: 'El costo no es válido.' },
        ]),
      );
      setup(purchasing);
      await screen.findByLabelText('Proveedor (opcional)');
      await addProduct('Arroz 500 g', '24', '2500');
      register();
      await screen.findByText('El costo no es válido.');

      fireEvent.click(screen.getByRole('button', { name: 'Quitar la línea 1' }));

      await waitFor(() => expect(screen.queryByText('El costo no es válido.')).toBeNull());
    });
  });
});
