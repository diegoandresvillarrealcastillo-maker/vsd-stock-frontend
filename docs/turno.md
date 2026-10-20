# Turno de caja: abrir, cerrar y ver el arqueo sin conexión

Cómo la persona abre y cierra su turno de caja, también sin conexión, y qué le dice la pantalla mientras el servidor no lo sabe
todavía (C3-11, [ADR 0026](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0026-turnos-de-caja-y-arqueo.md)).
La cola de envío es la de [`sincronizacion.md`](sincronizacion.md) y todo se guarda en la base cifrada de cada persona
([`almacenamiento-local.md`](almacenamiento-local.md)).

## Qué hace la persona

1. **Abrir.** En **Mostrador → Turno** escribe el efectivo que hay en la caja (solo números; **0** vale: una caja vacía es un
   monto) y toca «Abrir turno». Desde ese momento todo lo que venda queda en ese turno.
2. **Ver cómo va.** La pantalla dice desde qué hora está abierto y lleva las cuentas del dispositivo: efectivo inicial, ventas en
   efectivo, ventas con otro medio y **el efectivo que debe haber en la caja** (inicial + lo cobrado en efectivo).
3. **Cerrar.** En «Cerrar turno» cuenta el efectivo y lo escribe. **Mientras escribe**, la pantalla dice si la caja cuadra, cuánto
   falta o cuánto sobra («Faltan $ 2.000 · Esperabas $ 170.000 y contaste $ 168.000. Si cierras así, queda anotado.»). Cerrar con
   diferencia se permite: queda anotado y la gerencia lo revisa.
4. **Turno cerrado.** Muestra esperado, contado y diferencia (`− $ 2.000`, `+ $ 1.500` o `$ 0`), y desde ahí se puede abrir otro.

Todo esto funciona **sin conexión**: sale de lo guardado en el equipo, no del servidor.

## Dónde vive

El turno cuelga de **`/mostrador`**, no de la administración: `/mostrador/turno` y `/mostrador/turno/cerrar`. Es a propósito
(ADR 0017): el marco de la administración necesita la cuenta cargada, que sin conexión no está; el **marco del mostrador**
(`CounterShell`) solo necesita el espacio de trabajo local abierto. Trae su propia cabecera, un menú (Mostrador · Turno · Equipo) y el
estado del envío en todas sus pantallas.

## Qué se guarda y cómo

- **Un solo turno por persona en el equipo:** el abierto o, si no hay, el último que se cerró (hasta que se abre otro). El registro
  `shift` va cifrado como todo lo demás. El turno **no guarda la lista de ventas**: guarda sus totales (ver «Las ventas»).
- **El turno y su operación se escriben juntos.** Abrir y cerrar guardan el turno y la operación de la cola **en una sola
  transacción** de IndexedDB: o quedan las dos o ninguna. Nunca queda un turno que el servidor no va a recibir ni una operación de
  un turno que la persona no ve. Si algo falla a la mitad, la transacción se deshace y la persona ve el error.
- **El cuerpo de cada operación es exactamente el de la ruta individual** (ADR 0028):

| Operación     | Cuerpo                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `shift-open`  | `operationId`, `shiftId`, `deviceId`, `openingAmount`, `deviceTime`, `clockOffsetMs`                       |
| `shift-close` | `operationId`, `countedAmount`, `deviceTime`, `clockOffsetMs`; el turno va **aparte** (`shiftId` del lote) |

`shiftId` lo crea el dispositivo al abrir, igual que `operationId`. `deviceTime` es la hora del dispositivo y `clockOffsetMs`,
cuánto adelanta el servidor al reloj en la última medición confiable (ADR 0016), o `null` si nunca la hubo.

## Qué dice la pantalla del servidor

Cada operación del turno puede estar **esperando**, **aceptada** (ya salió de la cola) o **pidiendo atención** (el servidor la
rechazó). La pantalla lo dice solo cuando hay algo que decir:

| Turno   | La operación…         | Se dice                                                                                    |
| ------- | --------------------- | ------------------------------------------------------------------------------------------ |
| Abierto | de apertura rechazada | «El servidor no aceptó la apertura de este turno» (lo que se venda sigue guardándose aquí) |
| Cerrado | de cierre esperando   | «Falta confirmar con el servidor» (el arqueo es el del dispositivo, no el definitivo)      |
| Cerrado | de cierre aceptada    | «El servidor ya tiene este turno»                                                          |
| Cerrado | de cierre rechazada   | «El servidor no aceptó el cierre de este turno»                                            |

Esto se calcula mirando **si la operación sigue en la cola**, no con una marca que alguien pueda olvidar actualizar. Se vuelve a
calcular cuando la cola cambia (cuántas esperan, cuántas piden atención o cuándo fue el último envío).

## Reglas

- **Un turno abierto por equipo.** No se abre otro hasta cerrar el que hay. Si se toca dos veces «Abrir turno» a la vez, la
  segunda ve lo que dejó la primera y se rechaza: solo queda una operación en la cola. (Dos pestañas distintas a la vez no se
  coordinan en el equipo; el servidor rechaza la segunda apertura y la deja pidiendo atención.)
- **El servidor tiene que conocer el equipo.** Abrir un turno nombra al dispositivo; si todavía no se registró (hace falta
  conexión una vez), la pantalla no pide el efectivo y dice «Este equipo todavía no está registrado», con «Registrar» si hay
  conexión.
- **Si no se puede leer lo guardado, no se dice «no hay turno»:** se podría abrir otro con uno abierto. Se dice «No pudimos leer el
  turno de este equipo» y se ofrece reintentar.
- **Al cerrar, la pantalla no parpadea:** el turno pasa a «cerrado» antes de que la acción termine y, mientras se guarda, se sigue
  mostrando el formulario.
- **El efectivo se escribe solo con números** (un punto o una coma es ambiguo, ADR 0014) y de 0 al máximo del sistema.

## Las ventas

El arqueo del dispositivo suma lo vendido en efectivo y lo vendido con otro medio. Cada venta cobrada actualiza los totales del
turno **en la misma transacción** en que se guarda la venta y su operación (lo cobrado en efectivo cuenta sin el vuelto), y el
turno vuelve a leerlos con `refresh()`. Cómo se vende está en [`punto-de-venta.md`](punto-de-venta.md).

El arqueo definitivo lo calcula el servidor cuando recibe todas las ventas (ADR 0026); también cuenta los movimientos de efectivo
que la gerencia hace con conexión (entradas y salidas de caja) y deja **aparte** las ventas que llegan después del cierre. El del
dispositivo no los conoce: por eso dice «Falta confirmar con el servidor».

## Lo que todavía no se mide

- **Un teléfono real.** Que el turno se guarde y se envíe en un Android con poca batería, con la pestaña en segundo plano o con la
  red cortándose a mitad no se probó en un teléfono (C3-16).
- **Dos pestañas a la vez.** Abrir el turno en dos pestañas del mismo equipo a la vez no se coordina del lado del dispositivo.
