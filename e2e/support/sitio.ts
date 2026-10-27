import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

// Lo que comparten las pruebas en navegador de la landing (C4-L7, `e2e/sitio/`). No tocan la API ni la base: sirven `sitio/dist/` tal
// cual sale de `npm run build:sitio` y, para que la pagina se vea como en Cloudflare Pages, le ponen las reglas de `_headers`.

/** El puerto de la landing en las pruebas: aparte de los de la pila de la aplicacion (4129, 3129 y 54329) y de `vite preview` (4173). */
export const PUERTO_DEL_SITIO = 4131;

export const URL_DEL_SITIO = `http://localhost:${String(PUERTO_DEL_SITIO)}`;

const RAIZ = resolve(import.meta.dirname, '..', '..');

/**
 * Las cabeceras que `_headers` pone a todo el sitio (el bloque `/*`), con el nombre en minusculas como las da el navegador. Sin ese
 * bloque falla en voz alta: una pagina servida sin su politica de contenido pasaria pruebas que en internet no pasaria.
 */
export function reglasDeTodo(archivo: string): Record<string, string> {
  const lineas = archivo.replaceAll('\r\n', '\n').split('\n');
  const inicio = lineas.findIndex((linea) => linea.trim() === '/*');
  if (inicio === -1)
    throw new Error('El archivo de reglas no tiene el bloque de todo el sitio (/*).');

  const reglas: Record<string, string> = {};
  for (const linea of lineas.slice(inicio + 1)) {
    if (linea === '') continue;
    if (!linea.startsWith(' ')) break;
    const separador = linea.indexOf(':');
    if (separador === -1) continue;
    reglas[linea.slice(0, separador).trim().toLowerCase()] = linea.slice(separador + 1).trim();
  }
  if (Object.keys(reglas).length === 0) {
    throw new Error(
      'El bloque de todo el sitio (/*) esta sin reglas: la pagina saldria sin su politica.',
    );
  }
  return reglas;
}

/** Las reglas de todo el sitio tal como las escribio la ultima compilacion (`npm run build:sitio`), en `sitio/dist/_headers`. */
export function reglasDelSitioCompilado(raiz: string = RAIZ): Record<string, string> {
  return reglasDeTodo(readFileSync(resolve(raiz, 'sitio', 'dist', '_headers'), 'utf8'));
}

/**
 * Sirve la pagina con las reglas de `sitio/dist/_headers`. `vite preview` no las aplica y entonces la politica de contenido (que
 * solo deja hablar al propio sitio) nunca se veria actuar: un script bloqueado pasaria sin que nadie lo note.
 */
export async function conLasReglasDelSitio(
  page: Pick<Page, 'route'>,
  reglas: Record<string, string> = reglasDelSitioCompilado(),
): Promise<void> {
  await page.route(`${URL_DEL_SITIO}/**`, async (ruta) => {
    const respuesta = await ruta.fetch();
    await ruta.fulfill({ response: respuesta, headers: { ...respuesta.headers(), ...reglas } });
  });
}
