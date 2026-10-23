import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installIntersectionObserver } from '../../test/support/intersection-observer';
import type { SondaDePre } from './demos/estadoDePre';
import { render } from './entry-server';

// El chip de la demo de PRE le pregunta a una API de verdad al montarse; aqui la sonda nunca llega a saber nada, para que la
// prueba no salga a internet. La consulta se prueba en `demos/estadoDePre.spec.ts`.
vi.mock('./demos/estadoDePre', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./demos/estadoDePre')>()),
  sondaDeLaPagina: (): SondaDePre => ({
    leer: () => 'verificando',
    suscribir: () => () => undefined,
  }),
}));

// `main.tsx` decide al arrancar si React se monta encima de una pagina prerenderizada o si la crea desde cero. Se prueba el archivo
// de verdad, con el `#root` que recibe cada modo, y se mira lo que vera quien abra la consola del navegador.

let quitarObservador: () => void;
let errores: string[];

beforeEach(() => {
  quitarObservador = installIntersectionObserver();
  errores = [];
  // React 19 avisa de lo que no pudo hidratar con `reportError` (un evento `error` en la ventana) y de lo demas con `console.error`.
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errores.push(args.map(String).join(' '));
  });
  window.addEventListener('error', alFallar);
});

afterEach(() => {
  window.removeEventListener('error', alFallar);
  vi.restoreAllMocks();
  document.body.replaceChildren();
  quitarObservador();
});

function alFallar(evento: ErrorEvent): void {
  evento.preventDefault();
  errores.push(evento.error instanceof Error ? evento.error.message : evento.message);
}

/** El documento tal como llega al navegador: `sitio/index.html` con `contenido` dentro de `#root`. */
function prepararDocumento(contenido: string): HTMLElement {
  document.body.innerHTML = `<div id="root">${contenido}</div>`;
  const raiz = document.getElementById('root');
  if (raiz === null) throw new Error('El documento de la prueba no tiene #root.');
  return raiz;
}

/** Corre `main.tsx` como lo corre el navegador al cargar el documento. */
async function arrancar(): Promise<void> {
  vi.resetModules();
  await act(async () => {
    await import('./main');
  });
}

describe('the start of the page', () => {
  it('creates the page from scratch when #root only has the marker of the prerender, as in `npm run dev:sitio`', async () => {
    // Sin prerenderizado, `sitio/index.html` llega con `<!--app-->` y nada mas: un comentario no es una pagina que hidratar.
    const raiz = prepararDocumento('<!--app-->');

    await arrancar();

    expect(errores).toEqual([]);
    expect(raiz.querySelector('h1')).not.toBeNull();
  });

  it('hydrates the prerendered page, reusing its elements instead of building them again', async () => {
    const raiz = prepararDocumento(render());
    const titulo = raiz.querySelector('h1');
    expect(titulo).not.toBeNull();

    await arrancar();

    expect(errores).toEqual([]);
    expect(raiz.querySelector('h1')).toBe(titulo);
  });
});
