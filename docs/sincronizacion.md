# Motor de sincronización: la cola, el envío y lo que la pantalla dice

Cómo el dispositivo envía lo que hizo sin conexión y qué le dice a la persona mientras tanto (C3-09,
[ADR 0009](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0009-motor-offline-y-libro-de-movimientos.md)
y [ADR 0028](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0028-lote-de-sincronizacion-y-copia-de-lectura.md)).
La cola vive en la base cifrada de cada persona (ver [`almacenamiento-local.md`](almacenamiento-local.md)); el servidor recibe los
lotes en `POST /v1/sync`.

## Qué entra en la cola

Solo lo que se puede hacer sin conexión (ADR 0017): **abrir un turno** (`shift-open`), **cerrarlo** (`shift-close`) y **vender**
(`sale`). Todo lo demás —anular, mover efectivo, compras, ajustes— es de la gerencia, con conexión, y se pide por su propia ruta.

Cada operación se guarda con el **cuerpo exacto de su ruta individual**, su `operationId` (el mismo que usa el servidor para no
aplicarla dos veces, ADR 0019), la hora en que la persona la hizo y un contador de intentos. Cerrar un turno guarda además el
turno que se cierra (`shiftId`). `enqueue` es lo único que la escribe, y **no vuelve hasta que quedó en la base**: lo que la
pantalla dice «guardado» está guardado.

## Cómo se envía

1. **Cuándo.** Cuando hay conexión **confirmada por el servidor** (`GET /health`, no lo que el navegador cree de la red), cuando
   se agrega una operación, cuando entra una persona y cuando vence una espera. La persona también puede pedirlo con
   «Reintentar ahora».
2. **De a un lote.** Las operaciones **en el orden en que se agregaron**, hasta **20 operaciones o 64 KB** de cuerpos, lo que llegue antes
   (`BATCH_SIZE`, `BATCH_BYTES`). El servidor acepta hasta 50; el dispositivo manda menos porque un teléfono con mala red pierde
   menos si un envío se cae. Una operación sola siempre sale, pese lo que pese. **El orden es el de entrada a la cola, no el de la hora
   del reloj** (cada operación recibe un número al agregarse, dentro de la misma transacción que la escribe): una operación puede
   depender de la de antes —la venta, de la apertura de su turno— y el reloj de un teléfono se corrige o repite el milisegundo. Las que
   se guardaron antes de que existiera el número van primero, por su hora.
3. **Una pestaña a la vez.** Con un candado del navegador (Web Locks, nombre `vsd-stock-sync`) que **no espera**: la pestaña que
   llega cuando otra ya está enviando no envía, solo mira la cola. En un navegador sin Web Locks el candado funciona dentro de la
   página (una vez a la vez), pero no puede ver a las otras pestañas; el servidor lo resuelve con la idempotencia.
4. **Cada resultado se clasifica como cualquier respuesta** (ADR 0009):

| El servidor dice                                     | Qué hace el dispositivo                                                                                     |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `2xx` (incluido `200` repetido)                      | **Sale de la cola:** el servidor la tiene                                                                   |
| `408`, `425`, `429`, `5xx`, o algo que no es 4xx/5xx | **Se queda**, cuenta un intento y se reintenta con espera                                                   |
| `409` (conflicto) u otro `4xx`                       | **Se aparta y pide atención:** enviarla otra vez no cambia la respuesta; no bloquea a las demás             |
| `401`                                                | **Es de la sesión, no de la operación:** se detiene todo, se avisa «Tu sesión caducó» y la cola se conserva |

Si **toda la petición** falla: sin respuesta de red no se gasta un intento (la vigilancia de conexión avisa cuando vuelva); una
sesión rechazada detiene el envío; lo transitorio y lo que el servidor rechaza entero (muy grande, mal formada) cuenta un intento
en cada operación del lote, y esto último **dice por qué** («El servidor respondió payload-too-large»). Una respuesta que no
tiene la forma del contrato (un proxy, otra versión) se trata como un fallo que puede pasar, nunca como un éxito.

**La espera** tras un fallo seguido es de 2 segundos que se duplican hasta **5 minutos**, con azar de la mitad a la totalidad
(para que muchos dispositivos que vuelven a la vez no lleguen juntos), y **nunca menos de lo que pida `Retry-After`**.

## El reloj del dispositivo

Cada lote que el servidor contesta trae su hora (`serverTime`). El motor calcula **cuánto adelanta el servidor al reloj del
dispositivo** (la hora del servidor menos la mitad del viaje, ADR 0016) y la guarda mientras la aplicación esté abierta. No se
fía de la medición si el viaje tardó **más de 5 segundos** o si el reloj se movió mientras se esperaba. El servidor decide con
esa hora si una venta se hizo con el reloj mal (`clock-skew`, ADR 0027).

## Lo que la pantalla dice

`SyncStatus` aparece en el marco de la aplicación, en todas las páginas, como una región `status` (un lector de pantalla anuncia
cada cambio). Cuando todo está en orden ocupa **una línea**; cuando algo pide atención, una tarjeta con lo que se puede hacer ahí
mismo. El texto lo decide una función pura (`summarizeSync`, en `domain/model/sync-summary.ts`) con este orden, del que más
importa al que menos:

| Situación                              | Titular                     | Botón              |
| -------------------------------------- | --------------------------- | ------------------ |
| La sesión caducó                       | **Tu sesión caducó**        | Entrar de nuevo    |
| El servidor no aceptó N operaciones    | **N requieren atención**    | Reintentar ahora\* |
| Se está enviando                       | **Enviando…**               |                    |
| Hay algo por enviar y no hay conexión  | **Sin conexión**            |                    |
| Hay algo por enviar y aún se comprueba | **Comprobando conexión…**   |                    |
| El último envío falló                  | **No se pudo enviar**       | Reintentar ahora   |
| Hay algo por enviar y hay conexión     | **Por enviar**              |                    |
| Nada espera y el servidor aceptó algo  | **Todo enviado** (y cuándo) |                    |
| Nada espera y nunca se envió nada      | **Nada por enviar**         |                    |

\* Solo si lo que falló es el envío mismo.

Reglas que no se negocian:

- **Nunca dice «en línea» mientras solo comprueba**, ni «todo enviado» si hay algo guardado solo en el equipo. Sin conexión dice
  **cuántos registros esperan y que «están guardados solo en este equipo»**.
- **«Entrar de nuevo» es «Cambiar de persona»:** cierra la sesión y **conserva la cola**; al volver a entrar, el motor retoma el
  envío. No borra nada.
- El color acompaña, nunca es lo único: cada tono tiene su icono y su texto.

## La copia de lectura: el catálogo y la existencia en este equipo

Para vender sin conexión, el dispositivo guarda el catálogo y la existencia de su negocio (C3-10,
[ADR 0028](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0028-lote-de-sincronizacion-y-copia-de-lectura.md)).
Se baja de `GET /v1/sync/products` y `GET /v1/sync/stock`, se guarda **cifrada** en la base de quien trabaja y se tiene en memoria para
buscar sin esperar a nadie.

- **Qué se guarda y cómo:** un registro por producto (`product:<id>`) y uno por existencia (`stock:<id>`), cada uno cifrado como todo
  lo demás (ADR 0018), más un registro `copy-checkpoint` con la hora de la última descarga de cada una. Los nombres de los registros
  llevan solo el identificador: **el nombre del producto, su código y su precio van dentro del cifrado**.
- **Cuándo baja:** cuando el servidor confirma que hay conexión, cuando alguien empieza a trabajar, cuando el dispositivo acaba de
  enviar algo (la existencia se movió) y cuando la persona toca «Actualizar». No hay un reloj que lo repita solo: si nadie lo pide, no
  baja. Una sola descarga a la vez.
- **Solo lo que cambió:** la primera vez pide todo; las siguientes piden lo que cambió desde **un minuto antes** de la hora del
  servidor de la **primera página** de la descarga anterior (`COPY_MARGIN_MS`): una transacción que empezó antes de esa hora puede
  confirmarse después con una hora anterior y sin el margen se perdería. Aplicar dos veces el mismo producto no hace daño: **gana el de
  `updatedAt` mayor**. La existencia se **reemplaza** por la de ahora.
- **De a 200 por página** (el máximo del servidor). La hora de la descarga **solo se mueve cuando termina completa**: si falla a la
  mitad, lo que llegó se guarda igual y la próxima vez se pide desde el mismo punto.
- **Los archivados viajan** (con `active: false`): el dispositivo se entera de que ya no se venden. La búsqueda no los ofrece.
- **Un fallo no borra lo que ya había:** se dice por qué (`sin conexión`, `sesión caducada` u otro) y se sigue con esa copia. Nada de
  esto lanza: la copia de lectura nunca rompe una pantalla.
- **Nunca mezcla personas:** la copia en memoria es de quien trabaja; si cambia, se olvida y se lee la de la otra persona. Una
  descarga que llega cuando la persona ya cambió no toca nada.

**La búsqueda** (`searchProducts`): en cualquier orden de palabras, sin importar mayúsculas ni tildes, por el nombre, el código del
negocio o el código de barras (completo, con o sin el cero que vuelve un UPC en EAN). Un código exacto va primero; luego lo que
empieza como se escribió, luego una palabra que empieza así y al final lo que solo lo contiene; dentro de cada grupo, por nombre. No
ofrece archivados ni más de 20. No busca nada si no se escribió nada.

**Lo que la pantalla dice** (`CopyStatus`, «Catálogo en este equipo» en `/mostrador`): cuántos productos hay y **de cuándo** son el
catálogo y la existencia, o que todavía no hay catálogo y que sin él no se puede vender sin conexión. **Nada de esto es la existencia
de hoy en todas las cajas:** es lo que el servidor sabía a esa hora (ADR 0028, punto 12). Quien muestre una existencia debe decir «al
[hora]» y restar lo que este dispositivo vendió y todavía no envió (C3-12).

## Lo que no hace (todavía)

- **No actualiza la copia por sí sola cada cierto tiempo:** si alguien deja el mostrador abierto un día sin enviar nada ni perder la
  conexión, el catálogo no cambia hasta que se toque «Actualizar» o se envíe algo.
- **No hay pantalla para revisar lo que pidió atención** más allá del conteo; esa llega con el registro de ventas (C3-13).
- **Una operación que no se puede abrir** (un registro alterado o cambiado de lugar, con la clave en su sitio) se salta al armar el
  lote y **nunca se envía**, pero **sigue contada como pendiente**: el indicador no miente sobre que hay algo guardado, pero hoy no
  hay pantalla para verla ni para descartarla. Si es toda la base la que no se puede abrir (la clave se perdió), `StorageNotice`
  lo dice y deja empezar de nuevo.
- **El indicador no cubre una pestaña cerrada:** si se cierra la aplicación con operaciones pendientes, se envían la próxima vez
  que alguien abra la aplicación en este equipo y entre con su cuenta. Un envío en segundo plano (Background Sync) no está en este
  ciclo.
