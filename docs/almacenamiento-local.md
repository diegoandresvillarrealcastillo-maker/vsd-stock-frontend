# Almacenamiento local, sesión del mostrador y folios

Lo que este equipo guarda de cada persona, cómo se protege y cuándo se olvida (C3-08, [ADR 0018](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0018-cifrado-local-y-olvido-del-dispositivo.md),
[ADR 0022](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0022-identidad-y-sesion.md)
y [ADR 0016](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0016-folios-por-dispositivo-y-hora-corregida.md)).

## Qué se guarda y dónde

**Una base de IndexedDB por persona**, llamada `vsd-stock-<identificador de la persona>` (nunca su nombre ni su correo: los
nombres de las bases se pueden listar). Dentro:

| Almacén      | Qué guarda                                                                                                      | Cifrado                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `meta`       | La **clave** de la persona y el **contador de la serie de folios** (un número)                                  | Clave no extraíble; el número, en claro |
| `records`    | El **perfil** (quién es, su negocio, su rol, cuándo lo confirmó el servidor) y el **dispositivo**               | AES-GCM                                 |
| `operations` | La cola de operaciones sin enviar (la llena el motor, C3-09). Lo que se busca va en claro, el contenido cifrado | AES-GCM                                 |

- **El contenido de cada registro va cifrado con AES-GCM de 256 bits**, un vector de inicialización aleatorio de 96 bits por
  registro y **el nombre del registro como dato autenticado**: alterar un bit, o copiar un registro al lugar de otro, hace que
  el descifrado falle y el registro se lea como «no hay nada». Nunca devuelve datos dañados.
- **La clave es una `CryptoKey` con `extractable: false`**, generada en el equipo la primera vez que la persona entra y guardada
  en su propia base. No hay PIN ni contraseña que la envuelva (el mostrador no se bloquea por un PIN olvidado).
- **Los índices no se cifran y por eso no llevan datos personales:** la clave de una operación, su estado y su hora.
- **Nada secreto se guarda:** ni contraseñas ni tokens (la sesión vive solo en memoria, ADR 0022).
- Lo que **no** cubre (ADR 0018): un script malicioso dentro de la página, quien tenga la sesión abierta, quien copie el perfil
  completo del navegador, ni el malware. Nadie debe venderlo como más de lo que es.

## La sesión del mostrador

- **Entrar con conexión** (`LocalWorkspaceProvider`): cuando el servidor confirma quién es la persona y que tiene negocio, se abre
  su base (se crea la primera vez), se anota que **el servidor la confirmó ahora** y se **registra el dispositivo** (`POST
/v1/devices`) si todavía no lo está. Recordar a quién fue la última persona se hace con un identificador en `localStorage`
  (`vsd-stock-person`): solo un UUID.
- **Sin conexión, el mostrador se reanuda con ese registro hasta 72 horas después** de la última confirmación del servidor
  (`COUNTER_RESUME_WINDOW_MS`): la pantalla de entrar ofrece «Continuar sin conexión» y lleva a `/mostrador`, pero solo mientras la conexión no esté confirmada (sin red o
  comprobando): cuando el servidor responde, el camino es la contraseña ([ADR 0038](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0038-continuar-sin-conexion-solo-se-ofrece-sin-conexion-confirmada.md)). Pasado el plazo se
  **bloquea**, pero la base se **conserva**: se desbloquea entrando con la contraseña y conexión.
  - Un reloj atrasado **no estira el plazo**: si la hora del equipo está más de 5 minutos por detrás de la última confirmación,
    el mostrador se bloquea (`clock-behind`).
  - Reanudar **no renueva** la confirmación: solo el servidor puede hacerlo.
- **Recargar la página con conexión pide la contraseña** (el token no se guarda), con el correo de la persona ya escrito.
- **«Cambiar de persona» no es «Cerrar sesión»:**
  - _Cambiar de persona_ cierra la sesión y **conserva todo lo guardado**: las ventas sin enviar de quien se va siguen ahí y las
    enviará cuando vuelva a entrar.
  - _Cerrar sesión_ **olvida**: borra la base de la persona en un paso (`deleteDatabase`), que se lleva la clave. Si hay
    operaciones sin enviar, antes dice **cuántas son** y pide confirmación, porque confirmar las pierde.
  - Cuando la sesión **caduca** o el servidor la rechaza, la base se suelta pero **no** se borra.
- **Si el navegador no puede guardar datos cifrados** (sin IndexedDB, sin HTTPS, ventana privada) la aplicación lo dice y sigue
  funcionando con conexión; solo el mostrador sin conexión no está disponible. **Si la clave se pierde con operaciones sin
  enviar** (el navegador la borró y dejó los datos) se avisa cuántas son y la persona decide empezar de nuevo.

## Los folios

`AA-000142`: el código del dispositivo (lo reparte el servidor al registrarlo, nunca se repite) y una serie que **solo crece**
(ADR 0016).

- **La serie se reserva en una transacción propia de IndexedDB** que lee, suma y escribe sin esperar nada más, antes de cifrar lo
  que se va a hacer con el número. IndexedDB turna las transacciones de escritura sobre el mismo almacén, aunque vengan de
  pestañas distintas, así que **dos reservas nunca reciben el mismo número**. Si lo que sigue falla, queda un salto y nunca una
  repetición (el ADR 0016 admite los saltos).
- **El dispositivo se reclama antes de pedir su código:** el identificador se guarda primero y, si la respuesta se pierde, se
  repite con el mismo (el servidor lo registra una sola vez). Dos pestañas que lo intentan a la vez terminan con el mismo.
- **Olvidar un dispositivo borra su serie:** para volver a trabajar se registra de nuevo y recibe un código nuevo.
- El identificador se arma con `getRandomValues` y no con `crypto.randomUUID()`, que solo existe en contextos seguros: abrir la
  aplicación por la red local para probarla en un teléfono no lo es.

## Lo que se comprobó en un navegador real

Las pruebas automáticas usan `fake-indexeddb` y el WebCrypto de Node. Además, el 2026-10-19 se repitió lo que el ADR 0018 pide
**sobre el motor real, en un Chromium 152** (el del panel de Claude en Windows 11), con el código de la aplicación en modo
desarrollo y IndexedDB de verdad:

| Comprobación                                                                                 | Resultado                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 60 reservas de serie a la vez desde 3 conexiones a la misma base (como 3 pestañas)           | 60 números distintos y seguidos, en 24 ms                                                         |
| Dos conexiones reclaman un dispositivo a la vez                                              | Las dos terminan con el mismo                                                                     |
| Lo que hay en disco                                                                          | Ningún texto de la persona; cada registro solo tiene nombre, vector y datos cifrados              |
| La clave                                                                                     | AES-GCM de 256 bits, `extractable: false`; `exportKey` falla con `InvalidAccessError`             |
| Alterar un bit del texto cifrado                                                             | El perfil se lee como «no hay nada»; al restaurarlo vuelve a abrir                                |
| Poner el perfil cifrado en el lugar del dispositivo                                          | El dispositivo se lee como «no hay nada»                                                          |
| Abrir con la base de otra persona el texto cifrado de la primera                             | No abre                                                                                           |
| Olvidar con otras conexiones abiertas                                                        | Se sueltan y la base desaparece (1 ms); al volver, la serie empieza en 1 y no hay dispositivo     |
| Costo de cifrar y guardar / leer y descifrar un perfil                                       | 0,40 ms y 0,25 ms por registro                                                                    |
| Una base escrita por un programa **independiente** (otra implementación del formato del ADR) | La aplicación la lee: ofrece continuar sin conexión, muestra el dispositivo y cuenta lo pendiente |
| Mostrador a 375 px, tema claro y oscuro                                                      | Sin desbordes a la vista, en los dos temas                                                        |

**Lo que sigue sin comprobarse** (y es del Ciclo 3, ticket C3-16): Firefox y Safari (en especial el de iPhone y iPad), un
**teléfono real** y que `navigator.storage.persist()` se conceda (en esta prueba `persisted()` dio `false`, el navegador del panel
no lo concede).
