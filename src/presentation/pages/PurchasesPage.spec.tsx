import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { lastPage } from '../../../test/support/catalog';
import {
  createFakePurchasing,
  testPurchaseSummary,
  testSupplier,
} from '../../../test/support/purchasing';
import { renderScreen } from '../../../test/support/screens';
import { PurchasesPage } from './PurchasesPage';

const SOL = testSupplier({ id: 'sol', name: 'Distribuidora El Sol' });
const VALLE = testSupplier({ id: 'valle', name: 'Granos del Valle' });
const OCTUBRE = testPurchaseSummary({
  id: 'c1',
  supplierId: 'sol',
  note: 'Pedido de octubre',
  lineCount: 3,
  createdAt: new Date(2026, 9, 17, 11, 2),
});
const GRANOS = testPurchaseSummary({
  id: 'c2',
  supplierId: 'valle',
  note: null,
  lineCount: 1,
  createdAt: new Date(2026, 9, 10, 9, 0),
});
const SUELTA = testPurchaseSummary({
  id: 'c3',
  supplierId: null,
  note: null,
  lineCount: 5,
  createdAt: new Date(2026, 9, 2, 16, 30),
});

function setup(
  purchasing = createFakePurchasing([SOL, VALLE], [OCTUBRE, GRANOS, SUELTA]),
  state?: unknown,
) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(<PurchasesPage />, { path: '/compras', auth, purchasing, state });
  return { ...view, purchasing };
}

const failure = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });
const rows = () => within(screen.getByRole('list', { name: 'Compras' })).getAllByRole('listitem');

describe('PurchasesPage', () => {
  it('says it is loading, and then lists the purchases as the server sends them', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando compras');
    await screen.findByRole('list', { name: 'Compras' });
    expect(rows()).toHaveLength(3);
  });

  it('says only how many products when the purchase has no note', async () => {
    setup();
    await screen.findByRole('list', { name: 'Compras' });

    expect(rows()[1]?.querySelectorAll('p')[1]?.textContent).toBe('1 producto');
    expect(rows()[2]?.querySelectorAll('p')[1]?.textContent).toBe('5 productos');
  });

  it('says the day, who it was bought from, how many products and the note', async () => {
    setup();
    await screen.findByRole('list', { name: 'Compras' });

    expect(rows()[0]?.textContent).toContain('17 oct · Distribuidora El Sol');
    expect(rows()[0]?.textContent).toContain('3 productos · Pedido de octubre');
    expect(rows()[1]?.textContent).toContain('10 oct · Granos del Valle');
    expect(rows()[1]?.textContent).toContain('1 producto');
    expect(rows()[1]?.textContent).not.toContain('1 productos');
    expect(rows()[1]?.textContent).not.toContain('·  ');
  });

  it('says there was no supplier when there was none', async () => {
    setup();
    await screen.findByRole('list', { name: 'Compras' });

    expect(rows()[2]?.textContent).toContain('2 oct · Sin proveedor');
    expect(rows()[2]?.textContent).toContain('5 productos');
  });

  it('shows the day alone while it does not know the names of the suppliers', async () => {
    const purchasing = createFakePurchasing([SOL], [OCTUBRE]);
    purchasing.listAllSuppliers.mockRejectedValue(failure);
    setup(purchasing);
    await screen.findByRole('list', { name: 'Compras' });

    expect(rows()[0]?.textContent).toContain('17 oct');
    expect(rows()[0]?.textContent).not.toContain('Sin proveedor');
    expect(rows()[0]?.textContent).not.toContain('Distribuidora El Sol');
  });

  it('offers to register a purchase and to see the suppliers', async () => {
    setup();
    await screen.findByRole('list', { name: 'Compras' });

    expect(screen.getByRole('link', { name: 'Nueva compra' }).getAttribute('href')).toBe(
      '/compras/nueva',
    );
    expect(
      screen.getByRole('link', { name: /Ver y cambiar proveedores/ }).getAttribute('href'),
    ).toBe('/compras/proveedores');
  });

  it('says there are no purchases yet, and still offers to register one', async () => {
    setup(createFakePurchasing([SOL], []));

    expect(await screen.findByText('Todavía no registraste compras.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Nueva compra' })).toBeDefined();
  });

  it('shows the notice that the previous screen left', async () => {
    setup(undefined, { notice: 'Compra registrada: la existencia ya subió.' });

    expect(await screen.findByText('Compra registrada: la existencia ya subió.')).toBeDefined();
  });

  it('does not show a notice that is not text', async () => {
    setup(undefined, { notice: 3 });
    await screen.findByRole('list', { name: 'Compras' });

    expect(screen.queryByText('3')).toBeNull();
  });

  describe('paging', () => {
    it('loads more with the cursor of the last page, and keeps what was shown', async () => {
      const purchasing = createFakePurchasing([SOL, VALLE], []);
      purchasing.listPurchases
        .mockResolvedValueOnce({ items: [OCTUBRE], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [GRANOS], nextCursor: null });
      setup(purchasing);
      await screen.findByText(/17 oct/);

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText(/10 oct/)).toBeDefined();
      expect(screen.getByText(/17 oct/)).toBeDefined();
      expect(purchasing.listPurchases).toHaveBeenLastCalledWith('c1');
      expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    });

    it('says why it could not load more, and lets the person try again', async () => {
      const purchasing = createFakePurchasing([SOL, VALLE], []);
      purchasing.listPurchases
        .mockResolvedValueOnce({ items: [OCTUBRE], nextCursor: 'c1' })
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(lastPage([GRANOS]));
      setup(purchasing);
      await screen.findByText(/17 oct/);

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      expect(await screen.findByText('No pudimos cargar más')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText(/10 oct/)).toBeDefined();
    });
  });

  it('says it could not load, and loads again when asked', async () => {
    const purchasing = createFakePurchasing([SOL], [OCTUBRE]);
    purchasing.listPurchases.mockRejectedValueOnce(failure);
    setup(purchasing);

    expect(await screen.findByText('No pudimos cargar las compras')).toBeDefined();
    expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText(/17 oct/)).toBeDefined();
  });
});
