/**
 * Si el navegador protege lo guardado en el dispositivo de borrarlo por falta de espacio (C3-07, ADR 0018 y 0030).
 *
 * - `unknown`: todavia no se ha preguntado.
 * - `protected`: el navegador prometio no borrar lo guardado (almacenamiento persistente).
 * - `not-protected`: el navegador lo puede borrar si se queda sin espacio. Las ventas sin enviar correrian ese riesgo,
 *   asi que la aplicacion lo dice y pide sincronizar pronto.
 * - `unsupported`: el navegador no sabe de almacenamiento persistente.
 */
export type StorageProtection = 'unknown' | 'protected' | 'not-protected' | 'unsupported';
