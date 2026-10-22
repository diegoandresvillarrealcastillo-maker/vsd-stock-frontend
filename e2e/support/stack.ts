import { resolve } from 'node:path';

// La pila que levantan las pruebas en navegador (C3-15, ADR 0030): una base de datos de trabajo, el servicio de identidad de
// mentira del backend, la API real y la web real ya compilada. Los puertos son raros a proposito para no chocar con los de
// `npm run dev` ni con un `npm start` que ya este corriendo.

/** El clon del backend: al lado de este repositorio, o donde diga `VSD_BACKEND_DIR` (en el CI se baja a una carpeta propia). */
export const BACKEND_DIR = resolve(process.env['VSD_BACKEND_DIR'] ?? '../vsd-stock-backend');

/** El puerto de la base de trabajo del backend: 5433 con `npm run db:up`, 5432 con el servicio de PostgreSQL del CI. */
const DATABASE_PORT = process.env['E2E_DB_PORT'] ?? '5433';

export const PORTS = { identity: 54329, api: 3129, web: 4129 } as const;

export const URLS = {
  identity: `http://127.0.0.1:${String(PORTS.identity)}/auth/v1`,
  api: `http://127.0.0.1:${String(PORTS.api)}`,
  web: `http://localhost:${String(PORTS.web)}`,
} as const;

/** La clave publicable de mentira con que el servicio de identidad de pruebas reconoce a la web. Nunca una secreta. */
export const FAKE_PUBLISHABLE_KEY = 'sb_publishable_desarrollo_local';

/** La base que se deja con el esquema real (la borra y la vuelve a crear: es de trabajo y local). */
export const PREPARE_DATABASE_URL = `postgresql://stock@127.0.0.1:${DATABASE_PORT}/stock_test`;

/** Con lo que la API se conecta: el rol de la aplicacion, sin privilegios de dueno. */
export const APPLICATION_DATABASE_URL = `postgresql://stock_app@127.0.0.1:${DATABASE_PORT}/stock_test`;
