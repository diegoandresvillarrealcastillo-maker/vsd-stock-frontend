# Rendimiento: línea base y mediciones

El ADR 0008 fija el presupuesto del punto de venta: **respuesta visible al tocar en menos de 100 ms y 60 fps en
un teléfono de gama baja**. También deja una hipótesis sin medir: que `LazyMotion` con los componentes `m`
reduce el peso de Framer Motion. Este documento registra lo que medimos en C0-07 y lo que todavía no.

> Las cifras son de la versión de producción (`npm run build`). Se repiten con cada cambio grande de
> dependencias; esta tabla se actualiza en el mismo PR que lo cambia.

## Peso del JavaScript

Medido sobre `dist/assets/*.js`, con gzip al nivel 9 en todas las filas para que sean comparables (Vite
muestra cifras de gzip un poco más altas con su propio nivel).

| Variante                                                      | JavaScript | Comprimido | Diferencia con React solo |
| ------------------------------------------------------------- | ---------: | ---------: | ------------------------- |
| React solo (C0-06, línea base)                                |   219,8 KB |    67,8 KB | —                         |
| **`LazyMotion` + `m` (lo que usamos)**                        |   312,5 KB |    99,8 KB | +92,6 KB (+42 %)          |
| `motion` completo, sin `LazyMotion`                           |   360,1 KB |   113,3 KB | +140,2 KB (+64 %)         |
| `LazyMotion` con las funciones en un archivo aparte (inicial) |   269,6 KB |    85,3 KB | +49,8 KB (+23 %)          |
| …y el archivo aparte, que se descarga después                 |    46,6 KB |    17,7 KB | —                         |

El CSS de Tailwind pesa **13,8 KB (3,7 KB comprimido)**: solo genera las clases que se usan.

### Resultado de la hipótesis del ADR 0008

**Se confirma.** `LazyMotion` con `m` pesa 47,6 KB menos que `motion` completo (13 % menos) y 13,5 KB menos
comprimido (12 % menos). Es la forma que usamos, y `MotionProvider` la hace obligatoria: con `strict`, usar
`motion` por descuido lanza un error.

**Pero Framer Motion sigue siendo caro:** con `LazyMotion` suma 92,6 KB (42 %) sobre React solo. Es el costo más
grande del paquete y es lo primero que hay que mirar si el punto de venta no cumple el presupuesto en un
teléfono de gama baja.

### Alternativa que medimos y no adoptamos

Cargar las funciones de animación en un archivo aparte (`features={() => import(...)}`) baja el JavaScript
inicial a 269,6 KB, pero el total sube un poco (316,2 KB) y añade una segunda petición y un momento en que los
componentes `m` todavía no animan. No probamos cómo se comportan las salidas animadas en ese intervalo. Como la
aplicación se instala como PWA y guarda todo para funcionar sin conexión, el peso importa sobre todo en la
primera instalación. **Se reconsidera si Lighthouse o un dispositivo real lo piden.** Lighthouse (C0-08) da
rendimiento 99 con la carga sincrónica, así que hoy no hace falta.

### Después de C0-10 (marca, botón de tema y logo)

Misma medición (gzip al nivel 9) sobre la compilación de C0-10:

| Pieza                                          | Antes (C0-07) | Ahora (C0-10) | Diferencia |
| ---------------------------------------------- | ------------: | ------------: | ---------: |
| JavaScript                                     |      312,5 KB |      316,5 KB |    +4,1 KB |
| JavaScript comprimido                          |       99,8 KB |      101,0 KB |    +1,2 KB |
| CSS                                            |       14,2 KB |       15,1 KB |    +0,9 KB |
| Logo (`logo-stock.webp`, aparte, una sola vez) |             — |       27,1 KB |   +27,1 KB |

El logo original de la landing es un WebP de 124 KB a 700 px; para la banda se recortó, se redujo a 420 px
(el doble de lo que se muestra, 208 px) y se comprimió a **27 KB**. Es una imagen, no JavaScript: no bloquea el
arranque de React, y el `<img>` lleva `width` y `height` para que el navegador reserve el espacio y la página
no salte cuando llega. El favicon (el cubo del logo) pesa 10 KB.

### Después de C0-08 (conexión, contrato y tipos)

| Pieza                 | Antes (C0-10) | Ahora (C0-08) | Diferencia |
| --------------------- | ------------: | ------------: | ---------: |
| JavaScript            |      316,5 KB |      324,0 KB |    +7,5 KB |
| JavaScript comprimido |      101,0 KB |      103,3 KB |    +2,3 KB |
| CSS                   |       15,1 KB |       16,2 KB |    +1,1 KB |

Es el caso de uso de conexión, sus tres adaptadores, el panel y su proveedor. **El contrato y los tipos
generados no pesan nada en el navegador**: `schema.d.ts` solo tiene tipos y desaparece al compilar, y
`openapi-typescript` es una herramienta de desarrollo. Tampoco entra ninguna biblioteca de cliente HTTP: el
adaptador usa `fetch`.

### Después de C2-08 (sesión, rutas y navegación)

| Pieza                 | Antes (C0-08) | Ahora (C2-08) | Diferencia |
| --------------------- | ------------: | ------------: | ---------: |
| JavaScript            |      324,0 KB |      376,3 KB |   +52,3 KB |
| JavaScript comprimido |      103,3 KB |      119,7 KB |   +16,4 KB |
| CSS                   |       16,2 KB |       17,4 KB |    +1,2 KB |

Casi todo es **`react-router`** (el enrutador), más la sesión, el cliente del servicio de identidad, la pregunta «quién
soy», las guardas de rutas y el marco con el menú. La sesión y la API usan `fetch` y no traen ninguna biblioteca (ni
cliente de Supabase ni de HTTP). Es el mayor aumento desde C0-07 pero sigue lejos de lo que costó Framer Motion.
Lighthouse sobre la página pública (3 corridas, mismas condiciones de abajo): **rendimiento 98 y 99, accesibilidad 100,
mejores prácticas 96**; LCP de 2,0 a 2,3 s, TBT de 0 a 44 ms y CLS 0.

## Lighthouse: lo más cercano a un teléfono de gama baja

**Decisión (2026-10-16):** el equipo no tiene un teléfono de gama baja, así que la comprobación en un
dispositivo real se sustituye por Lighthouse en cada PR. Lighthouse audita `dist/` con la emulación de un
**Moto G Power (2022)**, la **CPU 4 veces más lenta** y una **red 4G lenta simulada** (1,6 Mbps de bajada y
150 ms de latencia), y se ejecuta 3 veces. Mediana de las tres, con el código de C0-08:

| Medida                                  | Resultado                          |
| --------------------------------------- | ---------------------------------- |
| Accesibilidad                           | **100** (el CI exige 100)          |
| Rendimiento                             | **99** (el CI avisa si baja de 90) |
| Mejores prácticas                       | 96 (el CI avisa si baja de 90)     |
| Primer contenido pintado (FCP)          | 1,5 s                              |
| Mayor contenido pintado (LCP)           | 1,8 s                              |
| Tiempo de bloqueo total (TBT)           | 16 ms                              |
| Desplazamiento acumulado de diseño      | 0,026                              |
| Peso transferido (con el logo de 27 KB) | 145,6 KB                           |

Lo que se ve en esas cifras y lo que no:

- **El 0,026 de desplazamiento y el punto que pierde «Mejores prácticas» tienen la misma causa**, y no es un
  defecto: la compilación que se audita no tiene una API detrás, así que `GET /health` responde 404 (el error de
  consola), el panel pasa a «Sin conexión» y su botón «Reintentar» empuja 60 px hacia abajo la sección de
  abajo. Con la API en pie el panel mide lo mismo en «Comprobando» y en «En línea» (102 px) y no hay
  desplazamiento. Que el panel crezca al perderse la conexión es el comportamiento diseñado.
- **Es una simulación, no un teléfono.** Lighthouse mide la carga (cuándo aparece el contenido y cuánto se
  bloquea el hilo principal). **No mide lo que fija el ADR 0008 para el punto de venta**: que el toque responda
  en menos de 100 ms y que la animación no se entrecorte a 60 fps. Para eso solo tenemos la medición de
  escritorio de más abajo.
- **Audita el tema claro.** El oscuro lo cubren las pruebas de contraste de `test/design/tokens.spec.ts`, que
  leen el CSS y exigen AA en los dos temas.

## Tiempos medidos

Chromium automatizado, en un computador de escritorio, contra `vite preview` en `localhost`, **sin limitar la
CPU ni la red**:

| Medida                                                 | Resultado |
| ------------------------------------------------------ | --------- |
| Primer contenido pintado (FCP) y mayor contenido (LCP) | 112 ms    |
| Del toque al siguiente fotograma con el cambio pintado | 11 ms     |
| Peor intervalo entre fotogramas durante la animación   | 9 ms      |

Sirven para saber que la pantalla de muestra **no tiene un problema evidente**, no para afirmar que cumple el
presupuesto: un escritorio no es un teléfono de gama baja.

## Lo que falta

- **La respuesta al toque y los 60 fps en un teléfono de gama baja.** Es lo que fija el ADR 0008 y nada de lo
  anterior lo mide en un dispositivo lento. El equipo no tiene uno (ver arriba), así que el riesgo queda
  **aceptado y a la vista**: la primera pantalla donde importa de verdad es el punto de venta (Ciclo 3), y ahí
  hay que medirlo con un teléfono prestado o con la CPU limitada en las herramientas del navegador. Si alguien
  consigue uno antes: abrir la versión de producción, activar «Mostrar toques» y comprobar que el botón responde
  al instante y la animación no se entrecorta.
- **Un presupuesto en bytes** que rompa el build si el JavaScript crece: se define cuando haya más pantallas y
  se sepa qué es razonable. Hoy lo único que impone el CI es que compile y que Lighthouse no baje de 90 en
  rendimiento (solo avisa).

## Cómo repetir la medición

1. `npm run build` y sumar los archivos de `dist/assets/*.js`, con el tamaño comprimido a gzip nivel 9.
2. Para la línea base, compilar el commit anterior en una copia aparte y comparar.
3. Para los tiempos, `npm run preview` y leer `performance.getEntriesByType('paint')` en la consola.
4. Para Lighthouse, `npm run build` y `npm run lighthouse` (necesita Chrome; en Windows, la variable
   `CHROME_PATH` con la ruta de `chrome.exe`). Los informes quedan en `.lighthouseci/`, que no se sube.
