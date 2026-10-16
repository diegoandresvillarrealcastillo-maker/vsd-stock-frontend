// jsdom no trae window.matchMedia. Este doble imita el del navegador y tiene un
// interruptor para la preferencia de movimiento reducido, que es la unica
// consulta de medios que cambia el comportamiento de la interfaz (ADR 0008).
type Listener = (event: MediaQueryListEvent) => void;

let prefersReducedMotion = false;
const listeners = new Set<Listener>();
const lists = new Map<string, MediaQueryList>();

function matches(query: string): boolean {
  return query.includes('prefers-reduced-motion') && prefersReducedMotion;
}

function mediaQueryList(query: string): MediaQueryList {
  const existing = lists.get(query);
  if (existing) return existing;

  // Framer registra su escucha una sola vez sobre la primera lista que recibe,
  // asi que la misma lista debe seguir viva y cambiar de valor entre pruebas.
  const created = {
    media: query,
    get matches() {
      return matches(query);
    },
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList;
  lists.set(query, created);
  return created;
}

/** Instala el doble en `window`. Se llama una vez por archivo de pruebas. */
export function installMatchMedia(): void {
  window.matchMedia = mediaQueryList;
}

/** Simula que la persona pidio (o dejo de pedir) menos movimiento en su sistema. */
export function setPrefersReducedMotion(value: boolean): void {
  prefersReducedMotion = value;
  for (const [query, list] of lists) {
    const event = { matches: matches(query), media: query } as MediaQueryListEvent;
    for (const listener of listeners) listener.call(list, event);
  }
}
