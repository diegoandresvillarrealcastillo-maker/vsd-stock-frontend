import type { AppUpdateState } from '../../model/app-update';

/** Lo que la interfaz sabe de las versiones nuevas de la aplicacion (C3-07). */
export interface AppUpdates {
  /** El estado actual. Es el mismo objeto mientras nada cambie. */
  current(): AppUpdateState;
  /** Avisa de cada cambio. Devuelve la forma de dejar de escuchar. */
  subscribe(listener: (state: AppUpdateState) => void): () => void;
  /** Instala el servicio y empieza a buscar versiones nuevas. Llamarlo otra vez no hace nada. */
  start(): void;
  /** Deja de escuchar. */
  stop(): void;
  /** La persona decidio usar la version nueva. Devuelve `false` si no hay una lista o alguien pidio esperar. */
  apply(): boolean;
  /**
   * Una pantalla pide que no se actualice ahora (una venta en curso). Devuelve la forma de soltarlo; mientras alguna
   * pantalla lo tenga, `apply()` no hace nada.
   */
  hold(): () => void;
}
