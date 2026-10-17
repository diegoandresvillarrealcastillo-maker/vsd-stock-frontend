/**
 * Lo que el navegador cree de la conexion. Es solo una pista: que diga que hay
 * red no prueba que el servidor responda, y que diga que no hay red casi
 * siempre es cierto.
 */
export interface NetworkHints {
  isOnline(): boolean;
  /** Avisa cada vez que el navegador cambia de opinion. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: (online: boolean) => void): () => void;
}
