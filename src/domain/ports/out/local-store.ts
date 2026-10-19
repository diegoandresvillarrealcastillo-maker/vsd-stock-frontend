import type { LocalProfile } from '../../model/local-profile';
import type { CopyStorage } from '../in/copy-storage';
import type { AttentionReason, NewOperation, QueuedOperation } from '../../model/outbox';

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
export interface LocalStore extends CopyStorage {
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
  /**
   * Pone una operacion en la cola. Si ya esta (mismo `operationId`), no hace nada: ni la repite ni le deshace lo que le paso. Su
   * contenido va cifrado; solo su identificador, su estado y su hora quedan en claro para poder buscarla (ADR 0018).
   */
  enqueue(operation: NewOperation): Promise<void>;
  /**
   * Las que esperan a ser enviadas, de la mas antigua a la mas nueva (y por identificador si son de la misma hora), hasta
   * `limit`. Una que no se puede abrir (un bit alterado, otra clave) no se da: sigue contando como pendiente pero no se envia.
   */
  pendingOperations(limit: number): Promise<QueuedOperation[]>;
  /** Las que el servidor no acepto y alguien tiene que mirar, de la mas antigua a la mas nueva. */
  attentionOperations(): Promise<QueuedOperation[]>;
  /** Cuantas operaciones piden atencion. */
  countAttention(): Promise<number>;
  /** Saca de la cola las que el servidor ya tiene. Las que no estan no son un error. */
  resolveOperations(operationIds: readonly string[]): Promise<void>;
  /** Aparta una operacion que el servidor rechazo, diciendo por que: ya no se envia sola. */
  markAttention(operationId: string, reason: AttentionReason): Promise<void>;
  /** Anota un intento mas, que no funciono, en cada una. */
  recordAttempts(operationIds: readonly string[]): Promise<void>;
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
