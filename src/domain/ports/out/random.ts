/** Puerto de salida: el azar. La aplicacion nunca llama a `Math.random()` por su cuenta, para que las pruebas lo controlen. */
export interface Random {
  /** Un numero de 0 (incluido) a 1 (excluido). */
  next(): number;
}
