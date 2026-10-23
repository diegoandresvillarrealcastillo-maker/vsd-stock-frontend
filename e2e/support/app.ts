import { expect, type Locator, type Page } from '@playwright/test';
import type { Credentials } from './api';

// Lo que una persona hace con la pantalla, dicho como ella lo dice: entrar, abrir turno, vender, mirar lo que esta pendiente. Todo se
// hace con lo que se VE (nombres accesibles y textos), no con clases ni identificadores: si la pantalla cambia de apariencia, las
// pruebas siguen; si cambia lo que dice, fallan, que es lo que tiene que pasar.

export type CounterSection = 'Mostrador' | 'Turno' | 'Ventas' | 'Equipo';

/** Entra con correo y contrasena y espera a ver el inicio. La sesion vive solo en la memoria de esta pestaña (ADR 0022). */
export async function signIn(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/ingresar');
  await page.getByLabel('Correo').fill(credentials.email);
  await page.getByLabel('Contraseña').fill(credentials.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
}

export type AdminSection =
  'Inicio' | 'Catálogo' | 'Inventario' | 'Compras' | 'Reportes' | 'Personas';

/** Una de las pantallas del menu de la administracion (no se recarga la pagina: la sesion vive solo en la memoria). */
export async function goToAdmin(page: Page, section: AdminSection): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: section, exact: true })
    .click();
}

/** Desde el inicio de la administracion al mostrador. */
export async function openCounter(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Ir al mostrador' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vender' })).toBeVisible();
}

/** Una de las pantallas del menu del mostrador. El nombre de «Ventas» puede llevar el numero de las que piden atencion. */
export async function goToCounter(page: Page, section: CounterSection): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Mostrador' })
    .getByRole('link', { name: new RegExp(`^${section}`) })
    .click();
}

/** Abre el turno de caja con el efectivo que hay. Sin conexion tambien se puede: todo queda en este equipo. */
export async function openShift(page: Page, cash: number): Promise<void> {
  await goToCounter(page, 'Turno');
  await page.getByLabel('Efectivo inicial').fill(String(cash));
  await page.getByRole('button', { name: 'Abrir turno' }).click();
  await expect(page.getByText(/Abierto desde las/)).toBeVisible();
}

/** La linea de arriba que dice lo que esta enviado y lo que no. */
export function syncStatus(page: Page): Locator {
  return page.locator('main').getByRole('status').first();
}

/**
 * Espera a que la copia de lectura (catalogo y existencias) ya este en este equipo: sin ella no hay nada que buscar sin conexion.
 * Hay que esperarla ANTES de cortar la red.
 */
export async function waitForCopy(page: Page, search: string, name: string): Promise<void> {
  await goToCounter(page, 'Mostrador');
  await page.getByLabel('Buscar o leer un código').fill(search);
  await expect(resultOf(page, name)).toBeVisible();
  await page.getByLabel('Buscar o leer un código').fill('');
}

function resultOf(page: Page, name: string): Locator {
  return page
    .getByRole('list', { name: 'Resultados de la búsqueda' })
    .getByRole('button', { name: new RegExp(name) });
}

/** Agrega a la venta en curso el producto que se busca con ese texto. */
export async function addProduct(page: Page, search: string, name: string): Promise<void> {
  await page.getByLabel('Buscar o leer un código').fill(search);
  await resultOf(page, name).click();
  await expect(
    page.getByRole('list', { name: 'Venta en curso' }).getByText(name, { exact: true }),
  ).toBeVisible();
}

export interface Item {
  /** Lo que se escribe en el buscador. */
  readonly search: string;
  /** El nombre del producto, como sale en la lista. */
  readonly name: string;
}

/**
 * Una venta completa en efectivo, pagada exacto: busca cada producto, cobra, confirma y vuelve a la venta vacia. Devuelve el folio que
 * la pantalla dio al instante.
 */
export async function sellCash(page: Page, items: readonly Item[]): Promise<string> {
  await goToCounter(page, 'Mostrador');
  for (const item of items) await addProduct(page, item.search, item.name);
  await page.getByRole('link', { name: 'Cobrar' }).click();
  await page.getByRole('button', { name: 'Exacto' }).click();
  await page.getByRole('button', { name: 'Confirmar venta' }).click();
  const heading = page.getByRole('heading', { level: 1, name: /^Venta [A-Z]{2}-\d{6}$/ });
  await expect(heading).toBeVisible();
  const folio = ((await heading.textContent()) ?? '').replace('Venta ', '').trim();
  await page.getByRole('button', { name: 'Nueva venta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vender' })).toBeVisible();
  return folio;
}
