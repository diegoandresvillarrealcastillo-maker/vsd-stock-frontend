# Ventas: verlas, revisarlas y anularlas

Qué se ve de las ventas ya hechas, quién lo ve, qué pasa sin conexión y cómo se revisa o se anula una (C3-13,
[ADR 0027](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0027-registro-de-ventas-y-atencion.md)).
Cómo se hace una venta está en [`punto-de-venta.md`](punto-de-venta.md); el turno del que sale el efectivo, en [`turno.md`](turno.md);
y la cola de la que salen las ventas que todavía no llegaron al servidor, en [`sincronizacion.md`](sincronizacion.md).

## Dónde está

Bajo el marco del mostrador, con su propio elemento en el menú: **Mostrador · Turno · Ventas · Equipo**.

| Ruta                               | Pantalla                | Quién la abre                       |
| ---------------------------------- | ----------------------- | ----------------------------------- |
| `/mostrador/ventas`                | La lista de ventas      | Todos los roles                     |
| `/mostrador/ventas/:saleId`        | El detalle de una venta | Todos los roles                     |
| `/mostrador/ventas/:saleId/anular` | Anular una venta        | Dueño y administrador (`sale:void`) |

La lista y el detalle se abren también **sin la cuenta cargada** (la persona que reanudó el mostrador sin conexión): lo que está en
este equipo sale de la cola. Anular pide conexión, y la ruta lo guarda con el permiso de la tabla de [ADR 0017](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0017-roles-permisos-y-modo-sin-conexion.md).

## La lista

Tres vistas, con pestañas **«Mi turno»**, **«Todas»** y **«Atención»** (`?vista=todas` y `?vista=atencion`):

- **Mi turno:** las ventas del turno de este equipo, la más nueva primero. Es la única vista del **cajero**, que no ve las pestañas.
- **Todas** y **Atención:** solo para quien puede ver todo el negocio (`sale:view-all`: dueño y administrador). «Atención» es la bandeja
  de **«Requiere atención»**.

Cada fila dice el folio, **dónde está la venta**, a qué hora y de quién, y el total:

| Etiqueta                 | Qué significa                                                            |
| ------------------------ | ------------------------------------------------------------------------ |
| Por enviar               | Está guardada en este equipo y espera a la conexión                      |
| El servidor no la aceptó | El servidor la rechazó: sigue en este equipo y alguien tiene que mirarla |
| Enviada                  | El servidor la tiene y no pide nada                                      |
| Requiere atención        | El servidor la aceptó pero encontró algo raro y nadie la ha revisado     |
| Revisada                 | Alguien de la gerencia la miró; conserva sus marcas pero ya no pide nada |
| Anulada                  | Se anuló; no se borra ni se edita                                        |

**Sin conexión** se ven las ventas que están en este equipo (por enviar y no aceptadas), sacadas de la cola. Las del servidor
necesitan conexión: sin ella la pantalla dice «No pudimos cargar las ventas» y ofrece reintentar. Las ventas que todavía están en
el equipo **no son un enlace**: aún no tienen detalle en el servidor.

El nombre de quien vendió lo ve la **gerencia**, que pide la lista de las personas del negocio. Para los demás, y si la lista no
llega, dice **«Otra persona»**: el servidor devuelve el identificador, no el nombre.

## Qué es «Requiere atención»

El servidor **recalcula** cada venta pero respeta con qué precio se vendió, y **no rechaza lo que se puede entender**: la acepta y la
marca. Una venta pide atención cuando el servidor encontró algo y nadie la ha revisado. El detalle lo cuenta en frases, bajo
**«Qué pasó»**:

- se vendió sin existencias (la venta es válida; falta ajustar la existencia);
- el folio ya era de otra venta, o es de otro equipo;
- algún precio o tarifa no es el del catálogo de hoy, o el total no era el que calculó el servidor, o los cobros no suman;
- se vendió después de cerrar el turno, o después de dar de baja el equipo;
- el reloj del equipo estaba desfasado, en el futuro, sin medir, o la venta llegó mucho después.

**Solo el dueño y el administrador se enteran:** el menú muestra el número en el nombre del enlace («Ventas 3»; con más de 50 se dice
**«Ventas 50+»**) y el cajero no ve ni el número ni la bandeja. El número se vuelve a preguntar cuando el equipo envía algo y cuando
se revisa o se anula una venta.

## El detalle

Dice el folio, dónde está la venta, la hora, quién la hizo (y el turno, si es el de este equipo) y el **comprobante**: cada línea con
su cantidad, su rebaja y lo que costó, la base sin IVA, el IVA de cada tarifa que lo tiene, el total y cómo se pagó (con la referencia
de la tarjeta o la transferencia). **El nombre y la unidad de cada producto salen de la copia local**: el servidor da solo su
identificador, y un producto que el equipo no conoce se dice «Producto», sin inventar su nombre.

Según el rol, también ofrece:

- **Anular venta** (dueño y administrador), mientras no esté anulada.
- **Ajustar la existencia de {producto}** (quien puede ajustar), si la venta se hizo sin existencias: para los productos que en la copia
  están en cero o menos; si la copia no sabe de ninguno, para los que no conoce; si todos tienen existencia otra vez, ninguno.
- **Marcar como revisada** (dueño y administrador), si la venta está en la bandeja. Lleva una **nota opcional** de hasta 200 letras. La
  revisión **no cambia la venta**: solo la saca de la bandeja y deja escrito quién, cuándo y qué nota. Dice «La venta quedó revisada.»
  junto con la venta ya actualizada.

## Anular

Anular **no borra**: la venta queda escrita como anulada, con quién, cuándo y por qué. La pantalla dice antes lo que va a pasar:

- **La existencia vuelve a las bodegas**, con cuántos productos.
- **Sale de tu caja**, solo si hubo pago en efectivo: el efectivo que se devuelve sale del **turno ABIERTO de quien anula**
  ([ADR 0026](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0026-turnos-de-caja-y-arqueo.md)),
  no del turno donde se vendió. Si hubo efectivo y no hay turno abierto, la pantalla lo dice («Primero abre un turno»), ofrece
  **«Abrir turno»** y no deja anular; sin efectivo, no hace falta turno.
- Pide un **motivo obligatorio** (una línea, hasta 200 letras), que queda escrito.

**Reintentar nunca anula dos veces.** Cada pantalla crea una sola llave de idempotencia
([ADR 0019](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0019-convenciones-de-la-api.md))
y la repite si hay que volver a mandar. Si el servidor ya había anulado la venta con esa llave, la pantalla dice **«Esa venta ya
estaba anulada: el efectivo no salió otra vez.»**. Lo que el servidor rechaza (turno cerrado, turno que todavía no conoce, venta ya
anulada) se dice con sus palabras y el botón sigue disponible.

## Lo que todavía no se mide

- **Un navegador real a 375 px y un teléfono.** Lo que jsdom no ve (el diseño, los colores de las etiquetas en claro y oscuro, el menú
  con el número) se mira en un navegador real (C3-15) y en un Android (C3-16).
- **Que el contador se refresque solo.** El número del menú se pregunta al abrir, al enviar y al revisar o anular; no se vuelve a
  preguntar mientras nadie hace nada.
- **Anular parte de una venta.** Solo se anula la venta entera; las devoluciones parciales quedan para después de la entrega.
