/// <reference lib="webworker" />

// El service worker de VSD Stock (C3-07, ADR 0030).
//
// Hace UNA cosa: guarda la interfaz (HTML, JavaScript, estilos, imagenes) para que la aplicacion abra sin internet.
// NO guarda datos: ninguna respuesta de la API ni del servicio de identidad entra jamas a la cache, ni siquiera por
// descuido, porque este archivo no escribe en la cache mas que al instalarse. Lo que la aplicacion sabe de un negocio
// vive en el almacenamiento cifrado del dispositivo (ADR 0018), no aqui.
//
// Tampoco se actualiza solo: una version nueva se instala y ESPERA. Quien la activa es la persona, desde el aviso de la
// aplicacion, para que nunca ocurra a mitad de una venta.
//
// Este archivo no se importa: `scripts/build-service-worker.ts` le quita los tipos (Node 24), le antepone la lista de
// archivos y la version, y lo escribe en `dist/sw.js`. Por eso solo usa sintaxis que se borra sin compilar (sin enums).
// La prueba `test/pwa/service-worker.spec.ts` lo ejecuta tal como se despliega.

declare const __PRECACHE__: readonly string[];
declare const __VERSION__: string;

const scope = self as unknown as ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'vsd-stock-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${__VERSION__}`;
/** La pagina de la aplicacion: toda navegacion, a la ruta que sea, se contesta con ella (el enrutador decide que pintar). */
const SHELL = '/';
/** Lo unico que se guarda y se sirve desde la cache, escrito por el proceso de compilacion. */
const SHELL_FILES = new Set<string>(__PRECACHE__);
/** La API vive en otro origen, pero si algun dia se sirviera desde este, estas rutas siguen sin tocarse. */
const API_PREFIX = '/v1/';

/** A que archivo de la interfaz corresponde la peticion, o `null` si este service worker no debe tocarla. */
function shellPathOf(request: Request): string | null {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== scope.location.origin) return null;
  if (url.pathname.startsWith(API_PREFIX)) return null;
  if (request.mode === 'navigate') return SHELL;
  return SHELL_FILES.has(url.pathname) ? url.pathname : null;
}

async function answerFromShell(path: string, request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const saved = await cache.match(path);
  // Si falta (no deberia), se va a la red SIN guardar lo que llegue.
  return saved ?? fetch(request);
}

scope.addEventListener('install', (event) => {
  // Se guarda toda la interfaz o nada: si un archivo falla, esta version no se instala y la anterior sigue sirviendo.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...SHELL_FILES])));
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => scope.clients.claim()),
  );
});

scope.addEventListener('message', (event) => {
  const data = event.data as { type?: unknown } | null;
  // La persona pidio actualizar: la version que esperaba toma el control.
  if (data !== null && typeof data === 'object' && data.type === 'SKIP_WAITING') {
    void scope.skipWaiting();
  }
});

scope.addEventListener('fetch', (event) => {
  const path = shellPathOf(event.request);
  // Lo que no es de la interfaz no se atiende: el navegador sigue su camino normal hacia la red.
  if (path === null) return;
  event.respondWith(answerFromShell(path, event.request));
});
