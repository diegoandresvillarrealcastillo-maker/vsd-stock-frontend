# La banda «Pruébalo» de la landing

La banda azul de la landing (`sitio/`, ADR 0033) deja probar, en tres pestañas, lo que VSD Stock hace en el mostrador: **Vender** sin red, separar el **IVA** y cuadrar la **Caja**. No se necesita cuenta ni se crea nada: quien visita ve la aplicación funcionar en la misma página y, si le sirve, pide su acceso con el botón de arriba o el de abajo.

Hasta LND-2 (27 de octubre de 2026) esta banda tenía además tres cifras, un botón a una web de pruebas con datos inventados y un chip que preguntaba a la API de PRE si esa web estaba despierta. Se quitaron las tres cosas: una página comercial no manda a nadie a probar con datos falsos ni despierta un servidor de pruebas en cada visita. El nombre del archivo se quedó para no romper los enlaces.

Las tres demos no son nuevas: son el diagrama de [`diagrama-de-la-venta.md`](diagrama-de-la-venta.md) y la calculadora y el arqueo de [`demos-de-la-landing.md`](demos-de-la-landing.md). La banda solo las junta.

## Cómo está hecha

| Archivo                                  | Qué hace                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `sitio/pagina/secciones/Pruebalo.tsx`    | La banda: título y pestañas. Las demos de IVA y Caja se descargan al abrir su pestaña.                            |
| `sitio/pagina/componentes/Pestanas.tsx`  | Las pestañas, con el patrón de WAI-ARIA. No sabe nada de la demo: recibe el nombre, el id y el panel de cada una. |
| `sitio/pagina/contenido.ts` (`pruebalo`) | Todas las palabras: el título, las pestañas, el texto de Vender y lo que se lee mientras carga.                   |

## Las pestañas

- **Vender** abre primero y trae el diagrama «Cómo viaja una venta», con el interruptor «Simular una caída de internet» y una frase que lo explica. **IVA** abre la calculadora con el mismo ejemplo de la tarjeta de IVA (11.900 al 19 %). **Caja** abre el arqueo con la caja de ejemplo («Faltan $ 2.000»).
- **El diagrama sale una sola vez**, aquí. Hasta LND-2 también estaba en la entrada; ahora la entrada enseña la aplicación de verdad (dos capturas) y el dibujo animado se queda donde la persona decide tocarlo.
- **La calculadora y el arqueo bajan solo cuando alguien abre su pestaña** (dos archivos de 2 y 3,5 KB: son pocos porque el cálculo del dominio ya viaja con la entrada). Mientras bajan se ve un esqueleto del alto de una demo, y un lector de pantalla oye «Cargando la demostración…».
- **Cada panel se arma la primera vez que se elige y se queda.** Lo que se escribió en la calculadora sigue ahí al mirar la caja y volver. Los paneles (`role="tabpanel"`) existen desde el principio, vacíos, para que `aria-controls` siempre apunte a algo.
- **El teclado elige a mano.** Las flechas, Inicio y Fin mueven el foco entre las pestañas y Enter o la barra eligen. Es el patrón que WAI-ARIA recomienda cuando elegir puede descargar algo: no se baja una demo con cada flecha. Solo la pestaña elegida entra en el orden de Tab, y el siguiente Tab entra al primer campo del panel.
- Las pestañas miden 44 px de alto (ADR 0008) y a 375 px se reparten el ancho.
- Los `id` llegan por propiedad (`pruebalo-pestana-iva`, `pruebalo-panel-iva`…) y no con `useId`: da ids distintos al prerenderizar y al montar, y la prueba «es el mismo HTML que monta el navegador» lo detecta.

## Decisiones y lo que cuestan

- **La banda decide cuánto mide cada demo, no al revés.** Vender mide mucho más que Caja: la página se mueve al cambiar de pestaña. Se aceptó antes que dejar un hueco del alto de la más grande. En la pestaña Vender el texto se alinea arriba y no al centro, para no dejar un vacío azul sobre el título.
- **Las tarjetas pintan su propio texto** (`text-fg`). La banda es azul con texto blanco, y una tarjeta que solo ponía su fondo heredaba el blanco: axe encontró 16 elementos blanco sobre blanco en el tema claro (15 en la calculadora y uno en el arqueo). Pasó a ser parte de `tarjeta`, `tarjetaClara` y del diagrama, y una prueba lo vigila.
- **El texto de Vender es propio** (`pruebalo.vender`) y dice lo mismo que ya dicen el diagrama y las tarjetas. Nadie lo ha leído en voz alta con una persona que atienda una tienda, como el resto de la página; el 25 de octubre de 2026 se pospuso y ya no frena la publicación.

## Cómo verla y qué la vigila

```bash
npm run dev:sitio       # la landing con recarga en caliente
npm run build:sitio     # compila, prerenderiza y comprueba que el HTML sale igual
npm run preview:sitio   # sirve lo compilado
```

| Prueba                              | Qué vigila                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `componentes/Pestanas.spec.tsx`     | Los roles y los `aria-*`, las flechas, Inicio y Fin, que moverse no abra nada, cuándo se arma cada panel y que se conserve lo escrito.      |
| `secciones/Pruebalo.spec.tsx`       | El esqueleto mientras baja, que IVA y Caja no se armen hasta que se eligen, los ids de pestañas y paneles y la clase de las bandas oscuras. |
| `Sitio.spec.tsx`                    | Cada demo está en su pestaña y en ningún otro lado, el diagrama sale una vez y ningún `id` se repite con todo abierto.                      |
| `test/sitio/carga-perezosa.spec.ts` | Que nadie importe la calculadora ni el arqueo de la forma normal: si lo hace, dejan de bajar aparte y la pestaña no ahorra nada.            |
| `test/sitio/estilos.spec.ts`        | Que las tarjetas pinten su propio texto.                                                                                                    |
| `test/sitio/construccion.spec.ts`   | Que la política de contenido no deje hablar a nadie más que al propio sitio.                                                                |

Antes de dar por buena una banda con pestañas, ábrela en un navegador real en tema claro y oscuro, a 375 px y con el teclado, y pasa axe con cada pestaña abierta (después de que termine la transición de color de las pestañas): jsdom no ve el CSS ni los contrastes.
