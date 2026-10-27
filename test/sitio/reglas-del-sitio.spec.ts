// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page, Route } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import {
  conLasReglasDelSitio,
  reglasDeTodo,
  reglasDelSitioCompilado,
  URL_DEL_SITIO,
} from '../../e2e/support/sitio';

// Las pruebas en navegador de la landing (C4-L7) sirven la pagina con las reglas de verdad: las de `sitio/dist/_headers`, que
// `scripts/build-sitio.ts` escribe para Cloudflare Pages. `vite preview` no las aplica, y sin ellas la politica de contenido nunca
// se veria actuar. Aqui se vigila solo la lectura de ese archivo.
const archivo = `# Reglas de Cloudflare Pages de la landing.
# Un comentario que no es una regla.

/*
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; connect-src 'self' https://api.ejemplo.test

/
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;

describe('the rules that apply to the whole site (the /* block of _headers)', () => {
  it('reads each header of the block, with the name in lowercase, as the browser gives it', () => {
    expect(reglasDeTodo(archivo)).toEqual({
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'; connect-src 'self' https://api.ejemplo.test",
    });
  });

  it('keeps the colons inside the value: a policy names addresses with https://', () => {
    expect(reglasDeTodo(archivo)['content-security-policy']).toContain('https://api.ejemplo.test');
  });

  it('does not take what belongs to other routes', () => {
    expect(Object.keys(reglasDeTodo(archivo))).not.toContain('cache-control');
  });

  it('stops at the next route, even if the block is the last of the file', () => {
    expect(reglasDeTodo('/*\n  A: uno\n')).toEqual({ a: 'uno' });
    expect(reglasDeTodo('/*\n  A: uno\n\n/otra\n  B: dos\n')).toEqual({ a: 'uno' });
  });

  it('fails loudly without a block for the whole site: a page served without its policy would pass tests it should not', () => {
    expect(() => reglasDeTodo('/\n  Cache-Control: no-cache\n')).toThrow(/no tiene el bloque/);
    expect(() => reglasDeTodo('')).toThrow(/no tiene el bloque/);
  });

  it('fails loudly if the block has no headers at all', () => {
    expect(() => reglasDeTodo('/*\n\n/otra\n  B: dos\n')).toThrow(/sin reglas/);
    expect(() => reglasDeTodo('/*\n')).toThrow(/sin reglas/);
  });

  it('reads a file written with Windows line breaks', () => {
    expect(reglasDeTodo('/*\r\n  A: uno\r\n  B: dos\r\n\r\n/otra\r\n  C: tres\r\n')).toEqual({
      a: 'uno',
      b: 'dos',
    });
  });

  it('finds the block even if the line of the route has spaces after it', () => {
    expect(reglasDeTodo('/*   \n  A: uno\n')).toEqual({ a: 'uno' });
  });

  it('keeps reading after an empty line inside the block', () => {
    expect(reglasDeTodo('/*\n  A: uno\n\n  B: dos\n')).toEqual({ a: 'uno', b: 'dos' });
  });

  it('ignores an indented line that is not a header, and trims the name and the value', () => {
    expect(reglasDeTodo('/*\n  una nota sin dos puntos\n   A :   uno  \n')).toEqual({ a: 'uno' });
  });
});

describe('the rules of the compiled site', () => {
  it('are read from sitio/dist/_headers under the folder it is given', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'sitio-'));
    mkdirSync(join(raiz, 'sitio', 'dist'), { recursive: true });
    writeFileSync(join(raiz, 'sitio', 'dist', '_headers'), '/*\n  X-Prueba: si\n');

    expect(reglasDelSitioCompilado(raiz)).toEqual({ 'x-prueba': 'si' });
  });
});

/** Una pagina de mentira que guarda lo que se le pide con `route`. */
function paginaDeMentira() {
  let patron: unknown;
  let manejador: ((ruta: Route) => Promise<void>) | undefined;
  const pagina = {
    route: vi.fn((url: unknown, funcion: (ruta: Route) => Promise<void>) => {
      patron = url;
      manejador = funcion;
      return Promise.resolve();
    }),
  };
  return {
    pagina: pagina as unknown as Page,
    patron: () => patron,
    atender: async (ruta: Partial<Route>) => {
      await manejador?.(ruta as Route);
    },
  };
}

describe('serving the page with the rules of the site', () => {
  it('asks for every file of the site, and of nobody else', async () => {
    const { pagina, patron } = paginaDeMentira();

    await conLasReglasDelSitio(pagina, { a: 'uno' });

    expect(patron()).toBe(`${URL_DEL_SITIO}/**`);
  });

  it('answers with what the server answered and the rules on top, the name of each in lowercase', async () => {
    const { pagina, atender } = paginaDeMentira();
    const respuesta = { headers: () => ({ 'content-type': 'text/html', a: 'del servidor' }) };
    const fulfill = vi.fn(() => Promise.resolve());
    await conLasReglasDelSitio(pagina, { a: 'de la regla', 'x-nueva': 'si' });

    await atender({ fetch: () => Promise.resolve(respuesta as never), fulfill });

    expect(fulfill).toHaveBeenCalledWith({
      response: respuesta,
      headers: { 'content-type': 'text/html', a: 'de la regla', 'x-nueva': 'si' },
    });
  });
});
