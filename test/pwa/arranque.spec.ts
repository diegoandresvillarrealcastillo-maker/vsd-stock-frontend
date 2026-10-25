import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// C4-R0: el mostrador y el arranque no pagan el peso de la administracion. La medida de verdad es `npm run budget` (el arranque tiene
// su presupuesto aparte); estas pruebas vigilan la INTENCION donde se decide: que pantallas bajan solo cuando alguien entra a ellas y
// cuales viajan con el arranque, para que una pantalla nueva no se cuele sin que alguien decida a cual lado va.

const routes = readFileSync('src/presentation/routes/AppRoutes.tsx', 'utf8');
const shell = readFileSync('src/presentation/shell/AppShell.tsx', 'utf8');
const administration = readFileSync('src/presentation/pages/administration.ts', 'utf8');

/** Las pantallas del marco de administracion: bajan juntas, en un solo archivo, cuando alguien entra a cualquiera de ellas. */
const ON_DEMAND = [
  'HomePage',
  'CatalogPage',
  'NewProductPage',
  'CategoriesPage',
  'EditProductPage',
  'StockPage',
  'StockHistoryPage',
  'AdjustStockPage',
  'PurchasesPage',
  'MonthlyReportPage',
  'NewPurchasePage',
  'SuppliersPage',
  'PeoplePage',
  'InvitePage',
  'PersonPage',
];

/** Las que viajan con el arranque: entrar, empezar, el mostrador (vender, cobrar, turno, ventas) y lo que la guarda necesita. */
const WITH_THE_START = [
  'SignInPage',
  'SignUpPage',
  'OnboardingPage',
  'RedeemPage',
  'SellPage',
  'PayPage',
  'ReceiptPage',
  'CounterPage',
  'ShiftPage',
  'CloseShiftPage',
  'SalesPage',
  'SaleDetailPage',
  'VoidSalePage',
  'NotFoundPage',
  'ForbiddenPage',
];

const staticImport = (page: string) =>
  new RegExp(String.raw`import\s*\{[^}]*\b${page}\b[^}]*\}\s*from\s*'`);
const lazyRoute = (page: string) =>
  new RegExp(String.raw`lazyScreen\(\s*administration,\s*'${page}'\s*\)`);

describe('what travels with the start and what waits for a screen (C4-R0)', () => {
  it.each(ON_DEMAND)('%s is downloaded when someone goes to it, not with the start', (page) => {
    expect(routes).not.toMatch(staticImport(page));
    expect(routes).toMatch(lazyRoute(page));
    expect(administration).toContain(`export { ${page} } from './${page}';`);
  });

  it.each(WITH_THE_START)('%s travels with the start', (page) => {
    expect(administration).not.toContain(page);
    // La guarda trae ForbiddenPage: las rutas no la nombran.
    if (page !== 'ForbiddenPage') expect(routes).toMatch(staticImport(page));
  });

  it('has a place for every page there is: a new page is not left without deciding which side it goes to', () => {
    const pages = readdirSync('src/presentation/pages')
      .filter((name) => /Page\.tsx$/.test(name))
      .map((name) => name.replace('.tsx', ''))
      .sort();

    expect([...ON_DEMAND, ...WITH_THE_START].sort()).toEqual(pages);
  });

  it('downloads the administration with ONE import: twenty small files, each compressed on its own, weighed more than one', () => {
    const imports = routes.match(/import\(\s*'[^']+'\s*\)/g) ?? [];

    expect(imports).toEqual(["import('../pages/administration')"]);
    expect(routes).not.toMatch(/from\s*'\.\.\/pages\/administration'/);
  });

  it('gives the on-demand screens a place to wait and a way out when one does not arrive', () => {
    // Una pantalla perezosa sin esto deja la pagina en blanco: la espera y el aviso viven en el marco, una sola vez.
    expect(shell).toContain('<ScreenLoader');
  });
});
