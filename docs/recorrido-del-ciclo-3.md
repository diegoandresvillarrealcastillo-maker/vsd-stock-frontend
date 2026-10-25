# Recorrido del Ciclo 3: vender, cobrar y cerrar caja en un teléfono, con y sin conexión

Lo que se hace para **cerrar el Ciclo 3** (C3-16): recorrer el mostrador **en un teléfono de verdad**, contra la web y la API de **PRE** por
HTTPS, y medir lo que ninguna prueba automática puede medir. Las pruebas en navegador ([`pruebas-en-navegador.md`](pruebas-en-navegador.md))
simulan un teléfono a 375 px y le cortan la red de verdad; aquí lo que se prueba es **el aparato**: su procesador, su pantalla táctil, su
Chrome, su batería y la manera en que Android mata las aplicaciones que no se usan.

Dura unos **35 minutos**. El apéndice suma 10 más si hay un computador y un cable. Es manual y está escrito, como el del
[Ciclo 2](recorrido-del-ciclo-2.md): el CI no tiene un teléfono.

## Antes de empezar

- **Un teléfono Android, el más lento que se consiga,** con Chrome al día. Apunta el modelo, la versión de Android y la de Chrome
  (`chrome://version`). Si el negocio usa iPhones, repite además la sección [Si hay un iPhone](#si-hay-un-iphone).
- **Wi-Fi o datos, y poder apagarlos** (modo avión).
- **La web de PRE:** `https://vsd-stock-pre.pages.dev` (la que deja el despliegue de [`despliegue-de-la-web.md`](despliegue-de-la-web.md)).
  Todo lo que se cree queda en PRE: son datos de prueba.
- **Una cuenta de dueño con un negocio que tenga productos.** El recorrido del Ciclo 2 dejó uno en PRE («Tienda La Esquina»); si no
  recuerdas la contraseña, crea otra cuenta en un computador (filas 1 a 17 de [`recorrido-del-ciclo-2.md`](recorrido-del-ciclo-2.md)). La
  contraseña la escribes tú: no se pega en ningún chat.
- **Al menos cuatro productos con existencia:** uno sin IVA (0 %), uno con 5 %, uno con 19 % y uno que se venda por peso (kilogramo).
  Prepáralos en el computador, no en el teléfono.
- **Quince minutos sin abrir la web ni la API** antes de empezar: la API gratuita se duerme a los 15 minutos y tarda cerca de un minuto
  en despertar, y la fila 2 lo mide.
- **Un bloc de notas** para anotar lo que pide cada fila. Si en cualquier momento aparece «Hay una versión nueva de VSD Stock», anota
  cuándo y en qué pantalla y sigue: actualizar recarga la página.

## Lo que se recorre

Cada fila dice qué haces y **qué tiene que pasar**. Las frases entre « » son las de la pantalla. Si algo no pasa como dice, **es un
defecto**: anota el número de fila y lo que viste (una captura ayuda). **Mide** quiere decir que el número de esa fila va a la tabla de
[Qué se mide](#qué-se-mide).

### La primera visita, con conexión

| #   | Qué haces                                                                                                                          | Qué tiene que pasar                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Abrir `https://vsd-stock-pre.pages.dev` en Chrome.                                                                                 | El candado de HTTPS y la pantalla «Ingresar», sin avisos de Chrome. **Mide:** segundos hasta ver el formulario, con datos móviles y con Wi-Fi.                                                                                                  |
| 2   | Escribir el correo y la contraseña y **Ingresar**.                                                                                 | Inicio, con «Ir al mostrador» y el estado del servicio. Con la API dormida pasa por «Comprobando conexión…» antes de «En línea». **Mide:** segundos desde tocar «Ingresar» hasta «En línea»; y la contraseña (**1.ª vez**).                     |
| 3   | Leer en Inicio, bajo el estado del servicio, la frase sobre lo guardado.                                                           | Una de tres: «Lo guardado en este dispositivo está protegido.», «El navegador podría borrar lo guardado si se queda sin espacio. Envía tus ventas pronto.» o «Este navegador no puede proteger lo guardado en el dispositivo.». **Mide:** cuál. |
| 4   | Menú de Chrome (⋮) → **Instalar aplicación** (en algunos teléfonos, «Añadir a pantalla de inicio») y abrirla desde el icono nuevo. | Abre sin barra de direcciones. Si Chrome no ofrece instalarla, es un defecto: anota qué ofrece. Entra de nuevo (**Mide:** la contraseña, **2.ª vez**: la sesión no pasa de una ventana a otra).                                                 |
| 5   | Leer otra vez la frase de la fila 3, ya en la aplicación instalada.                                                                | Si antes decía que el navegador podría borrar lo guardado y ahora dice «protegido», instalar la aplicación lo consiguió. **Mide:** cuál dice ahora.                                                                                             |

### Equipo, turno y ventas, con conexión

| #   | Qué haces                                                                                                                            | Qué tiene que pasar                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6   | **Ir al mostrador** y abrir «Equipo» (`/mostrador/equipo`). El menú es Mostrador · Turno · Ventas · Equipo.                          | «Código del equipo» con dos letras (por ejemplo `AA`). Si dice «Sin registrar», tocar **Registrar**. «Catálogo en este equipo» dice cuántos productos hay y de cuándo; si todavía no hay catálogo, tocar **Actualizar**. |
| 7   | **Turno** (`/mostrador/turno`): escribir `100000` en «Efectivo inicial» y **Abrir turno**.                                           | El turno queda abierto desde la hora de ahora. Si dice «Este equipo todavía no está registrado», volver a la fila 6.                                                                                                     |
| 8   | Volver a vender (`/mostrador`). En «Buscar o leer un código» escribir parte del nombre del producto de 19 % y tocarlo **dos veces**. | Una sola línea con cantidad 2; el total es 2 × el precio; la base sin IVA más el IVA da el total.                                                                                                                        |
| 9   | Agregar los otros tres productos. En el que se pesa, cambiar la cantidad a `1,5` (con coma).                                         | El total sube; el IVA sale en una fila por tarifa (0, 5 y 19 %). El de peso acepta decimales; los otros, enteros.                                                                                                        |
| 10  | Ponerle una rebaja de `500` a una línea.                                                                                             | El total baja exactamente 500. La rebaja solo acepta números.                                                                                                                                                            |
| 11  | **Cobrar** → «Forma de pago» efectivo → **Exacto** → **Confirmar venta**.                                                            | El comprobante con el folio (`AA-000001`, el código del equipo y una serie) y «Venta guardada en tu cuenta.». Si todavía dice «Guardada en este equipo. Se envía cuando haya conexión.», anota cuántos segundos tarda.   |
| 12  | **Nueva venta**, un producto, **Cobrar**, y en «Efectivo recibido» escribir un billete mayor al total.                               | «Vuelto» muestra la diferencia mientras escribes. Con menos del total no deja confirmar. Confirmar la venta. Con el teclado abierto se alcanzan el vuelto y **Confirmar venta** (desplazando, sin cerrar el teclado).    |
| 13  | **Nueva venta**, un producto, **Cobrar**, «Forma de pago» tarjeta, «Referencia (opcional)» `4321` y **Confirmar venta**.             | El comprobante muestra la referencia y dice que no es una factura.                                                                                                                                                       |

### Sin conexión

| #   | Qué haces                                                                                                | Qué tiene que pasar                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Activar el **modo avión** (y apagar el Wi-Fi). Esperar unos 15 segundos.                                 | El estado del mostrador dice «Sin conexión». Nada se rompe ni aparece una pantalla de error de Chrome.                                                                                                                                                                     |
| 15  | Hacer **tres ventas** (una con tarjeta), con **Nueva venta** entre una y otra.                           | Cada comprobante dice «Guardada en este equipo. Se envía cuando haya conexión.». El estado cuenta los registros por enviar y dice que están guardados solo en este equipo; «Equipo» → «Por enviar» dice `3 registros`.                                                     |
| 16  | **Cerrar la aplicación de verdad** (recientes → deslizar) y abrirla desde el icono, **todavía sin red**. | Abre (la interfaz está guardada) y la entrada ofrece **Continuar sin conexión**. Al continuar, «Equipo» dice hasta cuándo se puede seguir sin conexión y «Por enviar» sigue en `3 registros`. **Mide:** si pidió la contraseña (no debería: sin red no puede comprobarla). |
| 17  | Apagar la pantalla 2 minutos y encenderla; luego pasar a otra aplicación 1 minuto y volver.              | Sigue donde estaba y las 3 ventas siguen por enviar. Si Android recargó la página (el carrito vacío), anótalo: el carrito no sobrevive a recargar, pero lo ya cobrado sí.                                                                                                  |
| 18  | **Ventas** (`/mostrador/ventas`), vista «Mi turno».                                                      | Las 3 salen «Por enviar» y no son enlace. Las que ya estaban en el servidor necesitan conexión: «No pudimos cargar las ventas» es lo esperado, no un defecto.                                                                                                              |
| 19  | Quitar el modo avión. **No tocar nada.**                                                                 | El estado pasa por «Enviando…» y termina en «Todo enviado». «Equipo» → «Por enviar» dice `Nada`. **Mide:** segundos desde que vuelve la red hasta «Todo enviado».                                                                                                          |
| 20  | **Ventas** → «Mi turno».                                                                                 | Las 6 ventas de este teléfono (filas 11, 12, 13 y 15), todas «Enviada», con folios distintos y seguidos: **ninguna repetida**. Si alguna dice «Requiere atención», abrirla: bajo «Qué pasó» dice por qué (el reloj, la existencia…) y es un hallazgo.                      |
| 21  | Recargar la página (o cerrar y abrir la aplicación), ya con red.                                         | Pide la contraseña, con el correo ya escrito (la sesión no sobrevive a recargar, ADR 0022). **Mide:** la contraseña, **n.ª vez** (suma las de las filas 2, 4 y esta).                                                                                                      |

### El cierre

| #   | Qué haces                                                                                                                                       | Qué tiene que pasar                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 22  | **Turno** → **Cerrar turno**. En «Efectivo contado» escribir lo esperado (los `100000` del inicio más lo cobrado en efectivo) **menos `2000`**. | Mientras escribes dice «Faltan $ 2.000», con lo esperado y lo contado. Todavía no se cierra nada.                                                                |
| 23  | Cerrar el turno.                                                                                                                                | Turno cerrado con esperado, contado y diferencia `− $ 2.000`. Dice «Falta confirmar con el servidor» y, a los pocos segundos, «El servidor ya tiene este turno». |
| 24  | En un computador, entrar como dueño y abrir **Ventas** (`/mostrador/ventas`), vista «Todas».                                                    | Están las 6 ventas del teléfono, ninguna duplicada.                                                                                                              |

### Sesión y almacenamiento

| #   | Qué haces                                                                                                                            | Qué tiene que pasar                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Abrir un turno nuevo, hacer una venta con red, activar el modo avión, hacer otra y tocar **Cerrar sesión**.                          | Antes de cerrar dice **cuántas** ventas hay sin enviar y pide confirmación, porque confirmar las pierde. **Cancelar.** Quitar el modo avión y esperar a «Todo enviado». |
| 26  | **Cambiar de persona** y entrar con otra cuenta (el cajero del Ciclo 2, si recuerdas su contraseña). Volver a entrar con la primera. | Lo guardado de la primera sigue ahí: «Cambiar de persona» no borra nada, a diferencia de «Cerrar sesión».                                                               |

### Toque y fluidez

| #   | Qué haces                                                                                                       | Qué tiene que pasar                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | En una venta nueva, tocar **20 veces seguidas**, lo más rápido que puedas, el mismo producto de los resultados. | Cada toque sube la cantidad al instante y ninguno se pierde. **Mide:** a ojo, si alguno tardó más de una décima de segundo (el apéndice da la cifra). |
| 28  | Con todos los productos en la venta, desplazar la pantalla de arriba abajo durante 5 segundos.                  | Se mueve sin tirones. **Mide:** a ojo, `fluido`, `tirones leves` o `entrecortado` (el apéndice da los cuadros por segundo).                           |
| 29  | En la pantalla de cobrar, girar el teléfono a horizontal y volver a vertical.                                   | Nada se sale de la pantalla ni se tapa el botón **Confirmar venta**.                                                                                  |

### Con una persona de mostrador

| #   | Qué haces                                                                                                                                                               | Qué tiene que pasar                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | Darle el teléfono a alguien que atienda un mostrador, **sin explicarle nada**, con un turno abierto y los productos; pedirle **diez ventas seguidas** y cronometrarlas. | Anota el tiempo total, en qué pantalla dudó, qué preguntó y qué intentó tocar que no era. Lo que preguntó es una pantalla que no se entiende sola. |

## Qué se mide

Todo lo de la columna «Qué se espera» sale de un ADR o de un ticket: si no se cumple, se abre un Issue antes de seguir con el Ciclo 4.

| Medida                       | Cómo                                                                                                                                                  | Qué se espera                                                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Despertar de la API          | Fila 2, con la API dormida.                                                                                                                           | Cerca de un minuto en el plan gratuito de Render; la aplicación dice «Comprobando conexión…» y no pierde ninguna venta. Si pasa de dos minutos, se dice en el ADR 0031.          |
| Toque                        | Fila 27 y `__toques()` del apéndice.                                                                                                                  | **Menos de 100 ms** hasta ver el cambio (ADR 0008). El apéndice cuenta cuántos toques pasaron de 100 ms: tiene que ser 0.                                                        |
| Fluidez                      | Fila 28 y `__medir(5)` del apéndice.                                                                                                                  | **60** cuadros por segundo (ADR 0008), o lo que dé la pantalla si es de 90 o 120 Hz; sin cuadros de más de 20 ms de forma repetida.                                              |
| Contraseña                   | Cuántas veces pidió la contraseña en todo el recorrido y en qué fila (2, 4, 21 y las que se sumen).                                                   | No hay un tope: el número decide si recargar pidiendo la contraseña (ADR 0022) aguanta en un teléfono que recarga a menudo. Sin red no se pide: se usa «Continuar sin conexión». |
| Almacenamiento               | Filas 3 y 5 y `__ficha()`.                                                                                                                            | «Protegido» al menos con la aplicación instalada. Si no, el aviso de «Envía tus ventas pronto» es la única defensa y se dice en la pantalla (ADR 0018).                          |
| Sin conexión, 72 horas       | Fila 16: «Equipo» dice hasta cuándo se puede seguir sin conexión.                                                                                     | **72 horas** desde la última confirmación del servidor (ADR 0022 y 0029). No se esperan tres días: se lee la fecha que dice la pantalla.                                         |
| Reloj del teléfono           | Comparar la hora del teléfono con una de referencia (`https://time.is`) y anotar la diferencia en segundos; `__ficha()` imprime la hora del teléfono. | El ADR 0016 supone un desvío de 20 ppm y como mucho **5 minutos**. Un teléfono atrasado más de 5 minutos bloquea el mostrador (`clock-behind`, ADR 0029).                        |
| Cola sin duplicados          | Filas 19, 20 y 24.                                                                                                                                    | Cada venta aparece una sola vez, en el teléfono y en el computador del dueño.                                                                                                    |
| Lector de códigos por cámara | `__ficha()` dice si el navegador tiene `BarcodeDetector`.                                                                                             | Solo se anota (la pantalla de venta todavía no lo usa): decide si vale un ticket para el Ciclo 4.                                                                                |

## Apéndice: medir con precisión desde un computador (opcional, 10 minutos)

Sin esto las filas 27 y 28 se miran a ojo. Con un cable y Chrome en un computador, el teléfono deja leer lo que el navegador midió.

1. En el teléfono: **Ajustes → Acerca del teléfono**, tocar siete veces «Número de compilación», y en **Opciones de desarrollador** activar
   **Depuración por USB**. Conectar el cable y aceptar «¿Permitir la depuración por USB?».
2. En Chrome del computador abrir `chrome://inspect/#devices`. Con la aplicación abierta en el teléfono aparece en la lista: **inspect**.
3. En la pestaña **Console** de la ventana que se abre, escribir `allow pasting` y Enter (Chrome pide eso antes de dejar pegar código),
   pegar el bloque de abajo y Enter. El bloque solo **lee** lo que mide el navegador: no envía nada a ningún lado.

```js
(() => {
  // Un toque dispara varios eventos (pointerdown, pointerup, click) con el mismo interactionId: se cuenta una vez, con el más lento.
  const toques = new Map();
  new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) {
      if (e.interactionId)
        toques.set(e.interactionId, Math.max(toques.get(e.interactionId) ?? 0, e.duration));
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true });

  window.__toques = () => {
    const ms = [...toques.values()];
    console.table({
      'toques o teclas que tardaron 16 ms o más': ms.length,
      'el peor (ms)': ms.length ? Math.max(...ms) : '< 16',
      'cuántos pasaron de 100 ms': ms.filter((m) => m > 100).length,
    });
  };

  window.__medir = (segundos = 5) => {
    const cuadros = [];
    let antes = performance.now();
    let vivo = true;
    const paso = (t) => {
      cuadros.push(t - antes);
      antes = t;
      if (vivo) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    setTimeout(() => {
      vivo = false;
      console.table({
        'cuadros por segundo': Math.round(cuadros.length / segundos),
        'el peor cuadro (ms)': cuadros.length
          ? Math.round(Math.max(...cuadros))
          : 'ningún cuadro: ¿la pantalla estaba apagada?',
        'cuadros de más de 20 ms': cuadros.filter((c) => c > 20).length,
      });
    }, segundos * 1000);
    return `Midiendo ${segundos} s: desplaza la lista ya.`;
  };

  window.__ficha = async () => {
    const cuota = await navigator.storage?.estimate?.();
    console.table({
      navegador: navigator.userAgent,
      'memoria (GB, aproximada)': navigator.deviceMemory ?? 'no lo dice',
      núcleos: navigator.hardwareConcurrency,
      'almacenamiento persistente': (await navigator.storage?.persisted?.()) ?? 'no lo dice',
      'cuota (MB)': cuota ? Math.round(cuota.quota / 1e6) : 'no lo dice',
      'lector de códigos por cámara (BarcodeDetector)': 'BarcodeDetector' in window,
      'service worker': navigator.serviceWorker?.controller ? 'activo' : 'no controla esta página',
      'hora del teléfono': new Date().toISOString(),
    });
  };
})();
```

4. `__ficha()` imprime la ficha del teléfono (memoria, núcleos, si el almacenamiento es persistente, la hora y si hay `BarcodeDetector`).
5. Tras la fila 27, `__toques()` cuenta los toques que tardaron 16 ms o más y cuántos pasaron de 100 ms. El navegador mide de 8 en 8 ms.
   «`< 16`» quiere decir que ninguno tardó 16 ms.
6. En la fila 28, escribir `__medir(5)` y **desplazar la pantalla del teléfono durante esos 5 segundos**: cuenta los cuadros que pintó y
   cuántos tardaron más de 20 ms. Si no se desplaza nada, el resultado es el de una pantalla quieta y no dice nada; si la pantalla se
   apaga, dice que no pintó ningún cuadro.

## Si hay un iPhone

En iPhone todos los navegadores usan WebKit. Se repiten las filas 1 a 3 y 14 a 23, con estas diferencias:

- **No hay «Instalar aplicación»:** Compartir → **Añadir a pantalla de inicio**. Anota si la aplicación abre así y si pide la contraseña.
- **Almacenamiento:** Safari puede borrar lo guardado de una aplicación web que no se usa en varios días (ADR 0018). Deja **una venta sin
  enviar** (modo avión), no abras la aplicación durante **tres días** y ábrela otra vez: ¿sigue la venta? Es la prueba más importante de
  esta sección.
- **La cámara:** `BarcodeDetector` no existe en Safari. Anótalo; no hay lector por cámara en iPhone.
- **El apéndice no sirve** sin un Mac: las filas 27 y 28 se miran a ojo.

## Lo que este recorrido no cubre

- **El IVA y la DIAN.** Un **contador** tiene que revisar el IVA incluido, las tarifas de 0, 5 y 19 %, el redondeo y el texto del
  comprobante (que dice que no es una factura). Este recorrido solo comprueba que el total de la pantalla sea el que calcula el servidor.
- **Una persona de mostrador de verdad,** salvo la fila 30 (una sola persona, diez ventas).
- **Segundo plano.** Si se cierra la aplicación con ventas por enviar, se envían la próxima vez que se abra; no hay envío con la
  aplicación cerrada (Background Sync no está en este ciclo).
- **Las 72 horas de verdad.** Se lee la fecha que dice «Equipo»; no se espera.
- **Muchos dispositivos a la vez.** Seis dispositivos virtuales venden sin red en el CI (backend) y tres en el navegador; en teléfonos
  reales hace falta más de un teléfono y no se pide.
- **La cámara como lector de códigos.** Se recortó del ciclo; aquí solo se mide si el teléfono podría.
- **Firefox y Safari de escritorio.** Los cubre el CI, que informa y no bloquea ([`pruebas-en-navegador.md`](pruebas-en-navegador.md)).

## Cómo se repite

1. Prepara el teléfono y los productos (arriba) y espera 15 minutos sin abrir la web.
2. Recorre las tablas en orden. Si algo no dice lo de la columna de la derecha, **eso es un defecto**: abre un Issue con el número de
   fila. Anota en el bloc las medidas de cada fila que dice **Mide**.
3. Llena la tabla de [Qué se mide](#qué-se-mide) y agrega una fila al historial de abajo: la fecha, el teléfono (modelo, Android y
   Chrome), quién lo hizo y lo que no coincidió. Las cifras de toque y fluidez también van a [`rendimiento.md`](rendimiento.md).

## Historial de corridas

| Fecha | Teléfono | Quién | Resultado                                    |
| ----- | -------- | ----- | -------------------------------------------- |
| —     | —        | —     | Pendiente: todavía no se hizo en un teléfono |
