import type { LocalProfile, CounterAccess } from '../../model/local-profile';
import type { Me } from '../../model/me';
import type { CopyStorage } from './copy-storage';
import type { Outbox } from './outbox';
import type { ShiftStorage } from './shift-storage';

/** Quien trabaja ahora en este dispositivo, con su base local abierta. */
export interface ActiveWorkspace {
  readonly profile: LocalProfile;
  /** El codigo del dispositivo, o `null` mientras no se haya registrado con conexion. */
  readonly deviceCode: string | null;
  /** El identificador con el que el servidor conoce este dispositivo: va junto al codigo, y es `null` mientras no tenga codigo. */
  readonly deviceId: string | null;
  /** `true` si se reanudo desde el registro local, sin que el servidor lo confirmara ahora. */
  readonly resumed: boolean;
}

/** Quien trabajo por ultima vez en este dispositivo y si su mostrador se puede reanudar sin conexion. */
export type Resumption =
  | { readonly state: 'none' }
  | {
      readonly state: 'available';
      readonly profile: LocalProfile;
      readonly access: CounterAccess;
    };

/** Puerto de entrada: el espacio de trabajo local de la persona que usa este dispositivo (ADR 0018 y 0022). */
export interface LocalWorkspace {
  /** El espacio abierto, o `null`. Es el mismo objeto mientras nada cambie. */
  current(): ActiveWorkspace | null;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: () => void): () => void;
  /** Quien trabajo por ultima vez aqui, sin abrir su espacio de trabajo. Nunca lanza. */
  lastPerson(): Promise<Resumption>;
  /**
   * Con la persona recien confirmada por el servidor: abre su base (la crea si es la primera vez), anota que se verifico ahora y
   * la deja como la persona de este dispositivo. No hace nada si todavia no tiene negocio. Lanza `LocalKeyLostError` o
   * `LocalStorageUnavailableError`.
   */
  begin(me: Me): Promise<void>;
  /**
   * Tira lo guardado de la persona cuando no se puede leer (la clave se perdio, `LocalKeyLostError`) y empieza de nuevo con
   * una base vacia. Las operaciones que habia sin enviar se pierden: solo se llama si la persona lo confirmo.
   */
  discard(me: Me): Promise<void>;
  /** Reanuda el mostrador desde el registro local, sin conexion. Lanza `CounterLockedError` si ya no se puede. */
  resume(): Promise<void>;
  /**
   * Registra este dispositivo con el servidor si todavia no lo esta, y deja su codigo. Necesita conexion y es seguro repetirlo.
   * Lanza `NoWorkspaceError` y `ApiError`.
   */
  registerDevice(): Promise<void>;
  /** El folio de la siguiente venta: `AA-000142`. Lanza `NoWorkspaceError` y `DeviceNotRegisteredError`. */
  nextFolio(): Promise<string>;
  /** Cuantas operaciones esperan a ser enviadas. Lanza `NoWorkspaceError`. */
  pendingCount(): Promise<number>;
  /** La cola de operaciones de quien trabaja ahora (C3-09). Lanza `NoWorkspaceError`. */
  outbox(): Outbox;
  /** La copia de lectura del catalogo y de la existencia de quien trabaja ahora (C3-10). Lanza `NoWorkspaceError`. */
  copy(): CopyStorage;
  /** El turno de caja de quien trabaja ahora (C3-11). Lanza `NoWorkspaceError`. */
  shifts(): ShiftStorage;
  /** «Cambiar de persona»: suelta la base y conserva todo lo guardado, para que la persona vuelva a por ello. */
  leave(): Promise<void>;
  /** «Cerrar sesion»: borra la base de la persona con todo lo que tiene, y olvida quien era. No hace nada si no hay nadie. */
  forget(): Promise<void>;
}
