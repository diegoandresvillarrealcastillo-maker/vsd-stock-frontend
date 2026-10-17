import type { NetworkHints } from '../../../domain/ports/out/network-hints';

/**
 * Las pistas de red del navegador: `navigator.onLine` y los eventos `online` y
 * `offline` de la ventana. Reciben el navegador y la ventana en lugar de leer
 * los globales, para poder probarse sin un navegador.
 */
export class BrowserNetworkHints implements NetworkHints {
  constructor(
    private readonly navigatorLike: { readonly onLine: boolean },
    private readonly events: EventTarget,
  ) {}

  isOnline(): boolean {
    return this.navigatorLike.onLine;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    const onOnline = () => {
      listener(true);
    };
    const onOffline = () => {
      listener(false);
    };
    this.events.addEventListener('online', onOnline);
    this.events.addEventListener('offline', onOffline);
    return () => {
      this.events.removeEventListener('online', onOnline);
      this.events.removeEventListener('offline', onOffline);
    };
  }
}
