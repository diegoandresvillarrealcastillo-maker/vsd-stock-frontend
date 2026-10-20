# La aplicación instalable

VSD Stock se instala en el teléfono o el computador como una aplicación y **abre sin internet**. Este documento
dice qué guarda, qué nunca guarda, cómo se actualiza y cómo se comprueba. Lo decidió el ticket C3-07; la
decisión de fondo (qué se guarda y dónde) la toma el [ADR 0018](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0018-cifrado-local-y-olvido-del-dispositivo.md)
del backend.

## Qué guarda el service worker y qué no

El service worker (`service-worker/sw.ts`) guarda **la interfaz** y nada más: la página, el JavaScript, los
estilos, las imágenes y el manifiesto. Se guardan **una sola vez, al instalarse una versión**, y se sirven desde
ahí.

**Nunca guarda datos.** Ninguna respuesta de la API ni del servicio de identidad entra a la caché, ni siquiera
por descuido, porque el archivo no sabe escribir en la caché después de instalarse (no tiene `put` ni `add`, y
una prueba lo vigila). Lo que la aplicación sabe de un negocio vive en el almacenamiento cifrado del dispositivo
(ADR 0018), no en la caché del service worker.

| Petición                                                        | Qué hace el service worker                            |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| Una visita a cualquier página de la aplicación (`/`, `/ventas`) | Responde con la página guardada (el enrutador pinta). |
| Un archivo de la interfaz de esta versión                       | Lo responde desde la caché, sin preguntarle a la red. |
| Un archivo que no es de la interfaz                             | No lo atiende: el navegador va a la red como siempre. |
| Cualquier petición que no sea `GET`                             | No la atiende.                                        |
| Cualquier petición a otro origen (la API, Supabase)             | No la atiende.                                        |
| Una ruta que empiece por `/v1/` aunque sea del mismo origen     | No la atiende (cinturón y tirantes).                  |

## Cómo se compila

`npm run build` revisa los tipos de la aplicación **y del service worker** (`tsconfig.sw.json`, que lleva la
biblioteca de los workers y no la del documento), compila la aplicación con Vite y después ejecuta
`scripts/build-service-worker.ts`, que escribe `dist/sw.js`:

1. lista los archivos de `dist/` que forman la interfaz (sin mapas de fuentes, sin el propio `sw.js` y sin los
   iconos grandes que solo pide el sistema operativo al instalar);
2. calcula la **versión**: una huella de esos archivos y su contenido. Cambia cuando cambia cualquiera de ellos, y
   con ella el nombre de la caché (`vsd-stock-shell-<versión>`);
3. le quita los tipos a `service-worker/sw.ts` (Node 24 lo hace sin compilar) y le antepone la lista y la versión.

La prueba `test/pwa/service-worker.spec.ts` ejecuta **ese mismo archivo, tal como se despliega**, con un
navegador de mentira alrededor: así lo que se prueba es lo que se publica.

## Cómo se actualiza

Una versión nueva **nunca se activa sola**:

1. el navegador encuentra un `sw.js` distinto (al abrir la aplicación, y cada vez que la persona vuelve a ella);
2. lo instala **en segundo plano** y se queda **esperando**: la página sigue con la versión vieja;
3. la aplicación muestra un aviso, «Hay una versión nueva de VSD Stock», con **Actualizar ahora** y **Más tarde**;
4. solo cuando la persona toca **Actualizar ahora**, la versión que esperaba toma el control y la página se
   recarga con la nueva. Las cachés de las versiones viejas se borran al activarse la nueva.

Actualizar recarga la página, y recargar a mitad de una venta sería perder lo que la persona hace. Por eso la
pantalla de venta (C3-12) llama a `useHoldUpdates(true)` mientras hay una venta en curso: el aviso sigue ahí, pero
dice «Termina la venta en curso para actualizar» y no ofrece el botón.

## Almacenamiento protegido

Las ventas sin enviar viven cifradas en el dispositivo. Si el navegador se queda sin espacio, **puede borrarlas**.
Al abrir, la aplicación le pide que no lo haga (`navigator.storage.persist()`) y dice lo que respondió en el panel
del estado del servicio:

- **«Lo guardado en este dispositivo está protegido.»** El navegador prometió no borrarlo.
- **«El navegador podría borrar lo guardado si se queda sin espacio. Envía tus ventas pronto.»** Lo negó. Chrome
  suele concederlo a una aplicación instalada y negarlo a una pestaña: por eso se vuelve a pedir.
- **«Este navegador no puede proteger lo guardado en el dispositivo.»** No sabe de almacenamiento persistente.

En un iPhone, Safari puede borrar lo guardado por una aplicación web que no se usa en varios días (ADR 0018). La
aplicación no puede evitarlo: lo único que se puede hacer es **sincronizar pronto** y no dejar ventas sin enviar.

## El presupuesto de peso

`npm run budget` (también en el CI, después de compilar) mide `dist/` con gzip al nivel 9 y **falla si se pasa**
de `scripts/bundle-budget.json`:

| Parte          |      Hoy | Presupuesto |
| -------------- | -------: | ----------: |
| JavaScript     | 141,7 KB |      180 KB |
| CSS            |   4,7 KB |       12 KB |
| Service worker |   1,7 KB |        3 KB |

Si un cambio legítimo no cabe, se discute en el PR y se sube el número con su razón; no se quita la comprobación.
El JavaScript es hoy una sola pieza: si el punto de venta se acerca al tope, la salida es separar por rutas las
pantallas de administración (catálogo, compras, personas) para que no pesen en el mostrador.

## Cómo comprobarlo a mano

```bash
npm run build
npm run preview        # http://localhost:4173
```

1. Abre la dirección y mira, en las herramientas del navegador (Aplicación → Service Workers), que el service
   worker esté **activado** y la caché `vsd-stock-shell-…` tenga solo la interfaz.
2. **Apaga el servidor y recarga:** la aplicación abre desde la caché y dice «Sin conexión».
3. Vuelve a compilar con un cambio, deja el servidor encendido y recarga: aparece el aviso; **Actualizar ahora**
   recarga con la versión nueva y la caché vieja desaparece.

Esto se hizo el 2026-10-18 en el navegador integrado (Chromium) y quedó como se describe. Las pruebas en Firefox
y WebKit, y en un teléfono real, son de C3-15 y C3-16.

## Lo que no está resuelto

- **iPhone:** no se probó. Los service workers funcionan en Safari, pero el almacenamiento puede borrarse (arriba)
  y la instalación es manual («Añadir a pantalla de inicio»).
- **Hosts de PRE:** el service worker solo funciona por HTTPS (o `localhost`). C3-14 lo despliega y C3-16 lo
  prueba en un teléfono.
- **Un archivo que falla al instalar** impide instalar la versión nueva entera (se guarda todo o nada): la versión
  anterior sigue sirviendo. Es lo que se quiere, pero la aplicación no avisa del fallo.
