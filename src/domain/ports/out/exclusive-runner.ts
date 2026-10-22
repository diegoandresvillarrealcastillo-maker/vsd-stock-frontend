/**
 * Puerto de salida: hacer algo SOLO si nadie mas lo esta haciendo, entre todas las pestañas del navegador (ADR 0009: una sola
 * sincronizacion a la vez). Si otra pestaña ya lo hace, no espera: responde `ran: false` y la otra termina el trabajo.
 */
export interface ExclusiveRunner {
  runIfFree<T>(
    name: string,
    work: () => Promise<T>,
  ): Promise<{ ran: true; value: T } | { ran: false }>;
}
