/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Direccion de la API, fijada al compilar. Ver `resolveApiBaseUrl`. */
  readonly VITE_API_URL?: string;
}
