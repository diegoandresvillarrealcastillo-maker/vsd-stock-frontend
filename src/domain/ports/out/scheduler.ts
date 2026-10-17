/** Ejecuta algo despues de un tiempo. Existe para que el tiempo se pueda controlar en las pruebas. */
export interface Scheduler {
  /** Devuelve la forma de cancelarlo. */
  schedule(callback: () => void, delayMs: number): () => void;
}
