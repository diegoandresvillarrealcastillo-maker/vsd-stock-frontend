/** Donde se recuerda si la persona apago las mascotas. */
export interface MascotsStorage {
  /** Lo que la persona eligio la ultima vez, o `null` si nunca eligio o no se puede leer. */
  read(): boolean | null;
  /** Recuerda la eleccion. Si no se puede guardar, no falla: la eleccion vale para esta visita. */
  write(enabled: boolean): void;
}
