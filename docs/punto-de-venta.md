# Punto de venta: vender, cobrar y dar el comprobante sin conexión

Cómo la persona arma una venta, la cobra y recibe su comprobante en el mostrador, también sin conexión (C3-12,
[ADR 0027](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0027-registro-de-ventas-y-atencion.md)).
Se apoya en el turno ([`turno.md`](turno.md)), en la cola de envío ([`sincronizacion.md`](sincronizacion.md)) y en la base cifrada de
cada persona ([`almacenamiento-local.md`](almacenamiento-local.md)).

## Qué hace la persona

1. **Vender** (`/mostrador`, la primera pantalla del mostrador). Escribe parte del nombre o del código del producto, o lee el
   código con un lector, y lo toca para agregarlo. Cada producto es **una línea** del carrito: se toca otra vez y sube de uno en
   uno. En cada línea cambia la **cantidad** (con decimales si el producto se pesa, enteros si se cuenta), le pone una **rebaja** en
   pesos o la quita. La barra de abajo siempre muestra el total y el botón «Cobrar».
2. **Cobrar** (`/mostrador/cobrar`). Elige la forma de pago:
   - **Efectivo:** escribe lo que le entregan, o toca «Exacto» o uno de los billetes que se ofrecen (los más cercanos por encima del
     total). La pantalla dice el **vuelto** mientras escribe, y no deja confirmar si falta plata.
   - **Tarjeta o transferencia:** escribe la referencia (los últimos dígitos o el número de aprobación); puede quedar vacía.

   Una sola forma de pago por venta. «Confirmar venta» la guarda **en este equipo**: no hace falta conexión.

3. **Comprobante** (`/mostrador/comprobante`). Muestra el folio, lo vendido, lo cobrado y el vuelto, y dice dónde está la venta:
   «Guardada en este equipo. Se envía cuando haya conexión.», «Guardada y enviada al servidor.» o, si el servidor no la aceptó, «El
   servidor no la aceptó: la gerencia puede revisarla.». **No es una factura**, y lo dice. «Nueva venta» vuelve a vender.

Sin un turno abierto la pantalla no vende: dice «Abre un turno para vender» y lleva al turno.

## Con la lectora de códigos

El lector escribe el código entero y termina con Enter. Con Enter, la pantalla agrega el producto **al instante** si lo escrito es
exactamente su código (el del negocio o el de barras, con o sin el cero que vuelve un UPC en EAN) o si es el único que coincide.
Si hay varios que se parecen, no adivina: deja la lista para que la persona toque. Después de agregar, el campo queda vacío y con
el foco, listo para el siguiente.

La **cámara del teléfono no se usa para leer códigos todavía** (ver «Lo que todavía no hay»).

## Cómo se calcula

El total, la base y el IVA salen del **mismo cálculo del servidor** (ADR 0014 del backend, `sale-totals`): los precios llevan el
IVA incluido, cada línea se redondea al peso, las líneas de una misma tarifa se suman **antes** de sacar el IVA y el desglose es
una fila por tarifa. Lo que dice la pantalla es lo que el servidor va a calcular, peso por peso.

- **El precio y la tarifa se congelan al agregar** el producto: lo que se le cobra al cliente es lo que ve en la línea, aunque el
  catálogo cambie mientras tanto.
- **La rebaja** es en pesos, solo con números (un punto o una coma es ambiguo), y no puede pasar de lo que vale la línea.
- **Hasta 200 líneas** por venta, que es lo que acepta el servidor.
- **La existencia solo avisa.** Si la cantidad pasa de lo que queda, o el producto está agotado, la línea lo dice, pero **no
  impide vender**: el estante manda sobre el sistema (ADR 0027). Un producto que el servidor nunca movió vale cero una vez que la
  existencia se descargó.

## Qué se guarda y cómo

- **La venta, el folio y el turno se escriben juntos.** Cobrar guarda, en una sola transacción de IndexedDB, el turno con sus
  totales nuevos y la operación `sale` de la cola. O quedan las dos o ninguna; si algo falla, el carrito se conserva y la persona
  ve el error. Nunca queda una venta que el turno no suma, ni un total que el servidor no va a recibir.
- **Dos toques seguidos cobran una vez.** Cobrar se hace de a una: el segundo toque ve el carrito vacío que dejó el primero.
- **El folio** se reserva con el turno ya comprobado y sale de la serie del dispositivo (ADR 0016). Un salto en la serie por un
  fallo es aceptable.
- **El cuerpo es exactamente el de `POST /v1/sales`:**

| Campo                             | Qué lleva                                                                                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `operationId`, `shiftId`, `folio` | Los crea el dispositivo (la venta es idempotente por `operationId`)                                                                    |
| `total`                           | El que calculó el dispositivo; el servidor calcula el suyo, lo compara y, si difieren, guarda el suyo y marca la venta `total-differs` |
| `lines[]`                         | `productId`, `quantityMilli`, `unitPrice`, `discount`, `taxRateBp`                                                                     |
| `payments[]`                      | `method` (`cash`, `card`, `transfer`), `amount` (**sin** el vuelto), `reference`                                                       |
| `deviceTime`, `clockOffsetMs`     | Como en el turno                                                                                                                       |

- **El turno suma la venta:** en efectivo si se cobró en efectivo (lo que quedó en la caja, sin el vuelto) y, aparte, si se cobró
  con otro medio. Con eso la pantalla de cierre cuadra la caja.
- **La copia de lectura descuenta lo vendido** de la existencia que muestra y guarda, para no ofrecer lo que ya no está. La próxima
  descarga del servidor la reemplaza: es una estimación, no la existencia definitiva.
- **Las operaciones salen en el orden en que se agregaron**, no por la hora del reloj (se encontró con la prueba de punta a punta:
  una venta a la misma hora que la apertura de su turno salía antes y el servidor la rechazaba). Ver
  [`sincronizacion.md`](sincronizacion.md).

## Quién es dueño de la venta

La venta en curso (el carrito y el último comprobante) **vive en memoria** y es de **una persona**: si cambia quien trabaja en el
equipo, se descarta. No se guarda mientras se arma.

## Lo que se midió

Con la CPU a un cuarto de velocidad, en el navegador real y con 20.000 productos, escribir, tocar y desplazar responden dentro del
presupuesto de 100 ms. Las cifras están en [`rendimiento.md`](rendimiento.md#el-punto-de-venta-c3-12).

## Lo que todavía no hay

- **Leer códigos con la cámara.** El navegador del teléfono puede (`BarcodeDetector`), pero no en todos los Android ni en Safari,
  y hace falta probarlo en un teléfono real (C3-16). Hoy se escribe el código o se usa un lector que "teclea" (la mayoría, por
  Bluetooth o por cable).
- **La venta en curso no sobrevive a recargar la página:** el carrito está en memoria. Una venta ya cobrada sí: está en la base
  cifrada.
- **El comprobante de una venta que todavía no llegó al servidor** solo se ve al terminar la venta: la lista de ventas la muestra
  («Por enviar»), pero su detalle es de las que el servidor ya tiene. Verlas, revisarlas y anularlas está en [`ventas.md`](ventas.md).
- **Varias formas de pago en una venta** (mitad en efectivo y mitad con tarjeta). El servidor las acepta (hasta 10 pagos por venta);
  la pantalla todavía ofrece uno.
- **Un teléfono real.** Que cobrar sea fluido en un Android de gama baja se midió con la CPU limitada, no en un aparato (C3-16).
