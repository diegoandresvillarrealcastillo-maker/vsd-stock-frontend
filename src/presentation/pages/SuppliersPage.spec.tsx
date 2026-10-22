import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakePurchasing, testSupplier } from '../../../test/support/purchasing';
import { renderScreen } from '../../../test/support/screens';
import { SuppliersPage } from './SuppliersPage';

const SOL = testSupplier({ id: 'sol', name: 'Distribuidora El Sol', contact: '300 123 4567' });
const VALLE = testSupplier({ id: 'valle', name: 'Granos del Valle', contact: null });

function setup(purchasing = createFakePurchasing([SOL, VALLE], [])) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(<SuppliersPage />, { path: '/compras/proveedores', auth, purchasing });
  return { ...view, purchasing };
}

const refused = (code: string) =>
  new ApiError({
    class: 'conflict',
    status: 409,
    problem: {
      type: `urn:vsd-stock:problem:${code}`,
      title: 't',
      status: 409,
      detail: 'texto del servidor',
      instance: '/v1/suppliers',
      code,
      traceId: 't-1',
    } satisfies Problem,
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

const names = () =>
  within(screen.getByRole('list', { name: 'Proveedores' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')?.textContent);
const row = (name: string) => screen.getByText(name, { selector: 'p' }).closest('li')!;
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('SuppliersPage', () => {
  it('says it is loading, and then lists the suppliers with their contact', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando proveedores');
    await screen.findByText('Distribuidora El Sol');
    expect(names()).toEqual(['Distribuidora El Sol', 'Granos del Valle']);
    expect(row('Distribuidora El Sol').textContent).toContain('300 123 4567');
    expect(row('Granos del Valle').textContent).toContain('Sin contacto');
    expect(screen.getByRole('link', { name: 'Volver a compras' }).getAttribute('href')).toBe(
      '/compras',
    );
  });

  it('invites the person to add the first one when there are none', async () => {
    setup(createFakePurchasing([], []));

    expect(await screen.findByText('Todavía no tienes proveedores.')).toBeDefined();
  });

  it('says it could not load, and tries again when asked', async () => {
    const purchasing = createFakePurchasing([SOL], []);
    purchasing.listAllSuppliers.mockRejectedValueOnce(network);
    setup(purchasing);

    expect(await screen.findByText('No pudimos cargar los proveedores')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Distribuidora El Sol')).toBeDefined();
  });

  describe('adding one', () => {
    it('adds it with its name and contact, empties the form and shows the new list', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');
      purchasing.listAllSuppliers.mockResolvedValue([
        SOL,
        VALLE,
        testSupplier({ id: 'n', name: 'Aseo Total', contact: '311' }),
      ]);

      type('Nombre', ' Aseo Total ');
      type('Contacto (opcional)', ' 311 ');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

      expect(await screen.findByText('Agregamos «Aseo Total».')).toBeDefined();
      expect(purchasing.createSupplier).toHaveBeenCalledWith({
        name: 'Aseo Total',
        contact: '311',
      });
      await waitFor(() =>
        expect(names()).toEqual(['Distribuidora El Sol', 'Granos del Valle', 'Aseo Total']),
      );
      expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('');
      expect(screen.getByLabelText<HTMLInputElement>('Contacto (opcional)').value).toBe('');
    });

    it('adds one without a contact', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');

      type('Nombre', 'Aseo Total');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

      await screen.findByText('Agregamos «Aseo Total».');
      expect(purchasing.createSupplier).toHaveBeenCalledWith({ name: 'Aseo Total', contact: null });
    });

    it('asks for a name, and puts the cursor on the field', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

      expect(screen.getByText('Escribe el nombre del proveedor.')).toBeDefined();
      expect(document.activeElement?.id).toBe('proveedor-nombre');
      expect(purchasing.createSupplier).not.toHaveBeenCalled();
    });

    it('takes the message away when the person starts to write', async () => {
      setup();
      await screen.findByText('Distribuidora El Sol');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

      type('Nombre', 'A');

      expect(screen.queryByText('Escribe el nombre del proveedor.')).toBeNull();
    });

    it('puts what the server says about each field on that field', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createSupplier.mockRejectedValue(
        new ApiError({
          class: 'permanent',
          status: 400,
          problem: {
            type: 'urn:vsd-stock:problem:validation-failed',
            title: 't',
            status: 400,
            detail: 'x',
            instance: '/v1/suppliers',
            code: 'validation-failed',
            traceId: 't-1',
            errors: [
              { pointer: '/name', code: 'too-long', detail: 'El nombre es muy largo.' },
              { pointer: '/contact', code: 'too-long', detail: 'El contacto es muy largo.' },
            ],
          },
          retryAfterMs: null,
        }),
      );
      setup(purchasing);
      await screen.findByText('Distribuidora El Sol');

      type('Nombre', 'x');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

      expect(await screen.findByText('El nombre es muy largo.')).toBeDefined();
      expect(screen.getByText('El contacto es muy largo.')).toBeDefined();
    });

    it('says why it could not add it when there is no connection, and keeps what was written', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.createSupplier.mockRejectedValue(network);
      setup(purchasing);
      await screen.findByText('Distribuidora El Sol');

      type('Nombre', 'Aseo Total');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar proveedor' }));

      expect(await screen.findByText('No pudimos guardar el proveedor')).toBeDefined();
      expect(screen.getByLabelText<HTMLInputElement>('Nombre').value).toBe('Aseo Total');
    });
  });

  describe('changing one', () => {
    it('sends only what changed and shows the list again', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');
      purchasing.listAllSuppliers.mockResolvedValue([
        testSupplier({ id: 'sol', name: 'El Sol SAS', contact: '300 123 4567' }),
        VALLE,
      ]);

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));
      expect(
        screen.getByLabelText<HTMLInputElement>('Nuevo nombre de «Distribuidora El Sol»').value,
      ).toBe('Distribuidora El Sol');
      expect(
        screen.getByLabelText<HTMLInputElement>('Nuevo contacto de «Distribuidora El Sol»').value,
      ).toBe('300 123 4567');
      type('Nuevo nombre de «Distribuidora El Sol»', ' El Sol SAS ');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Cambiamos «Distribuidora El Sol».')).toBeDefined();
      expect(purchasing.updateSupplier).toHaveBeenCalledWith('sol', { name: 'El Sol SAS' });
      await waitFor(() => expect(names()).toEqual(['El Sol SAS', 'Granos del Valle']));
      expect(screen.queryByLabelText(/Nuevo nombre/)).toBeNull();
    });

    it('clears the contact when it is erased, and adds one where there was none', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));
      type('Nuevo contacto de «Distribuidora El Sol»', '');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await screen.findByText('Cambiamos «Distribuidora El Sol».');

      expect(purchasing.updateSupplier).toHaveBeenLastCalledWith('sol', { contact: null });

      fireEvent.click(within(row('Granos del Valle')).getByRole('button', { name: 'Cambiar' }));
      expect(
        screen.getByLabelText<HTMLInputElement>('Nuevo contacto de «Granos del Valle»').value,
      ).toBe('');
      type('Nuevo contacto de «Granos del Valle»', ' 311 ');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      await screen.findByText('Cambiamos «Granos del Valle».');

      expect(purchasing.updateSupplier).toHaveBeenLastCalledWith('valle', { contact: '311' });
    });

    it('asks for a name', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));
      type('Nuevo nombre de «Distribuidora El Sol»', '  ');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(screen.getByText('Escribe el nombre del proveedor.')).toBeDefined();
      expect(document.activeElement?.id).toBe('proveedor-sol-nombre');
      expect(purchasing.updateSupplier).not.toHaveBeenCalled();
    });

    it('does not ask the server when nothing changed', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(purchasing.updateSupplier).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/Nuevo nombre/)).toBeNull();
    });

    it('can be cancelled, and only one is edited at a time', async () => {
      setup();
      await screen.findByText('Distribuidora El Sol');
      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));

      fireEvent.click(within(row('Granos del Valle')).getByRole('button', { name: 'Cambiar' }));
      expect(screen.queryByLabelText('Nuevo nombre de «Distribuidora El Sol»')).toBeNull();
      expect(screen.getByLabelText('Nuevo nombre de «Granos del Valle»')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByLabelText(/Nuevo nombre/)).toBeNull();
    });

    it('says why it could not change it', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.updateSupplier.mockRejectedValue(network);
      setup(purchasing);
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));
      type('Nuevo nombre de «Distribuidora El Sol»', 'Otro');
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('No pudimos cambiar «Distribuidora El Sol»')).toBeDefined();
    });
  });

  describe('deleting one', () => {
    it('asks first, and then deletes it', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');
      purchasing.listAllSuppliers.mockResolvedValue([VALLE]);

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Borrar' }));
      expect(screen.getByText('¿Borrar «Distribuidora El Sol»?')).toBeDefined();
      expect(purchasing.deleteSupplier).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('Borramos «Distribuidora El Sol».')).toBeDefined();
      expect(purchasing.deleteSupplier).toHaveBeenCalledWith('sol');
      await waitFor(() => expect(names()).toEqual(['Granos del Valle']));
    });

    it('can be cancelled', async () => {
      const { purchasing } = setup();
      await screen.findByText('Distribuidora El Sol');
      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Borrar' }));

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByText('¿Borrar «Distribuidora El Sol»?')).toBeNull();
      expect(purchasing.deleteSupplier).not.toHaveBeenCalled();
    });

    it('says why it can not delete a supplier that already has purchases', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.deleteSupplier.mockRejectedValue(refused('supplier-in-use'));
      setup(purchasing);
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Borrar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('No se puede borrar «Distribuidora El Sol»')).toBeDefined();
      expect(
        screen.getByText(
          'Ese proveedor ya tiene compras y no se puede borrar. Cámbiale el nombre si hace falta.',
        ),
      ).toBeDefined();
      expect(names()).toEqual(['Distribuidora El Sol']);
    });

    it('says it could not delete when there is no connection', async () => {
      const purchasing = createFakePurchasing([SOL], []);
      purchasing.deleteSupplier.mockRejectedValue(network);
      setup(purchasing);
      await screen.findByText('Distribuidora El Sol');

      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Borrar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('No pudimos borrar «Distribuidora El Sol»')).toBeDefined();
    });
  });

  describe('what goes away when the person does something else', () => {
    it('the question about deleting, when another supplier starts to be changed', async () => {
      setup();
      await screen.findByText('Distribuidora El Sol');
      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Borrar' }));
      expect(screen.getByText('¿Borrar «Distribuidora El Sol»?')).toBeDefined();

      fireEvent.click(within(row('Granos del Valle')).getByRole('button', { name: 'Cambiar' }));

      expect(screen.queryByText('¿Borrar «Distribuidora El Sol»?')).toBeNull();
      expect(screen.getByLabelText('Nuevo nombre de «Granos del Valle»')).toBeDefined();
    });

    it('the editor, when the person asks about deleting another supplier', async () => {
      setup();
      await screen.findByText('Distribuidora El Sol');
      fireEvent.click(within(row('Distribuidora El Sol')).getByRole('button', { name: 'Cambiar' }));
      expect(screen.getByLabelText('Nuevo nombre de «Distribuidora El Sol»')).toBeDefined();

      fireEvent.click(within(row('Granos del Valle')).getByRole('button', { name: 'Borrar' }));

      expect(screen.queryByLabelText('Nuevo nombre de «Distribuidora El Sol»')).toBeNull();
      expect(screen.getByText('¿Borrar «Granos del Valle»?')).toBeDefined();
    });
  });
});
