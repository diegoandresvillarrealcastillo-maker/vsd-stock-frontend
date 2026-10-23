/** Lo que la interfaz puede hacer con las mascotas (C4-M3): saber si se ven, apagarlas o volverlas a encender, y enterarse de los cambios. */
export interface MascotsPreference {
  /** `true` si las mascotas se ven. Por omision se ven: son parte del producto. */
  enabled(): boolean;
  /** Las apaga si se ven, o las enciende si no, y lo recuerda. Devuelve el valor nuevo. */
  toggle(): boolean;
  /** Avisa cada vez que cambia. Devuelve la funcion para dejar de escuchar. */
  subscribe(listener: (enabled: boolean) => void): () => void;
}
