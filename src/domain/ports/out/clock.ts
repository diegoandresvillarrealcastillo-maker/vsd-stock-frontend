/** Puerto de salida: la hora. La aplicacion nunca llama a `Date.now()` por su cuenta, para que las pruebas la controlen. */
export interface Clock {
  now(): Date;
}
