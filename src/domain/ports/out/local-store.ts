import type { LocalProfile } from '../../model/local-profile';

/**
 * El registro de este dispositivo ante el servidor (ADR 0016). El identificador lo crea el dispositivo y se guarda ANTES de
 * pedir el codigo: si la peticion se pierde, se repite con el mismo y el servidor devuelve el mismo dispositivo.
 */
export interface DeviceRegistration {
  readonly id: string;
  /** El codigo corto que encabeza los folios (`AA`), o `null` mientras el servidor no lo haya dado. */
  readonly code: string | null;
}

/**
 * Puerto de salida: lo que se guarda de UNA persona en este dispositivo (ADR 0018). Todo el contenido va cifrado; la
 * implementacion decide como. Ningun metodo recibe ni devuelve credenciales: nada secreto se guarda.
 */
export interface LocalStore {
  readProfile(): Promise<LocalProfile | null>;
  writeProfile(profile: LocalProfile): Promise<void>;
  readDevice(): Promise<DeviceRegistration | null>;
  /**
   * Guarda el dispositivo candidato si todavia no hay uno y devuelve el que quedo: dos pestañas que lo intentan a la vez
   * terminan con el mismo.
   */
  claimDevice(candidate: DeviceRegistration): Promise<DeviceRegistration>;
  /** Guarda el codigo que el servidor dio al dispositivo ya reclamado. */
  completeDevice(device: DeviceRegistration): Promise<void>;
  /**
   * Reserva el siguiente numero de la serie de folios de este dispositivo y lo deja asentado. La serie solo crece, aunque lo
   * que se iba a hacer con el numero falle: puede haber saltos y nunca repeticiones (ADR 0016).
   */
  reserveSerial(): Promise<number>;
  /** Cuantas operaciones esperan a ser enviadas. */
  countPending(): Promise<number>;
  /** Suelta la conexion con la base. Lo guardado se conserva. */
  close(): void;
}

/** Puerto de salida: las bases locales, una por persona (ADR 0018). */
export interface LocalStores {
  /**
   * Abre la base de la persona, y la crea con su clave si no existe. Lanza `LocalKeyLostError` si tiene operaciones pero ya no
   * tiene la clave, y `LocalStorageUnavailableError` si el navegador no puede guardar datos cifrados.
   */
  open(authUserId: string): Promise<LocalStore>;
  /** Borra la base de la persona con todo lo que tiene, la clave incluida. Es lo que hace olvidar (ADR 0018, punto 7). */
  forget(authUserId: string): Promise<void>;
}
