# Pruebas en un navegador de verdad (C3-15)

Las pruebas de `src/` corren en jsdom: no tienen red de verdad, ni IndexedDB de verdad, ni service worker, ni pestañas. Estas sí: abren
la web **ya compilada** en Chromium, Firefox y WebKit, contra la **API real y una base de datos real**, y comprueban lo que más importa
de un punto de venta: que una venta hecha sin conexión llega al servidor **una sola vez**. Lo decide el
[ADR 0030](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0030-aplicacion-instalable-motor-de-envio-y-pantalla-que-dice-la-verdad.md).

## Qué prueban

Cada prueba abre su propio negocio (su correo, sus productos, su existencia) por la API, así que no se estorban y corren juntas.
Lo que se comprueba al final se **pregunta al servidor**, no a la pantalla: la pantalla puede decir «enviado» y estar equivocada.

| Archivo                                 | Lo que hace                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/venta-sin-conexion.spec.ts`        | Corta la red de verdad, vende, y comprueba que la venta se guarda en el equipo, que la pantalla lo dice y que llega al servidor una vez al volver la red. También varias ventas seguidas: llegan en orden, cada una con su folio.                                                                                                      |
| `e2e/recargar-a-mitad-de-venta.spec.ts` | Recarga la página sin red: el turno y la venta guardada siguen ahí; solo se pierde el carrito que se estaba armando.                                                                                                                                                                                                                   |
| `e2e/dos-pestanas.spec.ts`              | Dos pestañas del mismo equipo venden sin red: toman los folios del mismo contador, y al volver la red ninguna manda dos veces lo mismo.                                                                                                                                                                                                |
| `e2e/dispositivos-virtuales.spec.ts`    | Tres dispositivos, cada uno con su propia cola, venden cinco ventas sin red en el orden y con los productos que decide una semilla. Al primer envío de cada uno **la respuesta se pierde** y reenvía lo mismo. El servidor termina con cada venta una vez, sin folios repetidos, la existencia justa y la caja de cada turno cuadrada. |
| `e2e/accesibilidad.spec.ts`             | axe en cada pantalla, a 375 px, en tema claro y en oscuro: las de antes de entrar, las del mostrador (de abrir turno a una venta en la lista, la venta que pide atención, cerrar turno, equipo), las de la administración y las de una cuenta sin negocio.                                                                             |
| `e2e/primera-visita.spec.ts`            | Un navegador que empieza de cero instala la aplicación **sin** avisar de una «versión nueva» (ver «Lo que encontraron»).                                                                                                                                                                                                               |

Son 16 pruebas por navegador. La semilla de los dispositivos virtuales es `E2E_SEED` (por defecto 20261022): una corrida que falla se
vuelve a vivir con `E2E_SEED=123 npm run e2e`.

## Cómo correrlas en tu máquina

Hace falta el backend clonado al lado de este repositorio (`../vsd-stock-backend`, o donde diga `VSD_BACKEND_DIR`) con sus dependencias
instaladas, y Docker para la base de trabajo:

```bash
# una sola vez, en el backend
cd ../vsd-stock-backend && npm ci && npm run db:up

# en este repositorio
npm ci
npx playwright install                 # baja Chromium, Firefox y WebKit
npm run e2e:chromium                   # el que bloquea el CI
npm run e2e                            # los tres navegadores
```

Playwright levanta solo lo demás (`playwright.config.ts`) y reutiliza lo que ya esté corriendo:

| Pieza                    | Puerto  | Qué es                                                                                                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| Identidad de mentira     | `54329` | `scripts/dev-identity.ts` del backend: habla como Supabase Auth en lo único que usan la web y la API. Sin claves reales. |
| API real                 | `3129`  | Compila el backend, deja la base con el esquema real y arranca. Sin `.env`: todo viene de la configuración.              |
| Web real                 | `4129`  | `npm run build:e2e` y `vite preview`. Es lo compilado, con su service worker.                                            |
| Base de datos de trabajo | `5433`  | La de `npm run db:up` del backend. En el CI es el servicio de PostgreSQL, en el `5432` (`E2E_DB_PORT=5432`).             |

Los puertos son raros a propósito para no chocar con `npm run dev`. La base se **borra y se vuelve a crear** en cada arranque: es de
trabajo y local.

### El modo `e2e`

La web real habla con la identidad de mentira por `http://127.0.0.1`, y la aplicación exige `https` para la identidad. Por eso existe
el modo de compilación `e2e` (`npm run build:e2e`): es el **único**, además del servidor de desarrollo, que deja `http` y solo hacia
`localhost`, `127.0.0.1` o `[::1]` (`resolveAuthConfig`). En cualquier otro modo, `http` o un servidor que no sea de la propia máquina
sigue rechazándose, y hay pruebas que lo vigilan. Lo que lleva `VITE_` queda dentro del paquete: las direcciones y la clave de mentira
(`sb_publishable_desarrollo_local`) son públicas y no abren nada.

## Los tres navegadores

- **Chromium bloquea.** Es el navegador del teléfono Android del negocio de referencia. El trabajo del CI **«Navegador real (chromium)»**
  es el que Diego marca como obligatorio cuando esté en verde. Un check del CI es su nombre: renombrarlo equivale a quitar el check
  exigido.
- **Firefox y WebKit se corren y se informan, pero no bloquean** (`continue-on-error`). Sus diferencias se miran, no se exigen. Aun así
  la primera corrida ya sirvió: WebKit encontró un fallo real.
- En el CI los informes (`playwright-report/` y `test-results/`, con las capturas y el _trace_ de lo que falló) se guardan como artefacto
  `informes-navegador-<navegador>`. Un trace se abre con `npx playwright show-trace <archivo>.zip`.
- **La descarga del navegador es lenta e irregular** en el ejecutor del CI: el 22 de octubre tardó 24 minutos para Firefox en el PR #50 y unos
  9 para Chromium después de fusionarlo, mientras Firefox terminaba todo su trabajo en 3. Por eso el trabajo guarda
  `~/.cache/ms-playwright` en la caché de GitHub, con la clave `playwright-<navegador>-<hash del package.json de @playwright/test>`: cambiar la versión
  de Playwright baja otros navegadores y estrena otra entrada. Se guarda **justo después de instalar** (no al final), para que una prueba en rojo
  no pierda lo descargado. Un PR lee la caché de su rama base: la primera corrida en `desarrollo` tras un cambio de versión la llena, y los demás PR la
  encuentran (una promoción a `preproduccion` no, porque su base es otra rama). Si la caché falla o se borra, el trabajo sigue funcionando, solo que
  lento: el plazo del trabajo (30 minutos) sigue siendo el techo.

Resultado de la corrida con la que se cerró C3-15, en Windows: **Chromium 16/16 (58 s), Firefox 16/16 (1,4 min), WebKit 16/16 (1,3 min)**.
La primera corrida, antes de los arreglos de abajo, dejó en rojo tres pruebas de accesibilidad en Chromium y dos pruebas en WebKit.

## Lo que encontraron

Para esto sirven. Lo que ya se arregló lleva su prueba; lo demás queda dicho para que alguien lo decida.

1. **«Mi turno» no cargaba contra la API real.** La web pedía `GET /v1/sales?shift=…` y el contrato dice `shiftId`; el servidor
   respondía 400 («Revisa los datos marcados»). La prueba unitaria tenía el mismo error y coincidía con el código, no con el contrato:
   solo una prueba contra la API real podía verlo. **Arreglado** (`sales-history.usecase.ts`). Se revisaron los parámetros de las demás
   consultas contra el contrato y coinciden.
2. **La lista de ventas no se actualizaba al terminar un envío.** Quien abría «Ventas» justo al volver la red veía «Todo en orden:
   ninguna venta pide atención» mientras la insignia del menú decía «Atención 1». **Arreglado**: la lista se vuelve a pedir cuando el
   equipo termina de enviar algo (no en cada vuelta en vacío), en `SalesPage.tsx`.
3. **WebKit mostraba «Hay una versión nueva de VSD Stock» en la primera visita** (en una de cada tres o cuatro). WebKit entrega el aviso
   de «instalada» cuando la página ya se ve controlada, y la aplicación decidía «esto es una actualización» mirando el control en ese
   momento. **Arreglado**: se mira si había una versión anterior al _empezar_ a instalar (`browser-app-shell-host.ts`). Lo vigila una
   prueba unitaria que lo reproduce a propósito y `e2e/primera-visita.spec.ts`, que abre cuatro navegadores nuevos seguidos.
4. **Una pestaña tarda hasta unos 30 s en enterarse de que ya no hay nada pendiente.** Con dos pestañas del mismo equipo, la que no
   envió sigue diciendo lo último que supo hasta su siguiente vuelta. Lo que importa se cumple (converge y nadie envía dos veces lo
   mismo), pero la frase puede quedar vieja un rato. **No se arregló**; la prueba espera hasta 60 s.
5. **El aviso de versión nueva ocupa casi una cuarta parte de la pantalla a 375 px** y tapa lo de abajo (por ejemplo «Cobrar» o «Nuevo
   producto») hasta que se toca «Más tarde»: el texto se estrecha en siete líneas entre los dos botones y no se reserva espacio para
   la banda. **No se arregló**: es de diseño y merece su ticket.
6. **axe no encontró ninguna violación** en las pantallas barridas, en claro ni en oscuro.

Y una limitación de la herramienta: WebKit no intercepta las peticiones (`page.route`) de una página controlada por un service worker.
Las pruebas que **pierden una respuesta a propósito** bloquean el service worker de esos dispositivos
(`newDevice(browser, { serviceWorkers: 'block' })`); el de esta aplicación solo guarda la interfaz y no toca el envío.

## Lo que no cubren

- **La cámara y el lector de códigos de barras:** necesitan un teléfono de verdad (C3-16).
- **Recargar con sesión:** la sesión vive solo en la memoria de la pestaña (ADR 0022), así que recargar la pierde. Las pruebas se
  mueven con clics y no con `page.goto`, que tiene el mismo efecto; la reconexión sin sesión («Continuar sin conexión») la cubre
  `recargar-a-mitad-de-venta.spec.ts`.
- **El candado entre pestañas, por sí solo:** si se quitara, las dos pestañas enviarían a la vez y el servidor absorbería el reenvío
  (es idempotente), así que el final seguiría siendo correcto y estas pruebas no lo verían. Lo vigilan las pruebas del motor
  (`sync-engine.usecase.spec.ts`); lo que estas ven es que, con dos pestañas, el resultado en el servidor es el correcto.
- **Cerrar y volver a abrir el navegador** con la cola llena: se prueba recargando la página, no con un perfil persistente.
- **La imagen real de un teléfono:** el emulador de Chromium cambia el ancho (375 px), no la CPU ni la red.

## Si una prueba falla

1. Corre solo esa: `npx playwright test e2e/dos-pestanas.spec.ts --project=chromium`.
2. Abre su _trace_ (`test-results/…/trace.zip`): muestra cada paso, la red y la pantalla en ese momento.
3. Si falla por tiempo, mira primero que la pila siga arriba (identidad `54329`, API `3129`, web `4129`, base `5433`).
4. Si cambiaste la web, **vuelve a compilarla con las direcciones de esta pila** (Playwright lo hace solo cuando él levanta la web;
   con una web ya corriendo, hay que repetir `npm run build:e2e` con `VITE_API_URL`, `VITE_AUTH_URL` y `VITE_AUTH_PUBLISHABLE_KEY`
   definidos, o Vite toma los de tu `.env.local`).
