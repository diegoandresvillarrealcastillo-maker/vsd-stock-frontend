/**
 * Puerto de salida: el servicio que guarda la interfaz en el dispositivo para que abra sin internet (C3-07). Lo
 * implementa el service worker del navegador; la aplicacion solo sabe de versiones nuevas.
 */
export interface AppShellHost {
  /** Instala el servicio. `unsupported` si el navegador no tiene service workers. */
  register(): Promise<'registered' | 'unsupported'>;
  /**
   * Avisa cada vez que hay una version nueva descargada y esperando. Si ya habia una al registrar, avisa enseguida.
   * Devuelve la forma de dejar de escuchar.
   */
  onUpdateReady(listener: () => void): () => void;
  /** Le pide a la version que espera que tome el control. En cuanto lo hace, la pagina se recarga sola. */
  activateUpdate(): void;
  /** Pregunta al servidor si hay version nueva. No hace nada si no hay conexion. */
  checkForUpdate(): Promise<void>;
}
