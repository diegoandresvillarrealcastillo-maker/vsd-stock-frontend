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
primera instalación. **Se reconsidera si Lighthouse (C0-08) o un dispositivo real lo piden.**

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

- **Un dispositivo real de gama baja.** No tenemos uno disponible en este entorno. Es un paso manual: abrir la
  versión de producción en el teléfono más modesto del equipo, activar «Mostrar toques» y comprobar que el
  botón responde al instante y la animación no se entrecorta. **Queda pendiente para Diego.**
- **Lighthouse en el CI** (rendimiento y accesibilidad), que llega con C0-08.
- **Un presupuesto en bytes** que rompa el build si el JavaScript crece: se define cuando haya más pantallas y
  se sepa qué es razonable. Hoy lo único que impone el CI es que compile.

## Cómo repetir la medición

1. `npm run build` y sumar los archivos de `dist/assets/*.js`, con el tamaño comprimido a gzip nivel 9.
2. Para la línea base, compilar el commit anterior en una copia aparte y comparar.
3. Para los tiempos, `npm run preview` y leer `performance.getEntriesByType('paint')` en la consola.
