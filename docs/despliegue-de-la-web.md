# Desplegar la web de PRE en Cloudflare Pages

Cómo se publica la web de PRE por **HTTPS** (C3-14, [ADR 0031](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0031-hosts-de-pre-render-y-cloudflare-pages.md)
del backend). **Lo crea una persona** en el panel de Cloudflare: el asistente de código no opera paneles ni guarda claves. Aquí está la
lista para seguir, la configuración que el repositorio ya trae y cómo comprobar que quedó bien.

Sin HTTPS no hay service worker (la aplicación no abre sin internet), ni cifrado de lo guardado (WebCrypto), ni cámara en un teléfono
([ADR 0018](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0018-cifrado-local-y-olvido-del-dispositivo.md)).
Cloudflare Pages da HTTPS sin configurar nada y en su plan gratuito.

## Antes de empezar

- La API de PRE ya está en pie en Render (el backend trae `render.yaml` y sus pasos en `docs/ambientes.md`) y se sabe su dirección,
  algo como `https://vsd-stock-api-pre.onrender.com`.
- El proyecto de Supabase de PRE existe y se sabe la dirección de su servicio de identidad y su **clave publicable**.
- **PROD sigue en pausa:** nada de esto lo crea ni lo configura. La web de PRE sigue la rama `preproduccion`, que solo se actualiza
  cuando el dueño del proyecto aprueba la promoción `desarrollo → preproduccion` (ADR 0010).

## Los pasos

1. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** y elegir el repositorio `vsd-stock-frontend`.
2. **Rama de producción:** `preproduccion`. En _Branch control_ de las ramas de vista previa (_preview deployments_) elegir **None**:
   solo se publica lo que el dueño aprobó.
3. **Ajustes de compilación:**

   | Ajuste                  | Valor                            |
   | ----------------------- | -------------------------------- |
   | Framework preset        | None                             |
   | Build command           | `npm run build`                  |
   | Build output directory  | `dist`                           |
   | Root directory          | (vacío: la raíz del repositorio) |
   | Variable `NODE_VERSION` | `24`                             |

   `NODE_VERSION` es necesaria: la compilación termina con `node scripts/build-service-worker.ts`, que corre TypeScript directamente
   y pide Node 24 (es lo que dice `.nvmrc` y `engines` en `package.json`).

4. **Variables de entorno** (_Settings → Variables and Secrets_, en el ambiente de producción). Las tres se **fijan al compilar**:
   Vite las escribe dentro del JavaScript. **Si cambias una, hace falta un nuevo despliegue** (_Retry deployment_ o un commit).

   | Variable                    | Qué lleva                                                                                          |
   | --------------------------- | -------------------------------------------------------------------------------------------------- |
   | `VITE_API_URL`              | La dirección de la API de PRE, con `https://`, sin barra al final, sin credenciales ni parámetros. |
   | `VITE_AUTH_URL`             | La del servicio de identidad: `https://REF.supabase.co/auth/v1`.                                   |
   | `VITE_AUTH_PUBLISHABLE_KEY` | La clave **publicable** de Supabase (`sb_publishable_...`).                                        |

   **Todo lo que se compila es público:** lo descarga el navegador de cualquiera. Por eso aquí **nunca** va una clave secreta
   (`sb_secret_...`, `service_role`, la contraseña de la base de datos): la aplicación se niega a arrancar si encuentra una, y aunque no
   lo hiciera, quedaría a la vista. La clave publicable está hecha para eso. Los ejemplos están también en `.env.example`.

5. **Guardar y desplegar.** Cloudflare compila y publica. Anota la dirección que te da, algo como `https://vsd-stock-pre.pages.dev`.
6. **Volver a la API y dejar pasar a la web:** en Render, la variable `CORS_ORIGINS` de la API es la dirección **exacta** de la web
   (esquema y host, **sin barra al final**, sin ruta). Un error ahí se ve en el navegador como «blocked by CORS policy» y la aplicación
   dice que no hay conexión con el servidor. Después de cambiarla, Render reinicia la API.

## Si el panel solo ofrece crear un Worker: la subida directa

El 22 de octubre de 2026, en una cuenta de Cloudflare nueva, el asistente de **Workers & Pages → Create** solo ofrecía crear un **Worker**, y
los pasos 1 a 5 (_Connect to Git_) no existían en la pantalla. Se publica igual en **Cloudflare Pages**, sin Git, desde un computador con
Node 24. Es el mismo proyecto de Pages (la misma dirección `*.pages.dev`, los mismos encabezados de `public/_headers`); cambia **cómo llega
el código**. **No uses `wrangler deploy`:** ese comando crea un Worker, no un proyecto de Pages. El comando es `wrangler pages deploy`.

En una copia limpia de la rama `preproduccion` (PowerShell; las tres variables son las del paso 4 y se escriben ahí mismo, sin guardarlas en
ningún archivo):

```powershell
git switch preproduccion; git pull
npm ci
$env:VITE_API_URL = 'https://TU-API.onrender.com'
$env:VITE_AUTH_URL = 'https://REF.supabase.co/auth/v1'
$env:VITE_AUTH_PUBLISHABLE_KEY = 'sb_publishable_...'
npm run build
Remove-Item Env:VITE_API_URL, Env:VITE_AUTH_URL, Env:VITE_AUTH_PUBLISHABLE_KEY
npx wrangler login
npx wrangler pages project create vsd-stock-pre --production-branch preproduccion
npx wrangler pages deploy dist --project-name vsd-stock-pre --branch preproduccion --commit-dirty=true
```

- `wrangler login` abre el navegador para entrar a Cloudflare: no se pega ninguna clave. `project create` solo se hace la primera vez (si el
  proyecto ya existe, falla y no pasa nada).
- Si la subida imprime otra dirección para la rama `preproduccion`, esa es la de la web, y es la que va en `CORS_ORIGINS` (paso 6).
- **No hay despliegue automático:** la web de PRE cambia cuando alguien repite `npm run build` y el `deploy`. Si `preproduccion` recibe una
  promoción y nadie lo hace, la web se queda con la versión vieja sin que nada avise. Después de cada promoción, comprobar con
  `npm run verify:deploy` (abajo) que la web responde y mirar en Cloudflare que el último despliegue sea de hoy.

## Lo que el repositorio ya trae

- **`public/_headers`:** Cloudflare Pages lo lee del propio sitio y no lo sirve. Lo que dice:
  - `/sw.js`, `/manifest.webmanifest`, `/` e `/index.html`: `Cache-Control: no-cache`. El navegador pregunta cada vez si cambiaron, y así
    una versión nueva de la aplicación se encuentra (el navegador compara `sw.js` byte a byte).
  - `/assets/*`: `public, max-age=31536000, immutable`. Vite le pone una huella del contenido al nombre de cada archivo, así que un
    archivo nuevo es otro nombre y el viejo se puede guardar un año.
  - Para todo: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` y
    `Permissions-Policy` con la cámara, el micrófono y la ubicación apagados (la aplicación todavía no usa ninguno).
  - **La regla de todo (`/*`) no lleva `Cache-Control`.** Cloudflare junta con coma el mismo encabezado de todas las reglas que calzan con
    una ruta; si `/*` lo pusiera, se mezclaría con el de `sw.js` y el de los archivos con huella. Una prueba lo vigila
    (`test/deploy/web-headers.spec.ts`).
- **No hay `404.html`, a propósito.** Cuando un sitio de Cloudflare Pages no trae uno, sirve `index.html` para cualquier ruta, y eso es lo
  que necesita una aplicación de una sola página: abrir `/mostrador` directamente o recargarlo no da un error. **No agregues un
  `404.html`**: con uno, esas rutas dejarían de funcionar. Tampoco hace falta un `_redirects`.
- **El service worker no guarda `_headers`:** el script que lo escribe (`scripts/build-service-worker.ts`) deja fuera las reglas del host,
  porque se leen y no se sirven, y una sola petición que falle detiene la instalación de la aplicación.
- **Sin Content-Security-Policy todavía.** Tendría que nombrar las direcciones de la API y del servicio de identidad, que cambian por
  ambiente y se fijan al compilar; hacerla bien pide generarla en la compilación. No se hace a medias: una CSP que bloquea de más rompe la
  aplicación sin avisar. Queda como una mejora para después de PRE.

## Comprobar que quedó bien

**Desde un computador**, en la carpeta del backend (no toca la base de datos ni pide ninguna clave; imprime un informe sin secretos):

```bash
npm run verify:deploy -- https://TU-API.onrender.com https://TU-WEB.pages.dev
```

Dice, entre otras cosas: que las dos direcciones son HTTPS, cuánto tardó la API en despertar, que la API da permiso de CORS **solo** a la
web, que la web sirve la aplicación desde cualquier ruta, que publica el manifiesto y un `sw.js` sin caché larga y que guarda un año
los archivos de `/assets/`. Sale con 0 solo si todo pasó.

**Desde un teléfono** (lo que importa de verdad; lo mide C3-16):

1. Abre la dirección de la web en Chrome (Android). La primera vez la API puede tardar cerca de un minuto en despertar: la aplicación
   dice «Sin conexión» mientras tanto y **no se pierde nada** (lo que se hace queda en el equipo y se envía solo).
2. Inicia sesión. Instala la aplicación (menú → _Instalar aplicación_ o _Agregar a la pantalla principal_).
3. Pon el teléfono en **modo avión** y ábrela: tiene que abrir, mostrar el mostrador y dejar vender.
4. Quita el modo avión: lo que se vendió sin conexión se envía y el estado dice «Todo enviado».

## Volver atrás

Cloudflare Pages guarda los despliegues anteriores: **Deployments → el anterior → Rollback to this deployment**. Es inmediato y no toca la
API ni la base de datos. Una migración de la base **no** se revierte sola (`docs/ambientes.md` del backend).

## Lo que no se decidió aquí

- **Un dominio propio.** PRE usa la dirección `*.pages.dev`. Si se agrega un dominio, hay que cambiar `CORS_ORIGINS` en la API y volver a
  correr `verify:deploy`.
- **Las ramas de vista previa** quedan apagadas (paso 2). Si algún día se encienden, sus direcciones tendrían que entrar a `CORS_ORIGINS`
  una por una (no se acepta un comodín), y compilarían contra la API de PRE.
- **PROD.** Está en pausa; cuando exista, será otro proyecto de Cloudflare Pages, otra rama y otras variables, con su propio ADR.
- **El despliegue automático de la web.** Con la subida directa no existe (ver arriba). Para PROD hay que decidir entre conectar Git, si el
  panel lo ofrece, o una acción del CI que corra `wrangler pages deploy` con un token de API de Cloudflare guardado como secreto del
  repositorio. No se decidió aquí: va en el ADR de PROD, antes de que PROD exista.
