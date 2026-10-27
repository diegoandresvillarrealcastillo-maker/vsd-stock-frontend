# La landing: cómo se compila, se publica y se comprueba

La página pública de VSD Stock vive en `sitio/` de este repositorio y se publica **aparte de la aplicación**, en su propio proyecto de Cloudflare Pages
(`vsd-stock-sitio`). Por qué y con qué reglas de fronteras: [ADR 0033 del backend](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0033-la-landing-vive-en-sitio-del-frontend-y-se-publica-aparte.md).
Esta guía es el camino completo: compilar, subir una vista previa, publicar la dirección pública y comprobar lo que quedó publicado.

## De un vistazo

| Para qué                             | Comando                                              |
| ------------------------------------ | ---------------------------------------------------- |
| Trabajar en la página (recarga sola) | `npm run dev:sitio`                                  |
| Compilarla en `sitio/dist`           | `npm run build:sitio`                                |
| Verla compilada, como se publica     | `npm run preview:sitio`                              |
| Subir una vista previa de tu rama    | `npm run publish:sitio -- --vista-previa`            |
| Publicar la dirección pública        | `npm run publish:sitio -- --produccion`              |
| Ver qué haría, sin compilar ni subir | agrega `--simular` a cualquiera de las dos de arriba |
| Comprobar lo publicado               | `npm run verify:sitio -- <dirección>`                |

La carpeta que se sube es `sitio/dist`: la deja `npm run build:sitio` con la página ya pintada en el HTML (el texto está en el documento sin ejecutar JavaScript) y
con el archivo `_headers` que escribe `scripts/build-sitio.ts` (política de contenido, caché y encabezados de seguridad).

## Lo que se hace una sola vez

Lo hace una persona con la cuenta de Cloudflare del proyecto, en una terminal con Node 24 dentro de este repositorio. **No se pega ninguna clave en ningún lado**:
el inicio de sesión se hace en el navegador.

1. Entrar a Cloudflare desde la terminal:

   ```bash
   npx wrangler login
   ```

2. Crear el proyecto, con `desarrollo` como su rama de producción (si ya existe, el comando falla y no pasa nada):

   ```bash
   npx wrangler pages project create vsd-stock-sitio --production-branch desarrollo --force
   ```

   El `--force` es necesario con Wrangler 4.151 o posterior: esas versiones mandan la creación a Workers y, sin él, el comando se detiene con
   «Missing entry-point to Worker script». Con `--force` crea el proyecto de Pages de todos modos. Solo se usa aquí, una vez: las subidas siguientes
   (`wrangler pages deploy`) van directo a Pages y no lo piden.

3. En el panel del proyecto, dejar **apagado Web Analytics** (Workers & Pages → el proyecto → Metrics). Si se prende, Cloudflare le agrega a la página un script de
   analítica: la página no lleva analítica (decisión del 22 de octubre), su política de contenido lo bloquearía y `npm run verify:sitio` lo marca.

**No uses `wrangler deploy`:** ese comando crea un Worker, no un proyecto de Pages. Lo que sirve es `wrangler pages deploy`, que es el que arma `npm run publish:sitio`
(con la versión mayor de Wrangler fijada, `wrangler@4`).

## Una vista previa

```bash
npm run publish:sitio -- --vista-previa
```

Sube lo que hay en tu carpeta, con la rama en la que estás, y Cloudflare imprime la dirección de la vista previa (`https://<rama>.vsd-stock-sitio.pages.dev` y la de ese
despliegue en particular). Sirve para ver la página en un teléfono o enseñársela a alguien antes de fusionar.

- Sale de **cualquier rama menos `desarrollo`**, con cambios sin confirmar si los hay. Desde `desarrollo` se niega: Cloudflare toma esa rama como la de producción y
  lo que se suba con ella sería la dirección pública.
- Sale **aunque queden pendientes** (ver abajo), pero avisa: una vista previa puede mostrarse con pendientes, no se comparte como la definitiva.
- Por omisión, cualquiera que tenga la dirección la ve. No pongas en una vista previa nada que no quieras que se vea.
- Estar en un commit suelto (sin rama) no sirve: Cloudflare necesita una rama para nombrarla. `git switch -c <rama>` y de nuevo.

## La dirección pública

```bash
npm run publish:sitio -- --produccion
```

Publica `https://vsd-stock-sitio.pages.dev`, y solo desde `desarrollo` ya fusionado: lo que revisó y fusionó la otra persona. El comando se niega, y dice **todas** las
razones juntas, mientras no se cumpla algo de esto:

- Estás en `desarrollo`: solo sale lo que ya se fusionó.
- No hay cambios sin confirmar: lo que sale es lo que está en el repositorio.
- `desarrollo` está en el mismo commit que `origin/desarrollo` (el comando lo trae antes de comparar; si falta, `git pull --ff-only`).
- **No queda nada pendiente.** Los pendientes son lo que una persona tiene que resolver antes de que la página sea pública: cada uno dice qué y quién. Viven en
  `PENDIENTES_DE_PUBLICAR`, en `sitio/pagina/pendientes.ts`; quien resuelve uno lo quita de la lista en un PR (y, si cambia lo que la página afirma, cambia
  `sitio/pagina/contenido.ts` en el mismo PR). El script decide con `puedePublicar` antes de compilar o subir nada.

Es a propósito: la dirección pública no sale por descuido ni mientras a una persona le falte resolver algo. **Hoy la lista está vacía.** El último pendiente era actualizar la respuesta sobre teléfonos con el resultado de la prueba en el Android real; el 26 de octubre de 2026 Diego decidió que esa respuesta queda como está, y la página la dice tal cual.

## Comprobar lo publicado

```bash
npm run build:sitio
npm run verify:sitio -- https://vsd-stock-sitio.pages.dev
```

Primero compila (la comprobación compara con `sitio/dist/index.html`, así que tiene que ser la misma versión que se publicó) y después pide la página como la pediría
un navegador. Para una vista previa se le pasa la dirección que imprimió Cloudflare. Sale con 0 solo si pasan las nueve:

1. **La página responde 200.**
2. **El HTML trae el texto, sin ejecutar JavaScript:** el título y el encabezado principal de la compilación están en el documento, no los pinta un script.
3. **Los archivos con huella se guardan un año:** un archivo de `/assets/` responde con `max-age` de al menos 31536000 e `immutable`.
4. **La página se revisa en cada visita:** `/` no se guarda (`no-cache` o `max-age=0`), para que quien visite vea la versión nueva tras publicar.
5. **La política de contenido está puesta:** scripts propios o con huella (nunca en línea sin ella, nunca `unsafe-eval`), conexiones solo al propio sitio (la página no le
   pregunta nada a ningún servidor desde LND-2), y nada de marcos ni plugins.
6. **Los encabezados de seguridad están puestos:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`.
7. **El enlace de WhatsApp es el de la página:** el que está en el HTML es el del contenido, con el número y el mensaje.
8. **El enlace de WhatsApp abre el chat:** `wa.me` redirige a `api.whatsapp.com` con el número del contacto.
9. **No hay analítica ni scripts de terceros:** ningún script, marco u hoja de estilo viene de otro origen (Web Analytics de Cloudflare incluido).

La 5 y la 6 son lo que `vite preview` no podía probar: las reglas de `_headers` las aplica Cloudflare, y aquí se ve que las aplicó
([`docs/rendimiento-de-la-landing.md`](rendimiento-de-la-landing.md) dejó esa comprobación para la publicación).

## Cambiar el subdominio

El subdominio es el nombre del proyecto: `vsd-stock-sitio` es `vsd-stock-sitio.pages.dev`. Un proyecto de Pages **no se puede renombrar**. Hay dos caminos:

- **Otro nombre en `pages.dev`:** crear otro proyecto con el nombre que se quiera (`npx wrangler pages project create <nombre> --production-branch desarrollo --force`), cambiar
  `PROYECTO_DEL_SITIO` en `scripts/publicar-sitio.ts` y el nombre en esta guía en el mismo PR (una prueba vigila que coincidan), publicar y verificar. El proyecto
  viejo lo borra una persona en el panel cuando ya no haga falta.
- **Un dominio propio** (cuando exista): se agrega en el panel del proyecto, en _Custom domains_, y no cambia nada de lo de arriba; se verifica con esa dirección.

Si la dirección cambia, avisa a quien tenga el enlace: el de WhatsApp y los de la aplicación de PRE se escriben en `sitio/pagina/destinos.ts`.

## A dónde lleva cada botón

Todos los destinos se escriben en un solo archivo, `sitio/pagina/destinos.ts`, y nada más en la página los repite. Desde el 25 de octubre de 2026 (decisión de
Diego: la landing se ve y, cuando alguien quiere registrarse o iniciar sesión, se le manda a la aplicación de PRE) y con los nombres de LND-2 (27 de octubre de 2026), los
botones llevan a tres lugares:

| Botón                                                                          | Lleva a                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------- |
| **Iniciar sesión** (arriba, también dentro del menú del teléfono, y en el pie) | `https://vsd-stock-pre.pages.dev/ingresar`    |
| **Solicitar mi acceso** (arriba, en la portada, en el cierre y en el pie)      | `https://vsd-stock-pre.pages.dev/registrarse` |
| **Hablar con un asesor** (la portada, el cierre y el pie)                      | el chat de WhatsApp con el mensaje ya escrito |

- **Mientras no exista PROD, la cuenta se crea en el ambiente de pruebas.** Antes la portada lo decía junto al botón; desde LND-2 la página no menciona pruebas ni ambientes
  (Diego: la imagen es la de un producto terminado), así que ese aviso salió del texto y queda aquí. Cuando exista PROD, la dirección de la aplicación se cambia en `destinos.ts`
  (`APP_DE_PRE`, de donde salen `APP_INGRESAR` y `APP_REGISTRARSE`). **Por eso el rediseño no se promueve a preproducción antes de la etapa 3** (ver más abajo).
- **La página sigue sin recoger nada.** «Iniciar sesión» y «Solicitar mi acceso» son enlaces a otra dirección: no hay formularios, correo, cookies ni analítica aquí
  (ADR 0033, punto 5). Una prueba (`test/sitio/afirmaciones.spec.ts`) exige que esas frases solo existan en esos botones y que lleven a la aplicación de PRE.
- **WhatsApp es el contacto con el asesor:** el número y el mensaje («Hola, quiero hablar con un asesor sobre VSD Stock para mi negocio.») están en `destinos.ts`.
- **El precio no está en la página:** no existe todavía y la pregunta «¿Cuánto cuesta?» responde «Cotiza con un asesor». Una prueba impide que aparezcan cifras, planes o descuentos.

## El rediseño comercial (LND-2)

**27 de octubre de 2026**, etapa 1 de 3 del rediseño que pidió Diego (la página, el ingreso y el registro, y los roles). Esta etapa es solo la página: pasó de enseñar «una
prueba» a presentar un producto terminado, escrita para el dueño de un negocio y no para quien lo construyó.

La página tiene diez secciones, en este orden y con estas anclas:

1. `#inicio`: título, subtítulo, los dos botones, tres puntos y dos capturas de la aplicación (el teléfono de la venta y el computador de las existencias).
2. `#beneficios`: cuatro beneficios del día a día.
3. `#antes-y-despues`: lo que vive un negocio sin VSD Stock y con él, en dos listas lado a lado.
4. `#funciones`: cuatro funciones grandes, cada una con la pantalla de la aplicación, y tres tarjetas chicas (sin conexión, IVA y roles).
5. `#pruebalo`: la banda azul con las tres demostraciones ([`banda-de-la-demo.md`](banda-de-la-demo.md)).
6. `#como-empezar`: los tres pasos (pedir el acceso, hablar con un asesor, empezar a vender).
7. `#para-quien`: los tres tipos de negocio.
8. `#que-incluye`: lo que hace y lo que sigue como se hace hoy (la factura electrónica, las tarjetas, la contabilidad).
9. `#preguntas`: ocho preguntas, entre ellas la del precio.
10. `#contacto`: el cierre, con los dos botones.

**Lo que ya no está:** el aviso de arriba («en pruebas»), la barra de contacto fija del teléfono, la sección «Confianza», «Lo que viene», el enlace a la web con datos
de ejemplo y el chip que decía si esa web estaba despierta. Tampoco hay clientes, testimonios ni cifras de pruebas: no los hay, y `test/sitio/afirmaciones.spec.ts` impide
que se inventen y que la página suene a prueba (el bloque «the page does not look like a test»).

**Las capturas** son de la aplicación real con datos de ejemplo («Minimercado La Esquina»), no dibujos: están en `sitio/public/capturas/` y `sitio/pagina/capturas.ts` dice
dónde está cada una y cuánto mide, para que el navegador le reserve el espacio y la página no salte al cargar. Lo que dice cada una para quien no la ve está en
`contenido.ts` (`contenido.capturas`). `test/sitio/capturas.spec.ts` comprueba que cada archivo existe, que mide lo que dice `capturas.ts`, que pesa menos de 40 KB y que no
sobra ninguno. Para volver a tomarlas (si cambia la aplicación) se levanta la pila de [`pruebas-en-navegador.md`](pruebas-en-navegador.md), se abre una tienda con ese nombre y
sus productos, se fotografía cada pantalla con Playwright (390 × 844 en el teléfono, 1.280 × 800 en el computador), se convierten a WebP con pérdida y se escriben las
medidas nuevas en `capturas.ts`. La captura del resumen del mes es la pantalla real y por eso muestra las filas «Exento» y «Excluido» que tiene el reporte.

**Cómo verla en local:**

```bash
npm run dev:sitio       # la página con recarga en caliente; Vite imprime la dirección (normalmente http://localhost:5173)
npm run build:sitio && npm run preview:sitio   # lo compilado, como se publica
```

**Lo que describe lo que todavía no existe.** «Solicitar mi acceso» y «Cómo empezar» cuentan el camino de la etapa 3 (el cliente pide el acceso, un asesor valida la
asesoría y el pago y activa la cuenta). Hoy el botón lleva a `/registrarse`, que crea la cuenta de inmediato en el ambiente de pruebas. Mientras no exista el estado
«Pendiente de validación» (la etapa 3, que necesita cambios en el backend y un ADR), la página no se promueve a preproducción ni se publica en la dirección pública.

## Cómo se escribe el texto

Todo el texto de la página vive en `sitio/pagina/contenido.ts` y se escribe en **lenguaje de tendero**: las palabras que se dicen en el mostrador, no las del
equipo que lo construyó. Una auditoría de QA (2026-10-25) leyó la página como la leería un tendero y marcó la jerga que había: «servidor», «cola de envío»,
«base», «folio», «gerencia», «demo», «tienda piloto», «Backend», «Frontend», «ADR»… Cada una tiene hoy su frase de tendero («tu cuenta», «ventas por enviar»,
«valor sin IVA», «numeración de los comprobantes», «el dueño o administrador», «prueba con ventas de ejemplo», «probarlo en mi tienda», «información técnica»).

`test/sitio/afirmaciones.spec.ts` impide que vuelvan (el bloque «the page speaks the language of a shopkeeper») y vigila lo demás que la página no puede afirmar
(facturas, tarjetas, precios, funciones que no existen). Si una palabra de la lista es de verdad necesaria en una frase, se discute antes de quitarla de la lista:
la lista es la memoria de lo que un tendero no entendió.

Esa auditoría **no fue una prueba con un tendero**, y la página no pasó por esa lectura: leerla en voz alta con una persona que atienda una tienda se pospuso el 25 de octubre de 2026, por decisión de Diego, y ya no frena la publicación (antes estaba en `sitio/pagina/pendientes.ts`). Tampoco se le preguntó a quien lleve lo legal si hace falta un aviso en la primera respuesta de WhatsApp. Las dos quedan para más adelante; no hay que decir en ningún lado que se hicieron.

## Si algo sale mal

- **Se niega a publicar:** lee las razones, que salen todas juntas. Cada una dice qué cambiar.
- **`npm run verify:sitio` dice que falta la política de contenido:** el archivo `_headers` no llegó a `sitio/dist`. Compila de nuevo con `npm run build:sitio` y vuelve a publicar.
- **La comprobación 9 falla:** casi siempre es Web Analytics prendido en el panel (ver «Lo que se hace una sola vez»).
- **Hay que volver a la versión anterior:** el panel del proyecto guarda los despliegues anteriores (Deployments) y deja volver a uno. Lo que no se arregla solo es
  el contenido: se corrige en una rama, se fusiona y se publica de nuevo.

## Lo que no comprueba

- **No prueba la página en un teléfono real ni en cada navegador.** Eso lo hacen `npm run e2e:sitio` y `npm run lighthouse:sitio` sobre la compilación local, y la prueba en
  el Android real que queda pendiente del recorrido del Ciclo 3.
- **No prueba que lo que la página dice sea verdad ni que se haya leído en voz alta** (no se ha leído en voz alta con nadie): lo que sí frena la publicación es la lista de pendientes.
- **No mide cuánto tarda en cargar desde Cloudflare** ni que comprima con Brotli: mira los encabezados, no la velocidad.
- **Pide la raíz y un solo archivo con huella**, no recorre todos los archivos del sitio.
- **El enlace de WhatsApp depende de que `wa.me` mantenga su redirección actual.** Si WhatsApp la cambia, la comprobación 8 falla y hay que mirar qué hace ahora; no significa que
  el enlace esté roto.
- **Compara con tu compilación local:** si compilaste otra versión que la que subiste, falla aunque la publicación esté bien. Compila desde el mismo commit.

## Otros documentos de la landing

- El diagrama «Cómo viaja una venta» (la máquina de las ventas, qué dice el teléfono): [`docs/diagrama-de-la-venta.md`](diagrama-de-la-venta.md).
- La banda «Pruébalo» (las pestañas Vender, IVA y Caja): [`docs/banda-de-la-demo.md`](banda-de-la-demo.md).
- Rendimiento, accesibilidad y movimiento reducido (qué se midió y el presupuesto de peso): [`docs/rendimiento-de-la-landing.md`](rendimiento-de-la-landing.md).
- Las mascotas y lo que sus historias prometen: [`docs/mascotas.md`](mascotas.md).
- La web de PRE (la aplicación, en otro proyecto de Cloudflare Pages): [`docs/despliegue-de-la-web.md`](despliegue-de-la-web.md).
