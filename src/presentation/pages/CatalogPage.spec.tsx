import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../domain/model/api-error';
import type { Role } from '../../domain/model/permissions';
import { createTestAuth, testMe, testSession } from '../../../test/support/auth';
import {
  createFakeCatalog,
  lastPage,
  testCategory,
  testProduct,
} from '../../../test/support/catalog';
import { renderScreen } from '../../../test/support/screens';
import { CatalogPage } from './CatalogPage';

const ARROZ = testProduct({ id: 'arroz', name: 'Arroz 500 g', sku: 'ARR-500', unitPrice: 3200 });
const ACEITE = testProduct({
  id: 'aceite',
  name: 'Aceite 1 L',
  sku: 'ACE-1L',
  unitPrice: 12_500,
  categoryId: 'aseo',
});
const PANELA = testProduct({
  id: 'panela',
  name: 'Panela',
  sku: 'PAN-1',
  unitPrice: 2800,
  categoryId: null,
});
const VIEJO = testProduct({
  id: 'viejo',
  name: 'Arroz Diana 500 g',
  sku: 'ARR-500-D',
  unitPrice: 3100,
  active: false,
});
const CATEGORIES = [
  testCategory({ id: 'c-1', name: 'Granos' }),
  testCategory({ id: 'aseo', name: 'Aseo y cocina' }),
];

function setup(
  role: Role = 'owner',
  catalog = createFakeCatalog([ARROZ, ACEITE, PANELA, VIEJO], CATEGORIES),
) {
  const auth = createTestAuth({ stored: testSession('ana') });
  auth.answer(testMe('ana', role));
  const view = renderScreen(<CatalogPage />, { path: '/catalogo', auth, catalog });
  return { ...view, catalog };
}

const failure = new ApiError({ class: 'network', status: null, problem: null, retryAfterMs: null });
const rows = () => within(screen.getByRole('list', { name: 'Productos' })).getAllByRole('listitem');
const search = (text: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), { target: { value: text } });
  fireEvent.submit(screen.getByRole('search'));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('CatalogPage', () => {
  it('says it is loading while the products arrive', async () => {
    setup();

    expect(screen.getByRole('status').textContent).toContain('Cargando productos');
    await screen.findByText('Arroz 500 g');
  });

  it('asks for the active products first', async () => {
    const { catalog } = setup();
    await screen.findByText('Arroz 500 g');

    expect(catalog.listProducts).toHaveBeenCalledWith({ active: true });
    expect(screen.getByRole('button', { name: 'Activos' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('lists each product with its price, its SKU and its category', async () => {
    setup();

    await screen.findByText('Arroz 500 g');

    expect(rows()[0]?.textContent).toContain('Arroz 500 g');
    expect(rows()[0]?.textContent).toContain('$ 3.200');
    expect(rows()[0]?.textContent).toContain('ARR-500 · Granos');
    expect(rows()[1]?.textContent).toContain('$ 12.500');
    expect(rows()[1]?.textContent).toContain('ACE-1L · Aseo y cocina');
    expect(rows()[2]?.textContent).toContain('PAN-1 · Sin categoría');
  });

  it('marks an archived product', async () => {
    setup();
    await screen.findByText('Arroz 500 g');

    expect(rows()[3]?.textContent).toContain('Archivado');
    expect(rows()[0]?.textContent).not.toContain('Archivado');
  });

  it('shows the SKU alone while it does not know the names of the categories', async () => {
    const catalog = createFakeCatalog([ARROZ], CATEGORIES);
    catalog.listAllCategories.mockRejectedValue(failure);
    setup('owner', catalog);

    await screen.findByText('Arroz 500 g');

    expect(rows()[0]?.textContent).toContain('ARR-500');
    expect(rows()[0]?.textContent).not.toContain('Sin categoría');
    expect(rows()[0]?.textContent).not.toContain('Granos');
  });

  it('takes whoever manages the catalog to the detail of the row', async () => {
    setup();

    const link = await screen.findByRole('link', { name: /Aceite 1 L/ });

    expect(link.getAttribute('href')).toBe('/catalogo/aceite');
  });

  it('encodes the id of the product in the address', async () => {
    setup('owner', createFakeCatalog([testProduct({ id: 'a/b', name: 'Raro' })], CATEGORIES));

    const link = await screen.findByRole('link', { name: /Raro/ });

    expect(link.getAttribute('href')).toBe('/catalogo/a%2Fb');
  });

  it('lets the cashier see the products but not open them, create them or touch the categories', async () => {
    setup('cashier');
    await screen.findByText('Arroz 500 g');

    expect(screen.queryByRole('link', { name: /Arroz 500 g/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nuevo producto' })).toBeNull();
    expect(screen.queryByRole('link', { name: /categorías/i })).toBeNull();
    expect(rows()[0]?.textContent).toContain('$ 3.200');
  });

  it('offers the manager to create a product and to see the categories', async () => {
    setup('admin');
    await screen.findByText('Arroz 500 g');

    expect(screen.getByRole('link', { name: 'Nuevo producto' }).getAttribute('href')).toBe(
      '/catalogo/nuevo',
    );
    expect(
      screen.getByRole('link', { name: /Ver y cambiar categorías/ }).getAttribute('href'),
    ).toBe('/catalogo/categorias');
  });

  describe('looking for a product', () => {
    it('asks the server for what was typed when the person sends the search', async () => {
      const { catalog } = setup();
      await screen.findByText('Arroz 500 g');

      search('  arroz ');

      await screen.findByText('Arroz 500 g');
      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: true, search: 'arroz' });
    });

    it('asks by itself once the person stops typing', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { catalog } = setup();
      await screen.findByText('Arroz 500 g');

      fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), {
        target: { value: 'aceite' },
      });
      expect(catalog.listProducts).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: true, search: 'aceite' });
    });

    it('does not ask again for every key: only for the last thing typed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { catalog } = setup();
      await screen.findByText('Arroz 500 g');
      const box = screen.getByRole('searchbox', { name: 'Buscar' });

      fireEvent.change(box, { target: { value: 'a' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      fireEvent.change(box, { target: { value: 'ac' } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(catalog.listProducts).toHaveBeenCalledTimes(2);
      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: true, search: 'ac' });
    });

    it('says there is nothing for that search, and says what was searched', async () => {
      const { catalog } = setup();
      await screen.findByText('Arroz 500 g');
      catalog.listProducts.mockResolvedValue(lastPage([]));

      search('zzz');

      expect(await screen.findByText(/No encontramos productos con «zzz»/)).toBeDefined();
    });

    it('filters by the state of the product', async () => {
      const { catalog } = setup();
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Archivados' }));
      await screen.findByText('Arroz 500 g');
      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: false });
      expect(screen.getByRole('button', { name: 'Archivados' }).getAttribute('aria-pressed')).toBe(
        'true',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      await screen.findByText('Arroz 500 g');
      expect(catalog.listProducts).toHaveBeenLastCalledWith({});
    });

    it('keeps the search when the state changes', async () => {
      const { catalog } = setup();
      await screen.findByText('Arroz 500 g');
      search('arroz');
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
      await screen.findByText('Arroz 500 g');

      expect(catalog.listProducts).toHaveBeenLastCalledWith({ search: 'arroz' });
    });
  });

  describe('when there are no products', () => {
    it('invites the manager to create the first one', async () => {
      setup('owner', createFakeCatalog([], CATEGORIES));

      expect(await screen.findByText('Todavía no tienes productos.')).toBeDefined();
      expect(screen.getAllByRole('link', { name: 'Nuevo producto' })).toHaveLength(1);
    });

    it('tells the cashier to ask for them, without a way to create them', async () => {
      setup('cashier', createFakeCatalog([], CATEGORIES));

      expect(
        await screen.findByText(
          'Todavía no hay productos. Pídele a quien administra que los cree.',
        ),
      ).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Nuevo producto' })).toBeNull();
    });
  });

  describe('paging', () => {
    it('loads more when the server says there are more, and keeps what was already shown', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.listProducts
        .mockResolvedValueOnce({ items: [ARROZ], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [ACEITE], nextCursor: null });
      setup('owner', catalog);
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText('Aceite 1 L')).toBeDefined();
      expect(screen.getByText('Arroz 500 g')).toBeDefined();
      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: true }, 'c1');
      expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
    });

    it('keeps asking with the cursor of the last page it got', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.listProducts
        .mockResolvedValueOnce({ items: [ARROZ], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [ACEITE], nextCursor: 'c2' })
        .mockResolvedValueOnce({ items: [PANELA], nextCursor: null });
      setup('owner', catalog);
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await screen.findByText('Aceite 1 L');
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await screen.findByText('Panela');

      expect(catalog.listProducts).toHaveBeenLastCalledWith({ active: true }, 'c2');
      expect(rows()).toHaveLength(3);
    });

    it('says why it could not load more, and lets the person try again', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.listProducts
        .mockResolvedValueOnce({ items: [ARROZ], nextCursor: 'c1' })
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce({ items: [ACEITE], nextCursor: null });
      setup('owner', catalog);
      await screen.findByText('Arroz 500 g');

      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      expect(await screen.findByText('No pudimos cargar más')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));

      expect(await screen.findByText('Aceite 1 L')).toBeDefined();
      expect(screen.queryByText('No pudimos cargar más')).toBeNull();
    });

    it('forgets what it loaded when the search changes', async () => {
      const catalog = createFakeCatalog([], CATEGORIES);
      catalog.listProducts
        .mockResolvedValueOnce({ items: [ARROZ], nextCursor: 'c1' })
        .mockResolvedValueOnce({ items: [ACEITE], nextCursor: null })
        .mockResolvedValueOnce({ items: [PANELA], nextCursor: null });
      setup('owner', catalog);
      await screen.findByText('Arroz 500 g');
      fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }));
      await screen.findByText('Aceite 1 L');

      search('pan');

      await screen.findByText('Panela');
      expect(screen.queryByText('Aceite 1 L')).toBeNull();
      expect(screen.queryByText('Arroz 500 g')).toBeNull();
    });
  });

  describe('when something goes wrong', () => {
    it('says it could not load, and loads again when asked', async () => {
      const catalog = createFakeCatalog([ARROZ], CATEGORIES);
      catalog.listProducts.mockRejectedValueOnce(failure);
      setup('owner', catalog);

      expect(await screen.findByText('No pudimos cargar el catálogo')).toBeDefined();
      expect(screen.getByText(/No hay conexión con el servidor/)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(await screen.findByText('Arroz 500 g')).toBeDefined();
    });
  });

  describe('after saving', () => {
    it('shows the notice that the previous screen left', async () => {
      const auth = createTestAuth({ stored: testSession('ana') });
      auth.answer(testMe('ana', 'owner'));
      renderScreen(<CatalogPage />, {
        path: '/catalogo',
        state: { notice: 'Guardamos «Arroz 500 g».' },
        auth,
        catalog: createFakeCatalog([ARROZ], CATEGORIES),
      });

      expect(await screen.findByText('Guardamos «Arroz 500 g».')).toBeDefined();
    });
  });
});
