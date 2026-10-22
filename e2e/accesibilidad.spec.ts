import { expect, test } from '@playwright/test';
import { createAccount, openBusiness } from './support/api';
import {
  addProduct,
  goToAdmin,
  goToCounter,
  openCounter,
  openShift,
  sellCash,
  signIn,
  waitForCopy,
} from './support/app';
import { expectAccessible, expectTheme } from './support/axe';

// Cada pantalla, a 375 px, en tema claro y en tema oscuro (ADR 0030, punto 20). El tema lo da el navegador (`prefers-color-scheme`),
// como lo da en un telefono.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`accesibilidad en tema ${theme === 'light' ? 'claro' : 'oscuro'}`, () => {
    test.use({ colorScheme: theme });

    test('the screens before signing in', async ({ page }) => {
      await page.goto('/ingresar');
      await expectTheme(page, theme);
      await expectAccessible(page, 'Ingresar');

      // Con un error a la vista: el campo marcado y la frase que lo explica tambien tienen que verse bien.
      await page.getByRole('button', { name: 'Ingresar' }).click();
      await expect(page.getByText('Escribe tu correo.')).toBeVisible();
      await expectAccessible(page, 'Ingresar con errores');

      await page.getByRole('link', { name: 'Crear una' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectAccessible(page, 'Crear cuenta');
    });

    test('the counter screens, from opening the shift to a sale in the list', async ({ page }) => {
      const business = await openBusiness();
      await signIn(page, business.credentials);
      await expectTheme(page, theme);
      await openCounter(page);
      await expectAccessible(page, 'Vender sin turno');

      await goToCounter(page, 'Turno');
      await expectAccessible(page, 'Abrir turno');
      await openShift(page, 50_000);
      await expectAccessible(page, 'Turno abierto');

      await waitForCopy(page, 'arroz', 'Arroz 500 g');
      await expectAccessible(page, 'Vender, la venta vacia');
      await page.getByLabel('Buscar o leer un código').fill('arroz');
      await expect(page.getByRole('list', { name: 'Resultados de la búsqueda' })).toBeVisible();
      await expectAccessible(page, 'Vender, con resultados');
      await addProduct(page, 'arroz', 'Arroz 500 g');
      await expectAccessible(page, 'Vender, con la venta en curso');

      await page.getByRole('link', { name: 'Cobrar' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Cobrar' })).toBeAttached();
      await expectAccessible(page, 'Cobrar');
      await page.getByRole('button', { name: 'Exacto' }).click();
      await page.getByRole('button', { name: 'Confirmar venta' }).click();
      await expect(page.getByRole('heading', { level: 1, name: /^Venta / })).toBeVisible();
      await expectAccessible(page, 'Comprobante');
      await page.getByRole('button', { name: 'Nueva venta' }).click();

      await goToCounter(page, 'Ventas');
      await expect(page.getByRole('list', { name: 'Ventas' })).toBeVisible();
      await expectAccessible(page, 'Ventas, mi turno');
      await page.getByRole('link', { name: 'Todas' }).click();
      await expectAccessible(page, 'Ventas, todas');
      await page.getByRole('link', { name: /^Atención/ }).click();
      await expectAccessible(page, 'Ventas, atención');
      await page.getByRole('link', { name: 'Todas' }).click();
      await page.getByRole('list', { name: 'Ventas' }).getByRole('link').first().click();
      await expect(page.getByRole('group', { name: 'Comprobante' })).toBeVisible();
      await expectAccessible(page, 'Detalle de una venta');
      await page.getByRole('link', { name: 'Anular venta' }).click();
      await expectAccessible(page, 'Anular una venta');

      await goToCounter(page, 'Equipo');
      await expectAccessible(page, 'Equipo');
    });

    test('the administration screens', async ({ page }) => {
      const business = await openBusiness();
      await signIn(page, business.credentials);
      await expectTheme(page, theme);
      await expectAccessible(page, 'Inicio');

      await goToAdmin(page, 'Catálogo');
      await expect(page.getByRole('link', { name: /Arroz 500 g/ })).toBeVisible();
      await expectAccessible(page, 'Catálogo');
      await page.getByRole('link', { name: 'Nuevo producto' }).click();
      await expectAccessible(page, 'Nuevo producto');
      await goToAdmin(page, 'Catálogo');
      await page.getByRole('link', { name: 'Ver y cambiar categorías' }).click();
      await expectAccessible(page, 'Categorías');
      await page.getByRole('link', { name: 'Volver al catálogo' }).click();
      await page.getByRole('link', { name: /Arroz 500 g/ }).click();
      await expect(page.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Arroz 500 g');
      await expectAccessible(page, 'Editar un producto');

      await goToAdmin(page, 'Inventario');
      await expect(page.getByRole('link', { name: /Arroz 500 g/ })).toBeVisible();
      await expectAccessible(page, 'Existencias');
      await page.getByRole('link', { name: /Arroz 500 g/ }).click();
      await expect(page.getByRole('link', { name: 'Ajustar existencia' })).toBeVisible();
      await expectAccessible(page, 'Historial de existencias');
      await page.getByRole('link', { name: 'Ajustar existencia' }).click();
      await expectAccessible(page, 'Ajustar existencia');

      await goToAdmin(page, 'Compras');
      await expect(page.getByRole('link', { name: 'Nueva compra' })).toBeVisible();
      await expectAccessible(page, 'Compras');
      await page.getByRole('link', { name: 'Nueva compra' }).click();
      await expectAccessible(page, 'Nueva compra');
      await goToAdmin(page, 'Compras');
      await page.getByRole('link', { name: 'Ver y cambiar proveedores' }).click();
      await expectAccessible(page, 'Proveedores');

      await goToAdmin(page, 'Personas');
      await expect(page.getByRole('link', { name: /Ana Gómez/ })).toBeVisible();
      await expectAccessible(page, 'Personas');
      await page.getByRole('link', { name: 'Invitar a alguien' }).click();
      await expectAccessible(page, 'Invitar a alguien');
      await goToAdmin(page, 'Personas');
      await page.getByRole('link', { name: /Ana Gómez/ }).click();
      await expectAccessible(page, 'Una persona');
    });

    test('the screens of someone who has no business yet', async ({ page }) => {
      const credentials = await createAccount();
      await page.goto('/ingresar');
      await page.getByLabel('Correo').fill(credentials.email);
      await page.getByLabel('Contraseña').fill(credentials.password);
      await page.getByRole('button', { name: 'Ingresar' }).click();
      await expect(page).toHaveURL(/\/empezar$/);
      await expectTheme(page, theme);
      await expectAccessible(page, 'Empezar');

      await page.getByRole('link', { name: 'Usar mi código' }).click();
      await expect(page).toHaveURL(/\/invitacion$/);
      await expectAccessible(page, 'Usar una invitación');
    });

    test('the sale that needs attention and the shift being closed', async ({ page, context }) => {
      // «Pan tajado» sin existencias: venderlo se acepta y se marca «requiere ajuste» (ADR 0013).
      const business = await openBusiness([
        { name: 'Pan tajado', sku: 'PAN-001', unitPrice: 2_800, taxRateBp: 1_900, stock: 0 },
      ]);
      await signIn(page, business.credentials);
      await openCounter(page);
      await openShift(page, 10_000);
      await waitForCopy(page, 'pan', 'Pan tajado');
      await context.setOffline(true);
      await sellCash(page, [{ search: 'pan', name: 'Pan tajado' }]);
      await context.setOffline(false);

      await goToCounter(page, 'Ventas');
      await page.getByRole('link', { name: /^Atención/ }).click();
      const row = page.getByRole('list', { name: 'Ventas' }).getByRole('link').first();
      await expect(row).toBeVisible({ timeout: 40_000 });
      await expectAccessible(page, 'Ventas, la bandeja con una venta');
      await row.click();
      await expect(page.getByRole('button', { name: 'Marcar como revisada' })).toBeVisible();
      await expectAccessible(page, 'Detalle de una venta que pide atención');

      await goToCounter(page, 'Turno');
      await page.getByRole('link', { name: 'Cerrar turno' }).click();
      await expectAccessible(page, 'Cerrar turno');
    });
  });
}
