/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Direccion de la API, fijada al compilar. Ver `resolveApiBaseUrl`. */
  readonly VITE_API_URL?: string;
  /** Direccion de Supabase Auth, fijada al compilar. Ver `resolveAuthConfig`. */
  readonly VITE_AUTH_URL?: string;
  /** La clave publicable de Supabase (`sb_publishable_...`). Nunca la secreta. */
  readonly VITE_AUTH_PUBLISHABLE_KEY?: string;
}
