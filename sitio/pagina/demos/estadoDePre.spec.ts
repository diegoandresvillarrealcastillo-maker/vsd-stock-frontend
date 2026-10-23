import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_DE_PRE } from '../destinos';
import {
  ESPERA_MS,
  MAXIMO_MS,
  crearSondaDePre,
  sondaDeLaPagina,
  type EstadoDePre,
} from './estadoDePre';

/** Un `fetch` de mentira: guarda las llamadas y deja que la prueba decida cuando y como termina cada una. */
function falsoFetch() {
  const llamadas: { url: string; opciones: RequestInit }[] = [];
  const respuestas: { responder: () => void; fallar: () => void }[] = [];
  const buscar = vi.fn((url: string, opciones?: RequestInit) => {
    llamadas.push({ url, opciones: opciones ?? {} });
    return new Promise<Response>((resolver, rechazar) => {
      opciones?.signal?.addEventListener('abort', () => {
        rechazar(new DOMException('Se acabo el tiempo', 'AbortError'));
      });
      respuestas.push({
        responder: () => {
          resolver(new Response(null));
        },
        fallar: () => {
          rechazar(new TypeError('Failed to fetch'));
        },
      });
    });
  });
  return { buscar: buscar as unknown as typeof fetch, llamadas, respuestas, espia: buscar };
}

const URL_DE_PRUEBA = 'https://api.ejemplo.test';

function sonda() {
  const fetchFalso = falsoFetch();
  return {
    ...fetchFalso,
    sonda: crearSondaDePre({ url: URL_DE_PRUEBA, buscar: fetchFalso.buscar }),
  };
}

/** Deja que las promesas pendientes se resuelvan (con los relojes falsos no avanzan solas). */
async function asentar(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the probe of the PRE demo: asking the API once whether it is awake', () => {
  it('asks nothing until someone is looking, and starts as "verificando"', () => {
    const { sonda: laSonda, espia } = sonda();

    expect(laSonda.leer()).toBe<EstadoDePre>('verificando');
    expect(espia).not.toHaveBeenCalled();
  });

  it('asks GET /health in no-cors mode, with no credentials, no headers and no referrer', () => {
    const { sonda: laSonda, llamadas } = sonda();

    laSonda.suscribir(() => undefined);

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.url).toBe(`${URL_DE_PRUEBA}/health`);
    const { signal, ...opciones } = llamadas[0]?.opciones ?? {};
    expect(opciones).toEqual({
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it('says "despierta" as soon as the API answers, and tells whoever is looking', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    const avisar = vi.fn();
    laSonda.suscribir(avisar);

    respuestas[0]?.responder();
    await asentar();

    expect(laSonda.leer()).toBe('despierta');
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('keeps saying "verificando" for 3 seconds and then says "dormida"', async () => {
    const { sonda: laSonda } = sonda();
    const avisar = vi.fn();
    laSonda.suscribir(avisar);

    await vi.advanceTimersByTimeAsync(ESPERA_MS - 1);
    expect(laSonda.leer()).toBe('verificando');
    expect(avisar).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(laSonda.leer()).toBe('dormida');
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('waits exactly the 3 seconds the page promises', () => {
    expect(ESPERA_MS).toBe(3_000);
  });

  it('says "despierta" if the API answers late, once the chip had said "dormida": it did wake up', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    const avisar = vi.fn();
    laSonda.suscribir(avisar);
    await vi.advanceTimersByTimeAsync(ESPERA_MS);
    expect(laSonda.leer()).toBe('dormida');

    await vi.advanceTimersByTimeAsync(20_000);
    respuestas[0]?.responder();
    await asentar();

    expect(laSonda.leer()).toBe('despierta');
    expect(avisar).toHaveBeenCalledTimes(2);
  });

  it('says "dormida" and not anything worse when the request fails', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    laSonda.suscribir(() => undefined);

    respuestas[0]?.fallar();
    await asentar();

    expect(laSonda.leer()).toBe('dormida');
  });

  it('does not tell twice about "dormida" when the request fails after the 3 seconds', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    const avisar = vi.fn();
    laSonda.suscribir(avisar);
    await vi.advanceTimersByTimeAsync(ESPERA_MS);

    respuestas[0]?.fallar();
    await asentar();

    expect(laSonda.leer()).toBe('dormida');
    expect(avisar).toHaveBeenCalledTimes(1);
  });

  it('gives up at the maximum: cancels the request and stays "dormida"', async () => {
    const { sonda: laSonda, llamadas } = sonda();
    laSonda.suscribir(() => undefined);
    const signal = llamadas[0]?.opciones.signal;

    await vi.advanceTimersByTimeAsync(MAXIMO_MS - 1);
    expect(signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal?.aborted).toBe(true);
    expect(laSonda.leer()).toBe('dormida');
  });

  it('waits longer than the ~25 seconds that the page says a sleeping API takes to wake up', () => {
    expect(MAXIMO_MS).toBeGreaterThan(25_000);
  });

  it('leaves no timer running once the API answered', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    laSonda.suscribir(() => undefined);

    respuestas[0]?.responder();
    await asentar();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer running once the request failed before the 3 seconds', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    laSonda.suscribir(() => undefined);

    respuestas[0]?.fallar();
    await asentar();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves no timer running once it gave up', async () => {
    const { sonda: laSonda } = sonda();
    laSonda.suscribir(() => undefined);

    await vi.advanceTimersByTimeAsync(MAXIMO_MS);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('asks once per load, however many look and however many times they come back', async () => {
    const { sonda: laSonda, espia, respuestas } = sonda();

    const dejarDeMirar = laSonda.suscribir(() => undefined);
    laSonda.suscribir(() => undefined);
    dejarDeMirar();
    laSonda.suscribir(() => undefined);
    respuestas[0]?.responder();
    await asentar();
    laSonda.suscribir(() => undefined);

    expect(espia).toHaveBeenCalledTimes(1);
  });

  it('does not cancel the request when the one who was looking leaves', async () => {
    const { sonda: laSonda, llamadas, respuestas } = sonda();
    const dejarDeMirar = laSonda.suscribir(() => undefined);

    dejarDeMirar();
    respuestas[0]?.responder();
    await asentar();

    expect(llamadas[0]?.opciones.signal?.aborted).toBe(false);
    expect(laSonda.leer()).toBe('despierta');
  });

  it('does not tell the one who left', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    const avisar = vi.fn();
    const dejarDeMirar = laSonda.suscribir(avisar);

    dejarDeMirar();
    respuestas[0]?.responder();
    await asentar();

    expect(avisar).not.toHaveBeenCalled();
  });

  it('tells everyone who is looking', async () => {
    const { sonda: laSonda, respuestas } = sonda();
    const primero = vi.fn();
    const segundo = vi.fn();
    laSonda.suscribir(primero);
    laSonda.suscribir(segundo);

    respuestas[0]?.responder();
    await asentar();

    expect(primero).toHaveBeenCalledTimes(1);
    expect(segundo).toHaveBeenCalledTimes(1);
  });

  it('gives whoever comes late the state as it is, without asking again', async () => {
    const { sonda: laSonda, espia, respuestas } = sonda();
    laSonda.suscribir(() => undefined);
    respuestas[0]?.responder();
    await asentar();

    laSonda.suscribir(() => undefined);

    expect(laSonda.leer()).toBe('despierta');
    expect(espia).toHaveBeenCalledTimes(1);
  });
});

describe('the probe of the page', () => {
  it('asks the API of PRE, and is the same one every time it is asked for', () => {
    const { buscar, llamadas } = falsoFetch();
    vi.stubGlobal('fetch', buscar);
    try {
      const laSonda = sondaDeLaPagina();
      laSonda.suscribir(() => undefined);
      sondaDeLaPagina().suscribir(() => undefined);

      expect(sondaDeLaPagina()).toBe(laSonda);
      expect(llamadas.map((llamada) => llamada.url)).toEqual([`${API_DE_PRE}/health`]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
