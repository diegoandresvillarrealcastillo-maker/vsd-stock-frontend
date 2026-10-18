/**
 * Una promesa que la prueba resuelve o rechaza cuando quiere, para controlar en que momento llega una respuesta.
 *
 * Si la prueba la rechaza antes de que el codigo bajo prueba haya pedido su resultado, esa promesa quedaria rechazada sin
 * nadie que la atienda y Node la contaria como un error sin manejar, aunque la prueba solo queria simular una respuesta
 * que falla. Por eso se le pone un manejo vacio desde el principio: no esconde nada (quien la pida despues recibe el
 * rechazo igual) y deja de depender de quien llega primero.
 */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}
