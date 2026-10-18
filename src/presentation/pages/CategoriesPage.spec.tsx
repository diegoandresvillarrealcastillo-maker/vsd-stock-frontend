import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Category } from '../../domain/model/catalog';
import type { Problem } from '../../domain/model/problem';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import { createFakeCatalog, testCategory } from '../../../test/support/catalog';
import { renderScreen } from '../../../test/support/screens';
import { CategoriesPage } from './CategoriesPage';

const GRANOS = testCategory({ id: 'granos', name: 'Granos' });
const ASEO = testCategory({ id: 'aseo', name: 'Aseo y cocina' });

function setup(catalog = createFakeCatalog([], [GRANOS, ASEO])) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', 'owner'));
  const view = renderScreen(<CategoriesPage />, { path: '/catalogo/categorias', auth, catalog });
  return { ...view, catalog };
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
      instance: '/v1/categories',
      code,
      traceId: 't-1',
    } satisfies Problem,
    retryAfterMs: null,
  });
const network = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const names = () =>
  within(screen.getByRole('list', { name: 'Categorías' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('p')?.textContent);
const row = (name: string) =>
  screen.getByText(name, { selector: 'p' }).closest('li') as HTMLElement;

describe('CategoriesPage', () => {
  it('says it is loading, and then lists the categories by name', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando categorías');
    await screen.findByText('Granos');
    expect(names()).toEqual(['Granos', 'Aseo y cocina']);
    expect(screen.getByRole('link', { name: 'Volver al catálogo' }).getAttribute('href')).toBe(
      '/catalogo',
    );
  });

  it('invites the person to add the first one when there are none', async () => {
    setup(createFakeCatalog([], []));

    expect(await screen.findByText('Todavía no tienes categorías.')).toBeDefined();
  });

  it('says it could not load, and tries again when asked', async () => {
    const catalog = createFakeCatalog([], [GRANOS]);
    catalog.listAllCategories.mockRejectedValueOnce(network);
    setup(catalog);

    expect(await screen.findByText('No pudimos cargar las categorías')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Granos')).toBeDefined();
  });

  describe('adding one', () => {
    it('adds it with the name written, empties the field and shows the new list', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');
      catalog.listAllCategories.mockResolvedValue([
        GRANOS,
        ASEO,
        testCategory({ id: 'n', name: 'Bebidas' }),
      ]);

      fireEvent.change(screen.getByLabelText('Nueva categoría'), {
        target: { value: ' Bebidas ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));

      expect(await screen.findByText('Agregamos «Bebidas».')).toBeDefined();
      expect(catalog.createCategory).toHaveBeenCalledWith('Bebidas');
      await waitFor(() => expect(names()).toEqual(['Granos', 'Aseo y cocina', 'Bebidas']));
      expect(screen.getByLabelText<HTMLInputElement>('Nueva categoría').value).toBe('');
    });

    it('asks for a name, and puts the cursor on the field', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');

      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));

      expect(screen.getByText('Escribe el nombre de la categoría.')).toBeDefined();
      expect(document.activeElement?.id).toBe('nueva-categoria');
      expect(catalog.createCategory).not.toHaveBeenCalled();
    });

    it('takes the message away when the person starts to write', async () => {
      setup();
      await screen.findByText('Granos');
      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));

      fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: 'B' } });

      expect(screen.queryByText('Escribe el nombre de la categoría.')).toBeNull();
    });

    it('says the name is taken, on the field, and keeps what was written', async () => {
      const catalog = createFakeCatalog([], [GRANOS]);
      catalog.createCategory.mockRejectedValue(refused('category-name-taken'));
      setup(catalog);
      await screen.findByText('Granos');

      fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: 'granos' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));

      expect(await screen.findByText('Ya hay una categoría con ese nombre.')).toBeDefined();
      expect(screen.getByLabelText('Nueva categoría').getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByLabelText<HTMLInputElement>('Nueva categoría').value).toBe('granos');
    });

    it('says why it could not add it when there is no connection', async () => {
      const catalog = createFakeCatalog([], [GRANOS]);
      catalog.createCategory.mockRejectedValue(network);
      setup(catalog);
      await screen.findByText('Granos');

      fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: 'Bebidas' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));

      expect(await screen.findByText('No pudimos agregar la categoría')).toBeDefined();
      expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
    });
  });

  describe('changing a name', () => {
    it('renames it and shows the list again', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');
      catalog.listAllCategories.mockResolvedValue([
        testCategory({ id: 'granos', name: 'Cereales' }),
        ASEO,
      ]);

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));
      const field = screen.getByLabelText<HTMLInputElement>('Nuevo nombre de «Granos»');
      expect(field.value).toBe('Granos');
      fireEvent.change(field, { target: { value: ' Cereales ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Cambiamos «Granos» a «Cereales».')).toBeDefined();
      expect(catalog.renameCategory).toHaveBeenCalledWith('granos', 'Cereales');
      await waitFor(() => expect(names()).toEqual(['Cereales', 'Aseo y cocina']));
      expect(screen.queryByLabelText(/Nuevo nombre/)).toBeNull();
    });

    it('asks for a name', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));
      fireEvent.change(screen.getByLabelText('Nuevo nombre de «Granos»'), {
        target: { value: '  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(screen.getByText('Escribe el nombre de la categoría.')).toBeDefined();
      expect(document.activeElement?.id).toBe('categoria-granos');
      expect(catalog.renameCategory).not.toHaveBeenCalled();
    });

    it('does not ask the server when the name did not change', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(catalog.renameCategory).not.toHaveBeenCalled();
      expect(screen.queryByLabelText(/Nuevo nombre/)).toBeNull();
    });

    it('can be cancelled', async () => {
      setup();
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByLabelText(/Nuevo nombre/)).toBeNull();
      expect(names()).toEqual(['Granos', 'Aseo y cocina']);
    });

    it('says the name is taken, on the field', async () => {
      const catalog = createFakeCatalog([], [GRANOS, ASEO]);
      catalog.renameCategory.mockRejectedValue(refused('category-name-taken'));
      setup(catalog);
      await screen.findByText('Granos');

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));
      fireEvent.change(screen.getByLabelText('Nuevo nombre de «Granos»'), {
        target: { value: 'Aseo y cocina' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Ya hay una categoría con ese nombre.')).toBeDefined();
      expect(screen.getByLabelText('Nuevo nombre de «Granos»').getAttribute('aria-invalid')).toBe(
        'true',
      );
    });

    it('opens the editor of one category at a time', async () => {
      setup();
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));

      fireEvent.click(within(row('Aseo y cocina')).getByRole('button', { name: 'Cambiar nombre' }));

      expect(screen.queryByLabelText('Nuevo nombre de «Granos»')).toBeNull();
      expect(screen.getByLabelText('Nuevo nombre de «Aseo y cocina»')).toBeDefined();
    });
  });

  describe('deleting one', () => {
    it('asks first, and then deletes it', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');
      catalog.listAllCategories.mockResolvedValue([ASEO]);

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));
      expect(screen.getByText('¿Borrar «Granos»?')).toBeDefined();
      expect(catalog.deleteCategory).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('Borramos «Granos».')).toBeDefined();
      expect(catalog.deleteCategory).toHaveBeenCalledWith('granos');
      await waitFor(() => expect(names()).toEqual(['Aseo y cocina']));
    });

    it('can be cancelled', async () => {
      const { catalog } = setup();
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));

      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByText('¿Borrar «Granos»?')).toBeNull();
      expect(catalog.deleteCategory).not.toHaveBeenCalled();
    });

    it('says why it can not delete a category that still has products', async () => {
      const catalog = createFakeCatalog([], [GRANOS]);
      catalog.deleteCategory.mockRejectedValue(refused('category-in-use'));
      setup(catalog);
      await screen.findByText('Granos');

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('No se puede borrar «Granos»')).toBeDefined();
      expect(
        screen.getByText(
          'La categoría todavía tiene productos. Muévelos a otra categoría o archívalos antes de borrarla.',
        ),
      ).toBeDefined();
      expect(names()).toEqual(['Granos']);
    });

    it('says it could not delete when there is no connection', async () => {
      const catalog = createFakeCatalog([], [GRANOS]);
      catalog.deleteCategory.mockRejectedValue(network);
      setup(catalog);
      await screen.findByText('Granos');

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('No pudimos borrar «Granos»')).toBeDefined();
    });
  });

  describe('what goes away when the person does something else', () => {
    it('the server message about the new name, as soon as the person writes again', async () => {
      const catalog = createFakeCatalog([], [GRANOS]);
      catalog.createCategory.mockRejectedValue(network);
      setup(catalog);
      await screen.findByText('Granos');
      fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: 'Bebidas' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));
      await screen.findByText('No pudimos agregar la categoría');

      fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: 'Bebida' } });

      expect(screen.queryByText('No pudimos agregar la categoría')).toBeNull();
    });

    it('the question about deleting, when another category starts to be renamed', async () => {
      setup();
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));
      expect(screen.getByText('¿Borrar «Granos»?')).toBeDefined();

      fireEvent.click(within(row('Aseo y cocina')).getByRole('button', { name: 'Cambiar nombre' }));

      expect(screen.queryByText('¿Borrar «Granos»?')).toBeNull();
      expect(screen.getByLabelText('Nuevo nombre de «Aseo y cocina»')).toBeDefined();
    });

    it('the editor, when the person asks about deleting another category', async () => {
      setup();
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));
      expect(screen.getByLabelText('Nuevo nombre de «Granos»')).toBeDefined();

      fireEvent.click(within(row('Aseo y cocina')).getByRole('button', { name: 'Borrar' }));

      expect(screen.queryByLabelText('Nuevo nombre de «Granos»')).toBeNull();
      expect(screen.getByText('¿Borrar «Aseo y cocina»?')).toBeDefined();
    });

    it('why the last delete failed, when another category starts to be renamed', async () => {
      const catalog = createFakeCatalog([], [GRANOS, ASEO]);
      catalog.deleteCategory.mockRejectedValue(refused('category-in-use'));
      setup(catalog);
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
      await screen.findByText('No se puede borrar «Granos»');

      fireEvent.click(within(row('Aseo y cocina')).getByRole('button', { name: 'Cambiar nombre' }));

      expect(screen.queryByText('No se puede borrar «Granos»')).toBeNull();
    });

    it('why the last rename failed, when the person asks about deleting another category', async () => {
      const catalog = createFakeCatalog([], [GRANOS, ASEO]);
      catalog.renameCategory.mockRejectedValue(network);
      setup(catalog);
      await screen.findByText('Granos');
      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Cambiar nombre' }));
      fireEvent.change(screen.getByLabelText('Nuevo nombre de «Granos»'), {
        target: { value: 'Cereales' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
      // El titulo dice cual cambio no se hizo.
      await screen.findByText('No pudimos cambiar el nombre de «Granos»');

      fireEvent.click(within(row('Aseo y cocina')).getByRole('button', { name: 'Borrar' }));

      expect(screen.queryByText('No pudimos cambiar el nombre de «Granos»')).toBeNull();
    });
  });

  describe('while the list is asked again', () => {
    it('keeps the list it had, without the skeleton, and closes the question at once when it deletes', async () => {
      const catalog = createFakeCatalog([], [GRANOS, ASEO]);
      setup(catalog);
      await screen.findByText('Granos');
      const reloading = deferred<Category[]>();
      catalog.listAllCategories.mockReturnValue(reloading.promise);

      fireEvent.click(within(row('Granos')).getByRole('button', { name: 'Borrar' }));
      fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));

      expect(await screen.findByText('Borramos «Granos».')).toBeDefined();
      expect(screen.queryByText('¿Borrar «Granos»?')).toBeNull();
      expect(names()).toEqual(['Granos', 'Aseo y cocina']);
      expect(screen.queryByText(/Cargando categorías/)).toBeNull();
    });

    it('hides the list and says it could not load when asking again fails', async () => {
      const catalog = createFakeCatalog([], [GRANOS, ASEO]);
      setup(catalog);
      await screen.findByText('Granos');
      const reloading = deferred<Category[]>();
      catalog.listAllCategories.mockReturnValue(reloading.promise);
      fireEvent.change(screen.getByLabelText('Nueva categoría'), { target: { value: 'Bebidas' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar categoría' }));
      await screen.findByText('Agregamos «Bebidas».');

      await act(async () => {
        reloading.reject(network);
        await Promise.resolve();
      });

      expect(await screen.findByText('No pudimos cargar las categorías')).toBeDefined();
      expect(screen.queryByRole('list', { name: 'Categorías' })).toBeNull();
    });
  });
});
