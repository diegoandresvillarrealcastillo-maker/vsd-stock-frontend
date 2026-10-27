# El diagrama «Cortar internet» de la landing

El primer dibujo de la landing (`sitio/`, ADR 0033) cuenta lo que hace VSD Stock sin decirlo: una venta pasa del mostrador a las ventas por enviar (la cola), de ahí por internet a la cuenta del negocio (el servidor) y al libro de movimientos. La persona que visita la página puede **simular una caída de internet** con un interruptor y ver que la venta no se pierde: se queda guardada en el equipo y se envía, una tras otra, cuando la red vuelve. El interruptor y los puestos dicen «Simular una caída de internet», «Ventas por enviar» y «Tu cuenta» porque una auditoría de QA (2026-10-25) leyó la página como un tendero y «Cortar internet», «Cola de envío» y «Servidor» no se entendían o parecían una acción de verdad.

Es un dibujo. No llama a ninguna API, no guarda nada y los folios (`K7-000142`) son de ejemplo. Lo que sí es real es lo que dice: los textos de «Sin conexión», «por enviar» o «Todo enviado» los escribe el mismo código que los dice en la aplicación.

## Cómo está hecho

| Archivo                                    | Qué hace                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `sitio/pagina/diagrama/maquina.ts`         | La lógica, sin React ni animación: el estado (conexión, cola, libro), los pasos y lo que dicen el teléfono y Ori. Se prueba sola. |
| `sitio/pagina/diagrama/ritmo.ts`           | Cuánto espera cada paso y cuánto tarda en llegar. Es el único reloj del dibujo: el CSS lee estos números, no tiene los suyos.     |
| `sitio/pagina/diagrama/useVentaEnVivo.ts`  | Hace avanzar la máquina con temporizadores, mientras el dibujo se ve y nadie pidió menos movimiento.                              |
| `sitio/pagina/secciones/DiagramaVenta.tsx` | Dibuja el estado: el interruptor, el teléfono, los cuatro puestos, el enlace y la venta que viaja.                                |
| `sitio/pagina/estilos.css` (`.viaje`)      | La animación de la venta que viaja: una bolita por una línea recta, solo con `transform` y `opacity` (ADR 0008).                  |
| `sitio/pagina/contenido.ts` (`diagrama`)   | Todas las palabras, como en el resto de la página.                                                                                |

## Las reglas de la máquina

El estado tiene cuatro datos: si hay conexión, el folio de la próxima venta, la **cola** (guardadas en el equipo, la más vieja primero) y el **libro** (las que el servidor ya anotó). Los folios son `Folio` del dominio (ADR 0016), no cadenas inventadas.

| Evento   | Qué pasa                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| `vender` | El mostrador cobra: la venta entra a la cola, **con o sin conexión**. Nunca va directo al libro.                      |
| `enviar` | Con conexión, sale **una** venta, la más vieja, y queda en el libro. Sin conexión, o con la cola vacía, no hace nada. |
| `cortar` | Se va la red. No se pierde nada de lo que ya estaba en la cola.                                                       |
| `volver` | Vuelve la red. No envía nada por sí sola: lo envía `enviar`, de a una.                                                |

Lo que el dibujo hace solo lo decide `siguientePaso`, que también dice qué venta protagoniza el paso: con red envía lo que espera antes de vender más, y sin red vende hasta llenar la cola (`LIMITE_EN_COLA`, 6) y se queda quieto. Ese límite es del dibujo, no una regla del producto: con más ventas acumuladas ya no se lee, y una venta real nunca se rechaza.

## Qué dice el teléfono

- **La ficha de conexión** (`Conectado` o `Sin conexión`, con su color y su punto) es una región `status`: un lector de pantalla la anuncia cuando cambia, y solo cambia al tocar el interruptor.
- **El resumen del envío** lo escribe `summarizeSync`, el código de la aplicación: «Sin conexión · 3 registros por enviar. Están guardados solo en este equipo.», «Enviando…», «Todo enviado», «Nada por enviar». Si el titular repetiría la ficha («Sin conexión»), no se escribe dos veces. El detalle solo aparece cuando hay algo por enviar: el de «Todo enviado» trae la hora de la última vez y el servidor y el navegador la escribirían distinto.
- **La última venta** muestra su folio y la nota de su comprobante en la aplicación: «Guardada en este equipo. Se envía cuando haya conexión.» mientras espera en la cola (aunque haya red: se guarda primero en el equipo) y «Venta guardada en tu cuenta.» cuando llegó al libro. Una prueba (`test/sitio/afirmaciones.spec.ts`) comprueba que las dos frases estén, tal cual, en `ReceiptPage.tsx`.
- **Ori** pone la cara que le toca (`rostroDeOri`, y solo una que el producto ya hace, ver [`mascotas.md`](mascotas.md)): dormida sin conexión; feliz cuando todo llegó **y** el libro tiene al menos una venta, porque sin ninguna venta enviada no hay nada que celebrar; tranquila el resto del tiempo, también mientras la cola sale hacia el servidor.

## Cuándo se mueve y cuándo no

- **El primer dibujo es siempre el mismo** (con red, nada por enviar, dos ventas ya en el libro). El HTML que se prerenderiza y el que monta el navegador son idénticos, y nada se mueve hasta después de montar.
- **Fuera de pantalla no hay ningún temporizador vivo.** Un `IntersectionObserver` lo pausa, y al volver sigue donde se quedó. En un navegador que no sabe decir si se ve, se mueve como si se viera: un dibujo quieto para siempre sería peor.
- **Con menos movimiento no se mueve nada solo** y no se dibuja ninguna venta viajando. El interruptor llega de una vez al resultado: cortar deja tres ventas por enviar y volver las envía todas, en orden. La preferencia se lee al montar y se sigue si cambia con la página abierta. Además, el CSS oculta `.viaje` para ese caso aunque algo lo pusiera en la página.
- **Un viaje en curso se cancela** si el estado cambia (el interruptor) o el dibujo deja de moverse: nunca queda una bolita flotando ni una venta contada dos veces. Los temporizadores se limpian al salir de la página.
- **Teclado:** el interruptor es un `<button role="switch">`; Espacio y Enter lo cambian. Mide 44 px de alto como todo lo táctil (ADR 0008).

## Decisiones y lo que cuestan

- **La animación es CSS y los temporizadores son del hook, sin Framer Motion.** Cada viaje es una línea recta, así que se anima con `transform` y no hace falta la biblioteca (ADR 0033 la permite en la landing; el peso de la página lo mide C4-L7). `prefers-reduced-motion` se respeta en el CSS y en el hook.
- **Un solo reloj** (`ritmo.ts`): el CSS recibe `--recorrido`, `--duracion` y `--retraso` desde el componente. Cambiar un ritmo es cambiar un número.
- **El teléfono va sobre el diagrama, no dentro:** el texto del teléfono es HTML y mantiene su tamaño en cualquier pantalla; el texto del SVG se achica con él (a 375 px las etiquetas del dibujo quedan en 9 o 10 px, por eso lo importante, «N registros por enviar» y los folios, también está en el teléfono).
- **El folio de ejemplo** (`diagrama.folio`) es el de la primera venta que viaja; el libro abre con las dos anteriores. Antes de L4 era un folio fijo en el dibujo.
- **El dibujo sale una vez** desde LND-2 (27 de octubre de 2026), en la pestaña Vender de la banda «Pruébalo» ([`banda-de-la-demo.md`](banda-de-la-demo.md)). Entre C4-L6 y LND-2 salía dos veces, también en la entrada; la entrada ahora enseña dos capturas de la aplicación. `DiagramaVenta` sigue recibiendo un `id` (por omisión `diagrama`) con el que empiezan los de su título, su descripción y sus puntas de flecha, para poder repetirlo sin repetir ningún `id`. Se pausa fuera de pantalla por su cuenta.

## Cómo verlo y qué lo vigila

```bash
npm run dev:sitio       # la landing con recarga en caliente (http://localhost:5173 si el puerto está libre)
npm run build:sitio     # compila, prerenderiza y comprueba que el HTML sale igual
npm run preview:sitio   # sirve lo compilado
```

Antes de dar por buena una pantalla que se anima, ábrela en un navegador real en tema claro y oscuro, a 375 px, con y sin movimiento reducido: jsdom no ve el CSS.

| Prueba                                        | Qué vigila                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `diagrama/maquina.spec.ts`                    | La cola sale una por una y la más vieja primero, nada sale sin red, el libro no cambia sin conexión, la cara de Ori y los textos.         |
| `secciones/DiagramaVenta.spec.tsx`            | El interruptor corta de verdad (ficha, enlace, Ori), la cola sube y baja a su ritmo, se pausa fuera de pantalla, menos movimiento.        |
| `test/sitio/estilos.spec.ts`                  | La animación usa solo `transform` y `opacity`, `.viaje` no se dibuja con menos movimiento y el marco del teléfono se ve en los dos temas. |
| `test/sitio/texto-en-un-solo-archivo.spec.ts` | Ninguna palabra del dibujo está escrita fuera de `contenido.ts`.                                                                          |
| `test/sitio/afirmaciones.spec.ts`             | Lo que dice el dibujo no afirma lo que el producto no hace.                                                                               |
