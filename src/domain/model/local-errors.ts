import type { CounterAccess } from './local-profile';

/** El mostrador no se puede reanudar sin conexion: pasaron las setenta y dos horas o el reloj no es de fiar (ADR 0022). */
export class CounterLockedError extends Error {
  constructor(readonly reason: Extract<CounterAccess, { state: 'locked' }>['reason']) {
    super(`The counter can not be resumed: ${reason}`);
    this.name = 'CounterLockedError';
  }
}

/** Todavia no hay quien trabaje en este dispositivo: nadie entro, o la persona cambio. */
export class NoWorkspaceError extends Error {
  constructor() {
    super('No person is working in this device');
    this.name = 'NoWorkspaceError';
  }
}

/** Un folio necesita el codigo del dispositivo, y este todavia no se registro con conexion (ADR 0016). */
export class DeviceNotRegisteredError extends Error {
  constructor() {
    super('This device has not been registered yet');
    this.name = 'DeviceNotRegisteredError';
  }
}

/**
 * La base de la persona tiene operaciones sin enviar pero la clave que las cifro ya no esta (el navegador la borro y dejo los
 * datos, ADR 0018): no se pueden leer, y abrir con una clave nueva las dejaria perdidas sin avisar. `pending` dice cuantas son.
 */
export class LocalKeyLostError extends Error {
  constructor(readonly pending: number) {
    super(`The key of the local database is lost and ${String(pending)} records can not be read`);
    this.name = 'LocalKeyLostError';
  }
}

/** El navegador no ofrece lo que hace falta para guardar datos cifrados (IndexedDB o WebCrypto), o no se puede usar. */
export class LocalStorageUnavailableError extends Error {
  constructor(reason: string) {
    super(`Local storage is not available: ${reason}`);
    this.name = 'LocalStorageUnavailableError';
  }
}
