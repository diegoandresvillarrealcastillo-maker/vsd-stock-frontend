/** Puerto de salida: la proteccion del almacenamiento del dispositivo contra el borrado automatico del navegador (C3-07). */
export interface PersistentStorage {
  /** `false` si el navegador no sabe de almacenamiento persistente. */
  isSupported(): boolean;
  /** Si lo guardado ya esta protegido. */
  isPersisted(): Promise<boolean>;
  /** Pide la proteccion. El navegador decide: puede negarla (a veces la concede solo a una aplicacion instalada). */
  request(): Promise<boolean>;
}
