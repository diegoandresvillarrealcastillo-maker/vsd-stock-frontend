import { randomUUID } from 'node:crypto';
import { URLS } from './stack';

// Lo que las pruebas en navegador hacen DIRECTO contra la API real, sin pasar por la pantalla: preparar un negocio con sus productos
// y mirar, al final, lo que el servidor guardo. Mirar el servidor y no la pantalla es lo que dice si una venta llego una sola vez.

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface ProductSeed {
  readonly name: string;
  readonly sku: string;
  /** Pesos enteros, con el IVA incluido. */
  readonly unitPrice: number;
  readonly taxRateBp?: 0 | 500 | 1900;
  /** Existencia inicial en unidades enteras. */
  readonly stock?: number;
}

export interface SeededProduct {
  readonly id: string;
  readonly name: string;
  readonly sku: string;
  readonly unitPrice: number;
}

export interface Business {
  readonly credentials: Credentials;
  readonly ownerName: string;
  readonly businessName: string;
  readonly products: readonly SeededProduct[];
  /** El token de la dueña, para preguntar al servidor lo que paso. Dura una hora: sobra para una prueba. */
  readonly token: string;
}

export interface ServerSale {
  readonly id: string;
  readonly operationId: string;
  readonly shiftId: string;
  readonly deviceId: string | null;
  readonly folio: string;
  readonly folioReported: string;
  readonly folioConflict: boolean;
  readonly total: number;
  readonly needsAdjustment: boolean;
  readonly attention: boolean;
  /** `null` mientras no este anulada; con el folio propio de la anulacion cuando lo esta (ADR 0036 del backend). */
  readonly voided: { readonly folio: string } | null;
}

export interface ServerStock {
  readonly productId: string;
  readonly name: string;
  readonly quantityMilli: number;
}

export interface ServerShift {
  readonly id: string;
  readonly deviceId: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly openingAmount: number;
}

interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`HTTP ${String(status)}: ${body.slice(0, 300)}`);
  }
}

async function request<T>(
  url: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
      apikey: 'sb_publishable_desarrollo_local',
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  if (!response.ok) throw new ApiProblem(response.status, text);
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

/** Un correo que nadie ha usado: cada prueba abre su propio negocio y no se cruza con las otras. */
export function newCredentials(prefix = 'ana'): Credentials {
  return {
    email: `${prefix}-${randomUUID().slice(0, 8)}@example.com`,
    password: 'clave-de-prueba',
  };
}

async function signUp(credentials: Credentials): Promise<{ token: string }> {
  const session = await request<{ access_token: string }>(`${URLS.identity}/signup`, {
    body: credentials,
  });
  return { token: session.access_token };
}

/** Un token nuevo de una cuenta que ya existe. */
export async function tokenOf(credentials: Credentials): Promise<string> {
  const session = await request<{ access_token: string }>(
    `${URLS.identity}/token?grant_type=password`,
    { body: credentials },
  );
  return session.access_token;
}

/** Una cuenta que todavia no tiene negocio: al entrar, la web le ofrece crear uno o usar una invitacion. */
export async function createAccount(): Promise<Credentials> {
  const credentials = newCredentials();
  await signUp(credentials);
  return credentials;
}

export const BASIC_PRODUCTS: readonly ProductSeed[] = [
  { name: 'Arroz 500 g', sku: 'ARR-500', unitPrice: 3_200, taxRateBp: 0, stock: 100 },
  { name: 'Pan tajado', sku: 'PAN-001', unitPrice: 2_800, taxRateBp: 1_900, stock: 100 },
  { name: 'Leche 1 L', sku: 'LEC-1L', unitPrice: 4_500, taxRateBp: 500, stock: 100 },
];

/** Abre un negocio nuevo con su dueña, sus productos y su existencia inicial, todo por la API. */
export async function openBusiness(
  seeds: readonly ProductSeed[] = BASIC_PRODUCTS,
): Promise<Business> {
  const credentials = newCredentials();
  const { token } = await signUp(credentials);
  const ownerName = 'Ana Gómez';
  const businessName = `Tienda ${randomUUID().slice(0, 6)}`;
  await request(`${URLS.api}/v1/businesses`, { token, body: { businessName, ownerName } });
  const products: SeededProduct[] = [];
  for (const seed of seeds) {
    const product = await request<{ id: string }>(`${URLS.api}/v1/products`, {
      token,
      body: {
        name: seed.name,
        sku: seed.sku,
        unit: 'unit',
        unitPrice: seed.unitPrice,
        taxRateBp: seed.taxRateBp ?? 0,
        // El servidor no adivina el tipo (ADR 0034): con IVA, gravado; sin el, exento.
        taxKind: (seed.taxRateBp ?? 0) === 0 ? 'exempt' : 'taxed',
      },
    });
    if ((seed.stock ?? 0) > 0) {
      await request(`${URLS.api}/v1/stock-adjustments`, {
        token,
        body: {
          operationId: randomUUID(),
          productId: product.id,
          deltaMilli: (seed.stock ?? 0) * 1_000,
          reason: 'Existencia inicial',
        },
      });
    }
    products.push({ id: product.id, name: seed.name, sku: seed.sku, unitPrice: seed.unitPrice });
  }
  return { credentials, ownerName, businessName, products, token };
}

async function allPages<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const separator = path.includes('?') ? '&' : '?';
    const page: Page<T> = await request<Page<T>>(
      `${URLS.api}${path}${separator}limit=100${cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`}`,
      { token },
    );
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return items;
}

/** Todas las ventas que el servidor tiene del negocio. */
export function serverSales(business: Business): Promise<ServerSale[]> {
  return allPages<ServerSale>('/v1/sales', business.token);
}

export interface ServerSaleLine {
  readonly productId: string;
  readonly taxRateBp: number;
  readonly taxKind: 'taxed' | 'exempt' | 'excluded';
}

/** Las lineas de una venta como el servidor las guardo, con la tarifa y el tipo con que se vendieron. */
export async function serverSaleLines(
  business: Business,
  saleId: string,
): Promise<ServerSaleLine[]> {
  const sale = await request<{ lines: ServerSaleLine[] }>(`${URLS.api}/v1/sales/${saleId}`, {
    token: business.token,
  });
  return sale.lines;
}

/** La existencia que el servidor tiene de cada producto. */
export function serverStock(business: Business): Promise<ServerStock[]> {
  return allPages<ServerStock>('/v1/stock', business.token);
}

/** Los turnos que el servidor conoce. */
export function serverShifts(business: Business): Promise<ServerShift[]> {
  return allPages<ServerShift>('/v1/shifts', business.token);
}

export interface ServerShiftCash {
  readonly id: string;
  readonly deviceId: string;
  readonly openingAmount: number;
  readonly summary: {
    readonly cashSales: number;
    readonly expectedAmount: number;
  };
}

/** Un turno con su arqueo: lo que el servidor calcula que debe haber en la caja. */
export function serverShiftCash(business: Business, shiftId: string): Promise<ServerShiftCash> {
  return request<ServerShiftCash>(`${URLS.api}/v1/shifts/${shiftId}`, { token: business.token });
}

/** Los codigos de los dispositivos del negocio (`AA`, `AB`…), en el orden en que se registraron. */
export async function deviceCodes(business: Business): Promise<string[]> {
  const devices = await allPages<{ code: string; enrolledAt: string }>(
    '/v1/devices',
    business.token,
  );
  return devices
    .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt))
    .map((device) => device.code);
}

/** Cuantas veces el servidor tiene cada identificador de operacion: todas deberian ser una. */
export function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}
