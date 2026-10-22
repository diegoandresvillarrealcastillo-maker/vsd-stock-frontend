/** Lo que Vite expone del entorno de compilacion (ver vite-env.d.ts). */
interface BuildEnvironment {
  VITE_AUTH_URL?: string | undefined;
  VITE_AUTH_PUBLISHABLE_KEY?: string | undefined;
  /** Verdadero con `npm run dev`. */
  DEV: boolean;
  /** El modo de compilacion (`vite build --mode e2e`): solo el de las pruebas en navegador tiene permiso de hablar http a esta maquina. */
  MODE?: string | undefined;
}

/**
 * El modo con el que se compila la web para las pruebas en navegador (`npm run build:e2e`, ADR 0030): es una version COMPILADA (tiene su
 * service worker, que es lo que se prueba) pero habla con el servicio de identidad de mentira, que escucha en http en esta maquina.
 */
const BROWSER_TEST_MODE = 'e2e';

export interface AuthConfig {
  /** La direccion de Supabase Auth, sin barra final. */
  readonly authUrl: string;
  /** La clave PUBLICABLE del proyecto: es publica por diseno, igual que el codigo que la lleva. */
  readonly publishableKey: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Si `key` es un token firmado (la clave "anonima" o "de servicio" del formato viejo), su reclamacion `role`. */
function roleOfLegacyKey(key: string): string | undefined {
  const parts = key.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload: unknown = JSON.parse(
      atob((parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')),
    );
    const role =
      typeof payload === 'object' && payload !== null
        ? (payload as { role?: unknown }).role
        : undefined;
    return typeof role === 'string' ? role : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Decide si hay servicio de identidad y a donde. Las dos variables van juntas o ninguna (ADR 0022): sin ninguna, la
 * aplicacion arranca y dice que no puede iniciar sesion. Una mal escrita detiene el arranque con un mensaje que la nombra
 * y no repite su valor. Lo que se compila en un navegador lo lee cualquiera, asi que una clave SECRETA se rechaza.
 */
export function resolveAuthConfig(env: BuildEnvironment): AuthConfig | null {
  const url = env.VITE_AUTH_URL?.trim() ?? '';
  const key = env.VITE_AUTH_PUBLISHABLE_KEY?.trim() ?? '';
  if (url === '' && key === '') return null;
  if (url === '') {
    throw new Error(
      'Falta VITE_AUTH_URL: la dirección del servicio de identidad va junto a VITE_AUTH_PUBLISHABLE_KEY.',
    );
  }
  if (key === '') {
    throw new Error(
      'Falta VITE_AUTH_PUBLISHABLE_KEY: la clave publicable va junto a VITE_AUTH_URL.',
    );
  }

  const development = env.DEV || env.MODE === BROWSER_TEST_MODE;
  return { authUrl: validatedUrl(url, development), publishableKey: validatedKey(key) };
}

function validatedUrl(value: string, development: boolean): string {
  const invalid = new Error(
    'VITE_AUTH_URL debe ser una dirección https sin credenciales, sin parámetros y sin #, por ejemplo ' +
      'https://REF.supabase.co/auth/v1',
  );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid;
  }
  const plain = url.username === '' && url.password === '' && url.search === '' && url.hash === '';
  if (!plain) throw invalid;
  if (url.protocol === 'https:') return value.replace(/\/+$/, '');
  // http solo en esta maquina y solo mientras se desarrolla: el token y la contrasena no viajan en claro por una red.
  if (url.protocol === 'http:' && development && LOCAL_HOSTS.has(url.hostname)) {
    return value.replace(/\/+$/, '');
  }
  throw invalid;
}

function validatedKey(value: string): string {
  if (/\s/.test(value)) {
    throw new Error(
      'VITE_AUTH_PUBLISHABLE_KEY no debe llevar espacios ni saltos de línea: revisa cómo se pegó.',
    );
  }
  if (value.startsWith('sb_secret_') || roleOfLegacyKey(value) === 'service_role') {
    // No se repite el valor: es justo lo que no debia estar aqui.
    throw new Error(
      'VITE_AUTH_PUBLISHABLE_KEY parece una clave secreta (secret / service_role). Lo que se compila en un navegador ' +
        'lo lee cualquiera: usa la clave publicable (sb_publishable_...) y cambia la secreta, que ya no es secreta.',
    );
  }
  return value;
}
