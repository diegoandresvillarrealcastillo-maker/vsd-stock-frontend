/** Lo que Vite expone del entorno de compilacion (ver vite-env.d.ts). */
interface BuildEnvironment {
  VITE_API_URL?: string | undefined;
  /** Verdadero con `npm run dev`. */
  DEV: boolean;
}

/** La API que se levanta en la maquina de quien desarrolla (backend, puerto 3000). */
const LOCAL_API = 'http://localhost:3000';

/**
 * Decide a que servidor le habla la aplicacion. `VITE_API_URL` lo fija al
 * compilar. Sin ella, `npm run dev` apunta a la API local y una version
 * compilada usa el mismo origen que la sirve (devuelve vacio).
 *
 * Una direccion mal escrita detiene el arranque con un mensaje que nombra la
 * variable: es mejor eso que una aplicacion que dice "sin conexion" sin motivo.
 */
export function resolveApiBaseUrl(env: BuildEnvironment): string {
  const configured = env.VITE_API_URL?.trim() ?? '';
  if (configured === '') {
    return env.DEV ? LOCAL_API : '';
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw invalid();
  }
  const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
  const isPlain =
    url.username === '' && url.password === '' && url.search === '' && url.hash === '';
  if (!isWeb || !isPlain) {
    throw invalid();
  }
  return configured.replace(/\/+$/, '');
}

// El mensaje no repite el valor: podria llevar credenciales.
function invalid(): Error {
  return new Error(
    'VITE_API_URL debe ser una dirección http o https sin credenciales, sin parámetros y sin ' +
      '#, por ejemplo https://api.example.com',
  );
}
