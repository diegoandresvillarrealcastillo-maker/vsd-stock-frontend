# La calculadora de IVA y el arqueo de ejemplo de la landing

Dos demos de la landing (`sitio/`, ADR 0033) que dejan probar, sin cuenta ni instalación, dos cosas que VSD Stock hace al mostrador: **separar la base y el IVA** de un precio y **decir si la caja cuadra**. Las dos usan el mismo cálculo y las mismas palabras del producto, no una copia: lo que la página dice, lo dice el código de la aplicación.

Son dibujos que calculan. No llaman a ninguna API, no guardan lo que se escribe y los números de partida son de ejemplo.

## Cómo están hechas

| Archivo                                                            | Qué hace                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `sitio/pagina/demos/iva.ts`                                        | La cuenta de la calculadora, sin React: lee el precio y separa base e IVA con las funciones del dominio. Se prueba sola.                  |
| `sitio/pagina/demos/arqueo.ts`                                     | La cuenta del arqueo, sin React: lee el efectivo contado y devuelve lo que se le dice a quien cuenta. Se prueba sola.                     |
| `sitio/pagina/secciones/CalculadoraIva.tsx`                        | El panel de la calculadora (pestaña IVA de la banda de la demo): el campo, la tarifa, los cinco ejemplos y el resultado.                  |
| `sitio/pagina/secciones/ArqueoDeEjemplo.tsx`                       | El panel del arqueo (pestaña Caja de la banda de la demo): lo esperado, el campo del efectivo contado y la nota de si cuadra.             |
| `sitio/pagina/contenido.ts` (`calculadora`, `comoFunciona.arqueo`) | Todas las palabras, y los números de partida, como en el resto de la página.                                                              |
| `src/domain/model/shift.ts` (`describeCount`)                      | «Faltan $ 2.000» y «Esperabas $ 170.000 y contaste $ 168.000.»: lo escribe el dominio y lo usan la pantalla de cerrar turno y la landing. |

## Lo que usan del producto

La landing solo puede importar de la aplicación el dominio (ADR 0033), y de ahí sale todo:

- **Leer lo que se escribe:** `parsePesos` (el precio) y `parseCash` (el efectivo). Solo dígitos, sin puntos, comas ni signos: un punto es ambiguo (¿miles o centavos?) y adivinar mal descuadra. Los mensajes de error son los de la aplicación.
- **Separar el IVA:** `splitTaxIncluded` con las tarifas `TAX_RATES_BP` (0 %, 5 % y 19 %) y sus rótulos `taxLabel`. La base se redondea al peso y el IVA es lo que sobra: base más IVA es siempre el total (ADR 0014).
- **Decir si la caja cuadra:** `describeCount`, que arma el titular (`describeDifference`) y la línea de lo esperado contra lo contado. Antes esa línea estaba escrita a mano en `CloseShiftPage.tsx`; se sacó al dominio para que la pantalla y la landing no puedan decir cosas distintas. La pantalla le sigue añadiendo «Si cierras así, queda anotado.», que solo tiene sentido al cerrar de verdad; la demo no lo dice porque aquí no se anota nada.
- **Escribir los pesos:** `formatPesos` (`$ 11.900`).

## La calculadora

- Abre con 11.900 al 19 %: base 10.000 e IVA 1.900, el mismo ejemplo de la tarjeta «IVA que siempre suma».
- Los cinco ejemplos que una revisión contable externa recalculó (ADR 0032) están debajo como botones: un toque pone el precio y la tarifa. El que coincide con lo escrito queda marcado.
- **Base más IVA se ve sumar:** debajo del resultado, la suma está escrita (`$ 10.000 + $ 1.900 = $ 11.900`) y se calcula con las dos partes que se muestran, no repitiendo el precio. Si la regla se rompiera, la suma saldría distinta del precio a la vista de cualquiera.
- Con un texto que no se lee (un punto, una letra, vacío) no se muestra ningún resultado, y bajo el campo sale el mensaje de la aplicación. El campo se marca como inválido (`aria-invalid`) y el mensaje se lee con él (`aria-describedby`).
- El resultado es una región `aria-live="polite"`: un lector de pantalla lo anuncia cuando se deja de escribir.
- La nota de la tarjeta de IVA sigue donde estaba: el cálculo está recalculado por una revisión externa y falta validarlo con quien lleva las declaraciones de la tienda.

## El arqueo

- Abre con 170.000 esperados y 168.000 contados: **«Faltan $ 2.000 · Esperabas $ 170.000 y contaste $ 168.000.»**. Es la diferencia de la tarjeta «Una caja que cuadra», y una prueba vigila que sigan siendo la misma.
- Cambia mientras se escribe: «La caja cuadra» (tono tranquilo), «Sobran $ 1.500» o «Faltan $ 50». Cero vale: una caja vacía es un monto, no un olvido.
- **No es una región viva**, como en la aplicación: cambia con cada tecla y no debe leerse en cada una. La nota se lee con el campo (`aria-describedby`).
- El tono lleva su icono y su titular: el color nunca es lo único que dice si cuadra.

## Lo que no hacen

- **Ninguna cuenta regresiva sobre dinero:** las cifras salen de golpe y no hay temporizadores ni animación en ellas. Una prueba lo vigila en las dos demos.
- **No guardan ni envían nada.** Lo escrito se pierde al recargar.
- **No sacan a Ojo de Gato** al cuadrar la caja. En la aplicación sí aparece al cerrar el turno (C4-M3, ver [`mascotas.md`](mascotas.md)); que la demo de la landing también la saque no está decidido, y mientras tanto no la saca.

## Decisiones y lo que cuestan

- **Cada demo tiene su panel, no vive dentro de una tarjeta.** La primera versión ponía la calculadora dentro de la tarjeta de IVA y la hacía de casi 1.000 px, el triple de sus vecinas, que se quedaban con un hueco enorme. Con un panel a lo ancho, como el del arqueo, las tarjetas vuelven a medir lo mismo. El costo: el IVA se ve dos veces, un ejemplo en la tarjeta de funciones y la calculadora en la banda de la demo.
- **Los `id` de cada demo llegan por propiedad, no con `useId`.** `useId` da ids distintos al prerenderizar y al montar de cero, y la prueba «es el mismo HTML que monta el navegador» (que protege la hidratación) lo detectó. Cada panel recibe el prefijo de quien lo pone en la página, y una prueba exige que ningún `id` se repita.
- **`describeCount` está en el dominio, y por eso este cambio toca la aplicación.** Es la forma de no tener la frase «Esperabas… y contaste…» en dos sitios. La pantalla de cerrar turno dice exactamente lo mismo que antes (sus pruebas no cambiaron).
- **Viven en las pestañas «Vender, IVA y Caja» de la banda de la demo (C4-L6)**, no debajo de las tarjetas ni de los pasos, donde estaban al principio: tenerlas dos veces era repetir una calculadora a dos pantallas de distancia. Por eso son componentes sueltos que reciben su `id`, y bajan solo cuando alguien abre su pestaña. Ver [`banda-de-la-demo.md`](banda-de-la-demo.md).

## Cómo verlas y qué las vigila

```bash
npm run dev:sitio       # la landing con recarga en caliente
npm run build:sitio     # compila, prerenderiza y comprueba que el HTML sale igual
npm run preview:sitio   # sirve lo compilado
```

Antes de dar por buena una pantalla con campos, ábrela en un navegador real en tema claro y oscuro, a 375 px y con el teclado: jsdom no ve el CSS ni el orden de tabulación.

| Prueba                                        | Qué vigila                                                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demos/iva.spec.ts`                           | La cuenta usa `splitTaxIncluded` (no una copia), da los cinco ejemplos de la revisión contable y base más IVA suma para cualquier precio y tarifa. |
| `demos/arqueo.spec.ts`                        | Dice exactamente lo que `describeCount` y `parseCash` dicen en la aplicación, y la diferencia de partida es la de la tarjeta de la caja.           |
| `secciones/CalculadoraIva.spec.tsx`           | El campo solo acepta números, los ejemplos ponen precio y tarifa, la suma escrita da el precio y ninguna cifra corre con un temporizador.          |
| `secciones/ArqueoDeEjemplo.spec.tsx`          | El titular, el detalle y el tono, el campo, que no sea región viva y que no se agregue el aviso de «queda anotado».                                |
| `Sitio.spec.tsx`                              | Cada demo está en su pestaña, una sola vez, y ningún `id` se repite; el HTML prerenderizado y el montado son el mismo.                             |
| `src/domain/model/shift.spec.ts`              | `describeCount` dice cuánto falta o sobra y lo esperado contra lo contado.                                                                         |
| `test/sitio/texto-en-un-solo-archivo.spec.ts` | Ninguna palabra de las demos está escrita fuera de `contenido.ts` o del dominio.                                                                   |
