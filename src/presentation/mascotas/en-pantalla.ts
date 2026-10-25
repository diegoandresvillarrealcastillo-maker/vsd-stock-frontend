import type { Estado, Personaje } from '../assets/mascotas/mascotas';

/**
 * Las caras que la aplicacion muestra (C4-M3) y en que estado: Ori en el panel de la conexion, Ojo de Gato al cerrar el turno
 * y Fungito en el catalogo vacio. Son datos puros, sin React ni imagenes, para que las pruebas de Node los lean sin arrastrar
 * el empaquetador; las direcciones estan en `imagenes-de-pantalla.ts`.
 *
 * Cada cara de mas se baja al instalar la aplicacion (el service worker guarda todo `dist/`), asi que aqui no hay "por si
 * acaso": se agrega una cuando una pantalla la usa y su estado ya es verdad (`YA_CORRESPONDEN`).
 */
export const EN_PANTALLA = {
  ori: ['normal', 'dormida'],
  gato: ['normal', 'feliz', 'dormida'],
  fungito: ['dormida'],
} as const satisfies Partial<Record<Personaje, readonly Estado[]>>;

export type PersonajeEnPantalla = keyof typeof EN_PANTALLA;
export type EstadoEnPantalla<P extends PersonajeEnPantalla> = (typeof EN_PANTALLA)[P][number];
