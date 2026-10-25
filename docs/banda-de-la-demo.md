# La banda de la demo y el chip de la demo de pruebas

La banda azul de la landing (`sitio/`, ADR 0033) tiene dos trabajos. El primero es dejar probar, en tres pestañas, lo que VSD Stock hace al mostrador: **Vender** sin red, separar el **IVA** y cuadrar la **Caja**. El segundo es decir la verdad sobre la demo de pruebas a la que lleva su botón: usa datos ficticios y, si lleva un rato sin uso, tarda en despertar. Para eso tiene un chip que pregunta una vez a la API de PRE y dice si está disponible o en reposo.

Las tres demos no son nuevas: son el diagrama de [`diagrama-de-la-venta.md`](diagrama-de-la-venta.md) y la calculadora y el arqueo de [`demos-de-la-landing.md`](demos-de-la-landing.md). La banda solo las junta.

## Cómo está hecha

| Archivo                                            | Qué hace                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `sitio/pagina/secciones/Demo.tsx`                  | La banda: título, pestañas, tres cifras, el botón a la demo de pruebas y el chip. Las demos de IVA y Caja se descargan al abrir su pestaña. |
| `sitio/pagina/componentes/Pestanas.tsx`            | Las pestañas, con el patrón de WAI-ARIA. No sabe nada de la demo: recibe el nombre, el id y el panel de cada una.                           |
| `sitio/pagina/secciones/ChipDePre.tsx`             | El chip: una frase y un punto de color según el estado.                                                                                     |
| `sitio/pagina/demos/estadoDePre.ts`                | La consulta a la API de PRE y el estado (`verificando`, `despierta`, `dormida`), sin React. Se prueba sola, con un `fetch` de mentira.      |
| `sitio/pagina/contenido.ts` (`demo`, `estadoDemo`) | Todas las palabras: las pestañas, el texto de Vender, lo que se lee mientras carga y las tres frases del chip.                              |
| `sitio/pagina/destinos.ts`                         | Las direcciones: la API de PRE (`API_DE_PRE`) y la web de PRE (`DEMO_DE_PRE`, el enlace público).                                           |

## Las pestañas

- **Vender** abre primero y trae el diagrama «Cómo viaja una venta», con el interruptor «Simular una caída de internet» y una frase que lo explica. **IVA** abre la calculadora con el mismo ejemplo de la tarjeta de IVA (11.900 al 19 %). **Caja** abre el arqueo con la caja de ejemplo («Faltan $ 2.000»).
- **La calculadora y el arqueo viven aquí, ya no debajo de las tarjetas ni de los pasos.** Tenerlos dos veces en la página era una calculadora repetida a dos pantallas de distancia. Bajan solo cuando alguien abre su pestaña (dos archivos de 2 y 3,5 KB: son pocos porque el cálculo del dominio ya viaja con la entrada). Mientras bajan se ve un esqueleto del alto de una demo, y un lector de pantalla oye «Cargando la demostración…».
- **Cada panel se arma la primera vez que se elige y se queda.** Lo que se escribió en la calculadora sigue ahí al mirar la caja y volver. Los paneles (`role="tabpanel"`) existen desde el principio, vacíos, para que `aria-controls` siempre apunte a algo.
- **El teclado elige a mano.** Las flechas, Inicio y Fin mueven el foco entre las pestañas y Enter o la barra eligen. Es el patrón que WAI-ARIA recomienda cuando elegir puede descargar algo: no se baja una demo con cada flecha. Solo la pestaña elegida entra en el orden de Tab, y el siguiente Tab entra al primer campo del panel.
- Las pestañas miden 44 px de alto (ADR 0008) y a 375 px se reparten el ancho.
- Los `id` llegan por propiedad (`demo-pestana-iva`, `demo-panel-iva`…) y no con `useId`: da ids distintos al prerenderizar y al montar, y la prueba «es el mismo HTML que monta el navegador» lo detecta.

## El chip

Dice siempre que los datos son ficticios, y cambia según lo que contesta la API de PRE:

| Estado        | Qué dice                                                                  | Cuándo                                                 |
| ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| `verificando` | «Revisando si la prueba está lista… Usa datos ficticios.»                 | Desde que carga la página hasta los 3 s o la respuesta |
| `despierta`   | «Prueba con ventas de ejemplo disponible · datos ficticios»               | La API contestó, a la hora que sea                     |
| `dormida`     | «Prueba en reposo; la primera carga puede tardar ~25 s · datos ficticios» | No contestó en 3 s, o la conexión falló                |

Ningún estado dice «caída», «falla» ni «error»: la API de PRE vive en un plan gratuito que se duerme a los 15 minutos, y un servidor dormido no está roto. Una prueba lo vigila en el texto y otra en lo que se pinta.

**Cómo pregunta.**

- Un solo `GET <API de PRE>/health` por carga de la página, en modo `no-cors`, sin credenciales, sin cabeceras propias, sin decir desde qué página se pregunta (`referrerPolicy: 'no-referrer'`) y sin guardar nada en caché. En el navegador real el pedido sale sin cookie, sin `Origin` y sin `Referer`.
- **No se agrega ningún origen a las reglas CORS de la API.** En modo `no-cors` el navegador no deja leer la respuesta (es «opaca»), pero lo único que hace falta saber es si el servidor contestó. La política de contenido de la landing ya deja que la página le hable a la API de PRE (`connect-src`) y a nadie más.
- La consulta empieza cuando el chip se monta en el navegador, no en el servidor: el HTML prerenderizado siempre dice «verificando», igual que lo primero que pinta el navegador, y la hidratación no se desordena. Si el chip se monta y se desmonta (React lo hace una vez en desarrollo), la pregunta no se repite ni se cancela.
- Espera 3 s antes de decir «en reposo» y se rinde a los 30 s, más que los ~25 s que la página promete. Si la API contesta entre un momento y el otro, el chip pasa de «en reposo» a «disponible»: sí despertó.

**Lo que no sabe.**

- Como la respuesta es opaca, no distingue un 200 de un 500: cualquier respuesta del servidor cuenta como «despierta». Sirve para saber si despertó, no si está sana.
- Una conexión que falla enseguida (la persona sin internet, un bloqueador) también dice «en reposo»: la frase sigue siendo cierta y la persona no podría abrir la demo de todos modos. El navegador anota esa conexión fallida en la consola, y eso no se puede silenciar desde la página. Con la API despierta, o que tarda en contestar, no apareció ningún error en la consola.
- La consulta es una petición normal a la API, así que puede empezar a despertar el servidor. No lo medimos y la página no depende de ello.

## Decisiones y lo que cuestan

- **El diagrama sale dos veces:** arriba, en la entrada, y en la pestaña Vender. La pestaña lo necesitaba (la issue pide reutilizar lo de L4) y quitar el de la entrada dejaría el primer pantallazo sin su dibujo. El costo es que quien baja ve el mismo dibujo otra vez. Si Diego prefiere uno solo, es quitar una de las dos líneas (`Hero.tsx` o la pestaña en `Demo.tsx`). Cada copia lleva sus `id` (`diagrama-…` y `demo-diagrama-…`), y cada una se detiene cuando sale de pantalla (una pestaña escondida cuenta como fuera), así que en la práctica solo corre la que se ve.
- **La banda decide cuánto mide cada demo, no al revés.** Vender mide 725 px a 1280, IVA 387 y Caja 246: la página se mueve al cambiar de pestaña. Se aceptó antes que dejar un hueco del alto de la más grande.
- **Las tarjetas pintan su propio texto** (`text-fg`). La banda es azul con texto blanco, y una tarjeta que solo ponía su fondo heredaba el blanco: axe encontró 16 elementos blanco sobre blanco en el tema claro (15 en la calculadora y uno en el arqueo). Pasó a ser parte de `tarjeta`, `tarjetaClara` y del diagrama, y una prueba lo vigila.
- **El texto de Vender es nuevo** (`demo.vender`) y dice lo mismo que ya dicen el diagrama y las tarjetas. Falta que alguien lo lea en voz alta con una persona que atienda una tienda, como el resto de la página.

## Cómo verla y qué la vigila

```bash
npm run dev:sitio       # la landing con recarga en caliente
npm run build:sitio     # compila, prerenderiza y comprueba que el HTML sale igual
npm run preview:sitio   # sirve lo compilado
```

Para ver el chip en cada estado sin esperar a la API, intercepta `GET /health` en el navegador (por ejemplo con las herramientas de desarrollo): contesta enseguida para «disponible», tarda 4 s para ver «en reposo» y después «disponible», o cancélalo para «en reposo» al instante.

| Prueba                              | Qué vigila                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `demos/estadoDePre.spec.ts`         | La forma exacta del pedido, los 3 y los 30 segundos, la respuesta tardía, que se pregunte una sola vez y que no queden temporizadores.   |
| `secciones/ChipDePre.spec.tsx`      | Lo que dice en cada estado, que siempre diga «ficticios» y nunca «caída», que el servidor pinte «verificando» y que no pregunte nada.    |
| `componentes/Pestanas.spec.tsx`     | Los roles y los `aria-*`, las flechas, Inicio y Fin, que moverse no abra nada, cuándo se arma cada panel y que se conserve lo escrito.   |
| `secciones/Demo.spec.tsx`           | El esqueleto mientras baja, que IVA y Caja no se armen hasta que se eligen, el enlace público a PRE, el chip y las tres cifras.          |
| `Sitio.spec.tsx`                    | Cada demo está en su pestaña y en ningún otro lado, el diagrama sale dos veces con ids propios y ningún `id` se repite con todo abierto. |
| `test/sitio/carga-perezosa.spec.ts` | Que nadie importe la calculadora ni el arqueo de la forma normal: si lo hace, dejan de bajar aparte y la pestaña no ahorra nada.         |
| `test/sitio/estilos.spec.ts`        | Que las tarjetas pinten su propio texto.                                                                                                 |
| `test/sitio/construccion.spec.ts`   | Que la política de contenido deje hablar solo a la API de PRE.                                                                           |

Antes de dar por buena una banda con pestañas y un chip, ábrela en un navegador real en tema claro y oscuro, a 375 px y con el teclado, y pasa axe con cada pestaña abierta (después de que termine la transición de color de las pestañas): jsdom no ve el CSS ni los contrastes.
