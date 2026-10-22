/**
 * Puerto de salida: quien trabajo por ultima vez en este dispositivo. Es solo un identificador (el mismo que da nombre a su base
 * local) y no un dato personal ni un secreto: sirve para ofrecer «continuar como...» al abrir la aplicacion (ADR 0022, punto 10).
 */
export interface PersonPointer {
  get(): string | null;
  set(authUserId: string): void;
  clear(): void;
}
