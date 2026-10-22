// jsdom no trae IntersectionObserver. Este doble guarda lo que se le pide observar y deja a la prueba decidir que entra y que
// sale de la pantalla (`emit`), que es lo unico que la landing necesita de el: saber que seccion se ve y si el hero ya paso.
type Callback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;

export class FakeIntersectionObserver {
  static readonly instances: FakeIntersectionObserver[] = [];

  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(
    readonly callback: Callback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.add(target);
  }

  unobserve(target: Element): void {
    this.targets.delete(target);
  }

  disconnect(): void {
    this.targets.clear();
    this.disconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  /** Avisa al codigo de la landing que estos elementos entraron (`true`) o salieron (`false`) de la pantalla. */
  emit(changes: readonly (readonly [Element | null, boolean])[]): void {
    const entries = changes.flatMap(([target, isIntersecting]) =>
      target === null ? [] : [{ target, isIntersecting } as IntersectionObserverEntry],
    );
    this.callback(entries, this as unknown as IntersectionObserver);
  }

  /** Los observadores que siguen vivos, del mas reciente al mas viejo. */
  static alive(): FakeIntersectionObserver[] {
    return FakeIntersectionObserver.instances.filter((o) => !o.disconnected).reverse();
  }
}

/** Instala el doble en `window` y devuelve como quitarlo. Se llama en `beforeEach` y se deshace en `afterEach`. */
export function installIntersectionObserver(): () => void {
  const before = globalThis.IntersectionObserver;
  FakeIntersectionObserver.instances.length = 0;
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  return () => {
    globalThis.IntersectionObserver = before;
  };
}
