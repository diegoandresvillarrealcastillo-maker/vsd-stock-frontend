import { API_DE_PRE } from '../destinos';

/**
 * Lo que la pagina sabe de la demo de PRE: `verificando` mientras pregunta, `despierta` si la API contesto y `dormida` si no
 * contesto a tiempo. Ninguno es «caida»: la API de PRE vive en un plan gratuito que se duerme a los 15 minutos, y un servidor
 * dormido no esta roto, solo tarda en despertar.
 */
export type EstadoDePre = 'verificando' | 'despierta' | 'dormida';

/** Lo que se espera la respuesta antes de decir `dormida` (el criterio de C4-L6). */
export const ESPERA_MS = 3_000;

/**
 * Lo que se espera la respuesta antes de rendirse: mas que los ~25 s que la pagina dice que tarda en despertar una API dormida.
 * Si contesta despues de los 3 s, el estado pasa de `dormida` a `despierta`.
 */
export const MAXIMO_MS = 30_000;

export interface SondaDePre {
  /** El estado de ahora. */
  readonly leer: () => EstadoDePre;
  /** Avisa en cada cambio de estado y devuelve como dejar de escuchar. La primera vez que alguien escucha empieza la consulta. */
  readonly suscribir: (avisar: () => void) => () => void;
}

/**
 * La consulta de la demo: un solo `GET /health` a la API de PRE por carga de la pagina, en modo `no-cors`. En ese modo el navegador
 * no deja leer la respuesta (es «opaca»), pero lo unico que hace falta saber es si el servidor contesto, y asi no se agrega ningun
 * origen a las reglas CORS de la API. Sin credenciales, sin cabeceras y sin decir desde que pagina se pregunta.
 */
export function crearSondaDePre({
  url,
  buscar,
}: {
  readonly url: string;
  readonly buscar: typeof fetch;
}): SondaDePre {
  let estado: EstadoDePre = 'verificando';
  let empezo = false;
  const oyentes = new Set<() => void>();

  function cambiarA(nuevo: EstadoDePre): void {
    if (nuevo === estado) return;
    estado = nuevo;
    for (const avisar of [...oyentes]) avisar();
  }

  function empezar(): void {
    empezo = true;
    const cancelacion = new AbortController();
    // Si la respuesta llega antes, `terminar` apaga este temporizador: cuando suena, nadie ha contestado.
    const espera = setTimeout(() => {
      cambiarA('dormida');
    }, ESPERA_MS);
    const maximo = setTimeout(() => {
      cancelacion.abort();
    }, MAXIMO_MS);
    const terminar = (): void => {
      clearTimeout(espera);
      clearTimeout(maximo);
    };

    buscar(`${url}/health`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: cancelacion.signal,
    }).then(
      () => {
        terminar();
        cambiarA('despierta');
      },
      () => {
        terminar();
        cambiarA('dormida');
      },
    );
  }

  return {
    leer: () => estado,
    suscribir: (avisar) => {
      oyentes.add(avisar);
      if (!empezo) empezar();
      return () => {
        oyentes.delete(avisar);
      };
    },
  };
}

let laDeLaPagina: SondaDePre | null = null;

/** La sonda de esta carga de la pagina: la misma para todos los que la pidan, y no pregunta nada hasta que alguien la escucha. */
export function sondaDeLaPagina(): SondaDePre {
  laDeLaPagina ??= crearSondaDePre({
    url: API_DE_PRE,
    buscar: (...argumentos) => fetch(...argumentos),
  });
  return laDeLaPagina;
}
