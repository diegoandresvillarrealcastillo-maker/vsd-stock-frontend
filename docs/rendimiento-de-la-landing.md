# Rendimiento, accesibilidad y movimiento reducido de la landing

Lo que C4-L7 (#63) vigila de la landing (`sitio/`, ADR 0033 del backend): que cargue rápido en un teléfono modesto, que se pueda usar
con lector de pantalla y con el tema oscuro, y que no se mueva nada si la persona pidió menos movimiento. Lo de la aplicación está
en [`rendimiento.md`](rendimiento.md); esto es solo de la landing, que se compila y se mide aparte.

Hay tres vigilantes, cada uno con lo suyo:

| Quién                        | Qué mira                                                                                            | Dónde corre                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------- |
| Lighthouse                   | Accesibilidad 100 como mínimo; rendimiento y buenas prácticas avisan por debajo de 0,9              | CI «Landing (Lighthouse)»       |
| Pruebas en un navegador real | axe en claro y oscuro, movimiento reducido, peso de la carga inicial, lo que baja aparte, política  | CI «Landing (navegador)»        |
| Pruebas de código (Vitest)   | Que los colores y las marcas que arreglaron axe y Lighthouse sigan donde están; los trabajos del CI | `npm test`, dentro de «Calidad» |

## Lo que se midió

**23 de octubre de 2026**, sobre `sitio/dist/` recién compilado, con el mismo perfil de móvil que el resto del proyecto: un
**Moto G Power**, la CPU 4 veces más lenta y una red 4G lenta simulada, en 3 corridas (la configuración está en
`lighthouserc.sitio.json` y no cambia nada de la emulación de Lighthouse).

| Corrida                   | Rendimiento | Accesibilidad | Buenas prácticas | FCP   | LCP   | TBT    |
| ------------------------- | ----------: | ------------: | ---------------: | ----- | ----- | ------ |
| Antes de L7, la primera   |        0,85 |          0,97 |             0,96 | 2,0 s | 3,1 s | 300 ms |
| Antes de L7, la segunda   |        0,95 |          0,97 |             0,96 | 2,0 s | 2,2 s | 140 ms |
| Antes de L7, la tercera   |        0,98 |          0,97 |             0,96 | 1,8 s | 2,2 s | 20 ms  |
| Después de L7, la primera |        0,97 |          1,00 |             0,96 | 2,0 s | 2,1 s | 30 ms  |
| Después de L7, la segunda |        0,99 |          1,00 |             0,96 | 1,4 s | 1,5 s | 80 ms  |
| Después de L7, la tercera |        0,97 |          1,00 |             0,96 | 2,0 s | 2,1 s | 20 ms  |

Lo que dicen esas cifras y lo que no:

- **La accesibilidad pasó de 0,97 a 100, y eso sí es de L7.** Lighthouse marcaba dos contrastes (abajo, «Lo que se arregló»).
- **El rendimiento no se puede decir que cambiara por L7.** L7 no tocó nada de lo que pesa o tarda, y los dos conjuntos se solapan
  (de 0,85 a 0,98 antes, de 0,97 a 0,99 después). Con tres corridas, lo que se ve es lo que varía de una a otra en la misma
  compilación, sobre todo el tiempo de bloqueo en una corrida en frío. Por eso el CI avisa y no bloquea con el rendimiento.
- **Buenas prácticas se queda en 0,96 por una sola cosa:** la consola anota un `Failed to load resource`. Era la consulta del chip de
  la demo (`GET /health` a la API de PRE): en el contenedor donde se midió no hay salida a esa dirección. El rediseño comercial
  (LND-2, 27 de octubre de 2026) quitó el chip y la consulta, así que esa causa ya no existe.
- **LCP:** el elemento más grande es un párrafo del hero, no una imagen, y en la corrida que se miró el 79 % de su tiempo fue espera
  entre que el contenido estaba y que se pintó, no descarga.

### El peso de la carga inicial

Las cifras de esta tabla son las de L7, de antes del rediseño comercial; las de después están más abajo, en «El rediseño comercial
(LND-2)». Es lo que baja un teléfono entre abrir la página y que la red se quede quieta, a 375 px y sin tocar nada. Lo mide
`e2e/sitio/carga-inicial.spec.ts` en el navegador real (que es quien sabe qué fuentes se piden de verdad), contando los archivos de
texto comprimidos con gzip al nivel 9, como `npm run budget` cuenta los de la aplicación, y los demás tal cual porque ya vienen
comprimidos. 1 KB son 1.024 bytes.

| Pieza             |         Pesa | De qué se compone                                                                |
| ----------------- | -----------: | -------------------------------------------------------------------------------- |
| Documento         |       9,5 KB | El HTML prerenderizado: el texto de toda la página llega sin ejecutar JavaScript |
| JavaScript        |      83,6 KB | Un solo archivo de entrada: React, el dominio que usa la página y las secciones  |
| CSS               |       7,6 KB | Tailwind con lo que usa la landing                                               |
| Fuentes           |      85,9 KB | Inter (47,1), Manrope (24,3) e IBM Plex Mono (14,5), solo el subconjunto latino  |
| Imágenes          |      45,9 KB | El logo (26,5), Ori en la entrada (9,9) y el ícono de la pestaña (9,5)           |
| **Carga inicial** | **232,5 KB** | Lighthouse la cuenta en 236 KiB con la compresión de su propio servidor          |

**Lo interactivo se carga aparte.** La calculadora de IVA (3,4 KB, 1,3 comprimido) y el arqueo de ejemplo (2,1 KB, 0,9 comprimido)
bajan cuando alguien abre su pestaña, con un esqueleto mientras llegan (C4-L6). Las otras mascotas de la página bajan cuando están
por verse. Una prueba del navegador falla si la entrada pide cualquiera de las dos demos, y otra comprueba que sí se piden al abrir
su pestaña.

**A quién le pregunta la página:** desde LND-2, a nadie más que a su propio sitio (antes preguntaba una vez a `GET /health` de la API
de PRE, por el chip de la demo, que se quitó). Una prueba falla si aparece cualquier otra dirección, y la política de contenido ya no
deja hablar con ninguna: `connect-src 'self'`.

### El presupuesto

Vive en `scripts/presupuesto-sitio.json` y lo aplica la prueba de la carga inicial, en KB comprimidos. Cada límite deja entre un
8 % y un 32 % de margen sobre lo medido: el suficiente para que un cambio de texto no rompa la prueba, y poco para que un descuido
se note. Si un límite no alcanza, se discute en el PR y se sube el número con su razón; no se quita la comprobación.

| Límite         | KB  | Razón                                                                                                                       |
| -------------- | --- | --------------------------------------------------------------------------------------------------------------------------- |
| `totalKB`      | 330 | Un 10 % sobre los 300,3 KB medidos después de LND-2 (eran 255 sobre 232,5). Avisa del engorde general                       |
| `documentoKB`  | 12  | 8,9 medidos. El texto de la página crece con cada sección; con 12 caben un par de secciones más                             |
| `javascriptKB` | 90  | 82,1 medidos. La aplicación tiene 180; la landing usa menos de la mitad                                                     |
| `cssKB`        | 10  | 7,6 medidos. La aplicación tiene 12                                                                                         |
| `fuentesKB`    | 95  | 85,9 medidos. Una letra fuera del subconjunto latino (una «ő») haría bajar otro subconjunto de Inter de 83 KB y se pasaría  |
| `imagenesKB`   | 128 | 115,8 medidos: las dos capturas de la entrada (el teléfono de la venta y el computador de las existencias) y el resto de L7 |

La cuenta es la del peor caso: `vite preview` no comprime, y Cloudflare Pages comprime con Brotli, que pesa menos que gzip.

### El rediseño comercial (LND-2)

**27 de octubre de 2026.** La landing dejó de hablarle a quien prueba y pasó a hablarle a quien compra, y eso movió tres cosas de este
documento:

- **Sube el peso de las imágenes, de 45,9 a 115,8 KB, y con él la carga inicial, de 232,5 a 300,3 KB.** La entrada muestra la aplicación
  de verdad (capturas con los datos de ejemplo de «Minimercado La Esquina», en `sitio/public/capturas/`): el teléfono de la venta y el
  computador de las existencias pesan 54 KB juntos, y el navegador baja además alguna captura que queda cerca de la pantalla. Las otras
  capturas son perezosas (`loading="lazy"`) y bajan cuando se acercan. Cada captura pesa menos de 40 KB y una prueba
  (`test/sitio/capturas.spec.ts`) lo vigila, junto con que sus medidas escritas sean las del archivo, para que la página no salte al
  cargar. Los otros límites no se movieron: el documento (8,9 KB), JavaScript (82,1 KB) y CSS (7,6 KB) quedan por debajo de lo que
  medían en L7 o igual.
- **La página ya no le pregunta nada a la API.** Se quitó el chip que despertaba la API de PRE y su consulta `GET /health`: una venta
  no necesita que un servidor de pruebas conteste para que alguien lea una página comercial, y esa consulta despertaba la API en cada
  visita. La política de contenido quedó en `connect-src 'self'`, y `scripts/verificar-sitio.ts` pide exactamente eso en lo publicado.
- **Se quitaron secciones, no solo se cambió texto.** Ya no existen el aviso de arriba, la barra de contacto fija, «Confianza», «Lo que
  viene» ni el enlace a una web con datos inventados. Las demos de IVA y de caja siguen cargando aparte, al abrir su pestaña.

Lo que se midió igual que en L7, a 375 px y sin tocar nada, con `npm run e2e:sitio`: documento 9,1 KB, JavaScript 82,1 KB, CSS 7,6 KB,
fuentes 85,9 KB, imágenes 115,8 KB y **300,3 KB** en total.

Lighthouse, con el perfil de siempre (Moto G Power, CPU 4 veces más lenta, 4G lenta), 3 corridas sobre `sitio/dist/` recién compilado:

| Corrida | Rendimiento | Accesibilidad | Buenas prácticas | FCP   | LCP   | TBT   | CLS   |
| ------- | ----------: | ------------: | ---------------: | ----- | ----- | ----- | ----- |
| Primera |        0,95 |          1,00 |             1,00 | 2,1 s | 2,6 s | 20 ms | 0,001 |
| Segunda |        0,99 |          1,00 |             1,00 | 1,4 s | 1,9 s | 20 ms | 0,001 |
| Tercera |        0,96 |          1,00 |             1,00 | 2,0 s | 2,3 s | 20 ms | 0,001 |

La accesibilidad sigue en 100 con los dos temas (lo comprueba axe en el navegador) y buenas prácticas pasó de 0,96 a 1,00: la consulta
que fallaba en la consola era la del chip. El LCP subió entre 0,4 y 0,8 s respecto a L7 porque la entrada tiene ahora dos imágenes
más que pintar; sigue por debajo de los 2,5 s «buenos» en dos de las tres corridas. **CLS de 0,001:** las capturas llevan sus medidas
escritas y la página no salta cuando llegan.

## Lo que se arregló

Todo esto lo encontraron axe en el navegador real o Lighthouse, y ninguna prueba de jsdom lo veía.

- **Los números «01», «02» y «03» de «Cómo funciona».** Iban en el gris de las líneas finas, casi blanco: 1,2:1 en el tema claro y
  1,4:1 en el oscuro, y el texto grande pide 3:1. Aunque son decoración (`aria-hidden`), axe y Lighthouse los miden igual. Ahora usan
  el color de los bordes, que llega a 3,8:1 en el claro y 5,8:1 en el oscuro sobre la tarjeta. Se marcaban desde L3.
- **La etiqueta «DECIDIDO» de «Lo que viene».** El verde sobre su propio tinte daba 4,33:1 en el tema claro y el texto pequeño pide
  4,5:1. Ahora va sobre el fondo liso: 5,4:1 en el claro y 10,7:1 en el oscuro. Lo marcó Lighthouse.
- **La franja de «EN PRUEBAS» estaba suelta.** axe pide que todo el texto de la página esté dentro de un punto de referencia
  (`region`) y la franja de arriba quedaba fuera. Ahora es un `aside` con nombre («Aviso»).
- **Nada apagaba todo el movimiento.** Cada pieza se acordaba de apagar lo suyo (el dibujo de la venta, el esqueleto, el
  desplazamiento suave), pero las transiciones de color de los botones, de las pestañas y del chevron de las preguntas seguían con
  movimiento reducido. Ahora una regla de `estilos.css` baja a una centésima de milisegundo toda transición y toda animación cuando la
  persona pidió menos movimiento, y lo que se agregue mañana queda quieto sin que nadie se acuerde.

## Qué hace cada prueba del navegador

Están en `e2e/sitio/` y no necesitan la API, la base ni el servicio de identidad.

- `accesibilidad.spec.ts`: axe sobre toda la página en tema claro y oscuro, a 375 y a 1.280 px; con cada demostración de la banda
  abierta; y con la primera y la última pregunta abiertas (las preguntas comparten nombre y se abre una sola a la vez). Hasta L7 también
  miraba el chip de la demo en cada uno de sus tres estados; el chip se quitó en LND-2.
- `movimiento-reducido.spec.ts`: con movimiento reducido, ningún elemento ni su `::before` o `::after` tiene una transición o una
  animación de más de un milisegundo, tampoco el esqueleto de una demo que se está bajando, ni se dibuja la venta viajando; sin
  pedirlo, la misma revisión sí encuentra cosas que se mueven (si no, daría verde por no mirar).
- `carga-inicial.spec.ts`: el presupuesto, que la página no le pregunta a nadie más que a su propio sitio, lo que baja aparte y que las
  imágenes de más abajo no bajan al principio.
- `politica-de-contenido.spec.ts`: la página con las reglas de `sitio/dist/_headers` puestas. `vite preview` no las aplica y entonces
  la política nunca se veía actuar; aquí se recogen los errores de consola y los bloqueos de la política mientras se abre la página y se
  usa cada cosa que baja aparte o habla con otro sitio.

## Cómo correrlo

```bash
npm run build:sitio          # compila la landing en sitio/dist/
npm run lighthouse:sitio     # Lighthouse sobre sitio/dist/ (necesita Chrome; en Linux sin Chrome, CHROME_PATH con la ruta)
npm run e2e:sitio            # las pruebas de navegador: compilan la landing, la sirven y la prueban (necesita Chromium de Playwright)
```

Los informes de Lighthouse quedan en `.lighthouseci/` y los de Playwright en `playwright-report/` y `test-results/`; el CI los guarda
14 días y ninguno se sube al repositorio. Para ver una prueba en pantalla, `npx playwright test --config e2e/sitio/playwright.config.ts
--headed`.

## Roturas a propósito

Cada regla nueva se rompió a mano y alguna prueba lo vio. Se rompió una cosa por vez, se corrió lo que la vigila y se deshizo. Las
filas de L7 nombran secciones («Cómo funciona», «Lo que viene», la franja de arriba) que el rediseño comercial (LND-2) quitó o
reemplazó; sus pruebas ya no existen con esos nombres y las roturas de LND-2 van en la tabla de más abajo.

| Se rompió                                                             | Quién lo vio                                                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Los números «01/02/03» con el gris de las líneas finas (`text-rule`)  | `ComoFunciona.spec.tsx` y axe, en claro y en oscuro (`color-contrast`)                                |
| La etiqueta «DECIDIDO» sobre su tinte (`bg-success/10`)               | `LoQueViene.spec.tsx` y axe en tema claro (2 nodos)                                                   |
| La franja de arriba como `div` y no como `aside`                      | `Anuncio.spec.tsx` y axe (`region`)                                                                   |
| Quitar de `estilos.css` la regla que apaga transiciones y animaciones | `estilos.spec.ts` y `movimiento-reducido.spec.ts`                                                     |
| `javascriptKB` de 90 a 80                                             | `carga-inicial.spec.ts`: «JavaScript pesa 83.6 KB comprimido y el presupuesto es 80 KB»               |
| Una «ő» en un texto de la página                                      | `carga-inicial.spec.ts`: las fuentes pasan de 85,9 a 169,0 KB y la carga de 232,5 a 315,6 KB          |
| Importar la calculadora de IVA de la forma normal, no con `lazy`      | `carga-inicial.spec.ts`: ya no hay un archivo aparte que se pida al abrir la pestaña                  |
| La política de contenido sin la API de PRE (`connectOrigins: []`)     | `politica-de-contenido.spec.ts` y la de «a quién le pregunta»: el navegador bloquea el chip           |
| Cambiar el nombre del trabajo de Lighthouse                           | `rendimiento-de-la-landing.spec.ts`                                                                   |
| Que la accesibilidad de Lighthouse solo avise                         | `rendimiento-de-la-landing.spec.ts`                                                                   |
| Quitar `testIgnore` de la configuración de la aplicación              | `rendimiento-de-la-landing.spec.ts`: sus pruebas arrancarían la pila de la aplicación sin necesitarla |
| Apuntar `e2e:sitio` a otra configuración                              | `rendimiento-de-la-landing.spec.ts`                                                                   |

**Las de LND-2 (27 de octubre de 2026)**, hechas con las reglas nuevas del rediseño comercial:

| Se rompió                                                                 | Quién lo vio                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| El marco de las capturas siempre perezoso, también en la entrada          | `MarcoDeCaptura.spec.tsx` y `Sitio.spec.tsx` (las imágenes de la entrada tienen que cargar ya)                         |
| Una medida de `capturas.ts` distinta a la del archivo (521 en vez de 520) | `test/sitio/capturas.spec.ts`: la página saltaría al cargar la imagen                                                  |
| «Estamos en beta» en la nota de la portada                                | `test/sitio/afirmaciones.spec.ts`, el bloque «the page does not look like a test»                                      |
| Un precio con cifras en la respuesta de «¿Cuánto cuesta?»                 | `test/sitio/afirmaciones.spec.ts`: la respuesta tiene que ser «Cotiza con un asesor» y sin números (2 pruebas)         |
| El mensaje de WhatsApp con otro texto                                     | `test/sitio/afirmaciones.spec.ts`                                                                                      |
| La política de contenido con otro origen en `connect-src`                 | `test/sitio/construccion.spec.ts` y `test/sitio/verificacion.spec.ts` (la comprobación 5 de lo publicado)              |
| El marco de las capturas sin su color (`--color-bisel`)                   | `test/sitio/estilos.spec.ts`                                                                                           |
| «Pruébalo» antes de «Funciones»                                           | `Sitio.spec.tsx`: el orden de las diez secciones                                                                       |
| Una captura sin su descripción en `contenido.ts`                          | `test/sitio/capturas.spec.ts`                                                                                          |
| La ficha de los pasos de «Cómo empezar» con el gris de las líneas finas   | `ComoEmpezar.spec.tsx`                                                                                                 |
| `imagenesKB` en 55 con las capturas de la entrada puestas                 | `carga-inicial.spec.ts`: «Las imágenes pesan 115.8 KB comprimido y el presupuesto es 55 KB» (y el total, 300.3 de 255) |

Las ayudas de las pruebas de navegador (`e2e/support/peso.ts` y `e2e/support/sitio.ts`) pasaron por Stryker con una configuración
temporal, igual que el resto de `sitio/`. La primera vuelta dio 78,31 %: faltaba probar el nivel 9 de gzip (con el de siempre las
cuentas salen distintas), los espacios alrededor del tipo, los tipos `application/font-*`, los saltos de línea de Windows, la línea
`/*` con espacios y las líneas vacías o sin dos puntos dentro del bloque de reglas, y las dos funciones que hablan con la página
(`conLasReglasDelSitio` y `responderLaSonda`) no tenían cobertura. La segunda dio **99,40 %**: 165 rotas vistas y una sin ver, que es
equivalente (el `?? ''` de `tipo.split(';')[0]`, que los tipos obligan a escribir y que nunca se usa porque `split` siempre devuelve
al menos un elemento).

## Lo que Lighthouse sugiere y no se hizo

- **El logo, `logo-stock.webp`, pesa 26,5 KB y se muestra a 87 × 60 px.** Lighthouse calcula 24 KB de ahorro si se sirviera al doble
  del tamaño en que se ve. Es arte de marca de Diego, y regenerarlo es de quien lo diseñó. Si se cambia, el presupuesto de imágenes
  baja solo de 55 a unos 30 KB y conviene bajarlo.
- **JavaScript sin usar: 38 KB.** Es React hidratando toda la página. Partir la hidratación por secciones se puede, pero cambia cómo
  carga la página y no es de esta tarea.
- **`meta description`.** El documento no la trae. Es de SEO y no entra en las categorías que se exigen aquí; queda para la
  publicación (C4-L8).
- **Tamaño del DOM y CSS que bloquea el pintado.** Lighthouse los lista sin ahorro estimado (el CSS pesa 7,6 KB).

## Lo que no cubre

- **No se midió en un teléfono real.** Lighthouse es una simulación: mide la carga, no que el toque responda en menos de 100 ms ni
  que el dibujo de la venta no se entrecorte. Igual que en la aplicación, lo único que hay son estas mediciones.
- **La política de contenido se probó con `vite preview` y las reglas de `_headers` puestas a mano**, no en Cloudflare Pages. Que
  Cloudflare las aplique igual se comprueba al publicar (C4-L8).
- **Solo Chromium.** Firefox y WebKit no corren las pruebas de la landing. axe lee el documento y no el motor, pero un layout distinto
  en Safari no se ve aquí.
- **El contraste lo miden programas.** Ninguna persona con poca visión miró la página.
- **La lectura en voz alta del texto con una persona de tienda no se ha hecho.** Era parte de lo que pide L7; el 25 de octubre de 2026 Diego
  decidió que ya no frena la publicación y la dejó para más adelante. El texto de la pestaña «Vender» (nuevo en L6) tampoco se ha leído en voz alta con nadie.
- **Ya no hay chip ni consulta a la API.** El pendiente de L7 («mirar el chip con la API de PRE realmente dormida») dejó de existir
  cuando LND-2 quitó el chip.
