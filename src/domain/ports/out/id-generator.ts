/** Puerto de salida: identificadores nuevos (UUID). La aplicacion no los inventa por su cuenta, para que las pruebas los controlen. */
export interface IdGenerator {
  newId(): string;
}
