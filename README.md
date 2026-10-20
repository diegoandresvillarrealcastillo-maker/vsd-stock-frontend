# vsd-stock-frontend

PWA de **VSD Stock**: inventario, punto de venta, caja y reportes para MiPymes. Está pensada para
seguir vendiendo aunque se caiga el internet.

> **Estado: Ciclo 0 (fundaciones).** Hoy muestra una página de inicio con la identidad de marca (azul oscuro,
> blanco y naranja), un botón de tema claro/oscuro, **el estado de la conexión con el servidor** (el primer
> consumo real de la API: `GET /health`) y la muestra del sistema de diseño. Es el esqueleto con las capas, las
> fronteras impuestas por ESLint, el CI completo y los tokens de diseño; la funcionalidad de negocio llega en
> los ciclos siguientes.

## Requisitos

- Node 24 (la versión exacta está en `.nvmrc`) y npm.

## Primeros pasos

```bash
npm ci
npm run dev
```

La aplicación queda en <http://localhost:5173>. Para que el estado de la conexión diga «En línea» hace falta
el backend en marcha: ver [Conexión con el backend](#conexión-con-el-backend).

## Scripts

| Script                      | Qué hace                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`               | Servidor de desarrollo de Vite.                                                      |
| `npm run build`             | Revisa los tipos y genera la versión de producción en `dist/`.                       |
| `npm run preview`           | Sirve `dist/` para probar la versión de producción.                                  |
| `npm run budget`            | Falla si lo que baja el navegador pesa más que el presupuesto (después de compilar). |
| `npm test`                  | Ejecuta las pruebas (Vitest, jsdom y Testing Library).                               |
| `npm run test:coverage`     | Pruebas con cobertura; falla si `domain/` o `application/` bajan del 80 %.           |
| `npm run lint`              | ESLint, incluidas las **fronteras de la arquitectura**.                              |
| `npm run format:check`      | Comprueba el formato con Prettier (`npm run format` lo corrige).                     |
| `npm run typecheck`         | Revisa los tipos de la aplicación y de las herramientas.                             |
| `npm run contract:sync`     | Copia el contrato OpenAPI y los vectores de cálculo del backend; regenera los tipos. |
| `npm run contract:check`    | Comprueba que ambas copias coinciden con las del backend (lo mismo que hace el CI).  |
| `npm run contract:generate` | Regenera los tipos a partir de la copia del contrato, sin red.                       |
| `npm run lighthouse`        | Audita `dist/` con Lighthouse (necesita Chrome y `npm run build` antes).             |

## Arquitectura

Hexagonal, con la dependencia siempre hacia adentro (ADR 0002):

```
presentation, adapters, infrastructure  →  application  →  domain
```

```
src/
├── domain/           model/  ports/{in,out}/        ← el núcleo: sin framework, sin React, sin navegador
├── application/      usecases/                      ← casos de uso y, después, el motor de sincronización
├── adapters/         in/  out/{api,network,scheduler,theme}/  ← API (HTTP), pistas de red, temporizador, tema… (después, almacén local y cámara)
├── infrastructure/   cableado y arranque (main.tsx)
└── presentation/     pages/  components/  forms/  auth/  people/  routes/  theme/  motion/  styles/   ← lo único que conoce React
```

Dos reglas que conviene recordar:

- **Solo `presentation/` conoce React** y las bibliotecas de interfaz. La lógica del cliente (el motor de
  sincronización, las reglas de la venta sin conexión) tiene que poder ejecutarse y probarse sin un navegador.
- **La interfaz no importa los adaptadores.** Recibe los casos de uso ya cableados desde `infrastructure/` y
  llama a esos casos de uso, para no saltarse las reglas que viven en ellos.

Cruzar una frontera **rompe el build**: `npm run lint` falla con un mensaje que explica qué hacer, y
`test/architecture/boundaries.spec.ts` comprueba que cada regla se sigue imponiendo.

## Conexión con el backend

La página de inicio tiene una sección **«Estado del servicio»** que dice si la aplicación puede hablar con el
servidor. Es el primer consumo real de la API y la base de lo que usará el motor de sincronización.

**La conexión se confirma con `GET /health`, no con `navigator.onLine`.** Que el navegador diga que hay red solo
prueba eso: que hay una red, no que el servidor esté en pie ni que lleguemos a él. Por eso
`ConnectionMonitorUseCase` (`application/usecases/`) usa lo que cree el navegador como una pista que decide
_cuándo preguntar_:

| El navegador dice | Qué hace la aplicación                       | Estado                                                               |
| ----------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| Que no hay red    | No pregunta. Reintenta con espera creciente. | **Sin conexión**, de inmediato                                       |
| Que hay red       | Pregunta `GET /health`                       | **Comprobando…** hasta que responde; **En línea** o **Sin conexión** |

- **«En línea» solo lo dice una respuesta válida del servidor:** HTTP 200, JSON con `status: "ok"` y una fecha. Un
  200 con otra cosa (el `index.html` que algunos servidores devuelven para cualquier ruta) cuenta como sin
  conexión.
- **Cada cuánto:** mientras responde, cada 30 s. Tras un fallo, a los 5, 10, 20 y 30 s sin pasar de ahí, y una
  respuesta reinicia el ritmo. Cuando el navegador avisa de que volvió la red, se pregunta de inmediato. La
  respuesta tardía de una petición vieja se descarta para que no pise un estado más reciente.
- **Un servidor que tarda más de 5 s se da por caído**, y nunca se acepta una respuesta de la caché (un
  `/health` guardado diría que hay conexión cuando ya no la hay).
- **«Reintentar»** solo aparece sin conexión y muestra «Comprobando conexión…» mientras pregunta. El panel dice
  además la hora que confirmó el servidor y, sin conexión, la última vez que respondió.
- **Lo que no hace todavía:** no pausa las comprobaciones con la pestaña oculta y no cambia nada más de la
  aplicación cuando no hay conexión. Lo segundo es el trabajo del Ciclo 3.

**A qué servidor le habla.** `VITE_API_URL`, que se fija al compilar (ver [`.env.example`](.env.example)). Sin
ella, `npm run dev` apunta a `http://localhost:3000` y una versión compilada usa el mismo origen que la sirve.
Una dirección mal escrita detiene el arranque con un mensaje que nombra la variable.

**Para probarlo en local:**

1. En el backend, `CORS_ORIGINS=http://localhost:5173` en su `.env` (ya viene en su `.env.example`) y
   `npm start`.
2. Aquí, `npm run dev`. Debe decir «En línea». Si apagas el backend, dice «Sin conexión» en unos segundos aunque
   la red del equipo esté bien; al volver a encenderlo, se recupera solo.
3. Si dice «Sin conexión» con el backend en pie, mira la consola del navegador: casi siempre es que falta el
   origen en `CORS_ORIGINS` (ADR 0012).

**Diseño:** el componente «Estado de conexión» y las pantallas de inicio con el panel están en
[Figma](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L). El estado nunca se dice solo con color: cada uno
tiene su icono (un punto que pulsa, un check, una nube tachada) y su texto, y el panel es una región `status`,
así que un lector de pantalla anuncia los cambios.

## Sesión, cuenta y navegación

Cómo entra una persona y qué ve según su rol (ADR 0017, 0022 y 0024). Todo esto vive en `domain/`, `application/` y
`adapters/`: la interfaz solo lo consume.

- **La sesión vive solo en memoria** (`MemorySessionStore`): ni almacenamiento local, ni cookies, ni la base del
  dispositivo. **Recargar la página la pierde a propósito**: es lo que evita dejar una credencial en el equipo de otra
  persona. El token de renovación tampoco se guarda en ningún lado.
- **El navegador habla directo con Supabase Auth** (`HttpIdentityService`, con `fetch` y sin biblioteca): entrar
  (`/token?grant_type=password`), registrar, renovar y salir. Los límites de uso de Supabase se cuentan por IP y detrás de
  un proxy todas las personas compartirían la de la API. Se configura al compilar con `VITE_AUTH_URL` y
  `VITE_AUTH_PUBLISHABLE_KEY` (ver [`.env.example`](.env.example)): van **juntas o ninguna**, y la clave es la
  **publicable**; una clave secreta (`sb_secret_…` o `service_role`) detiene el arranque, porque lo que se compila en un
  navegador lo lee cualquiera. Sin ninguna, la aplicación arranca y al intentar entrar dice que el servicio no está
  disponible (no que la clave esté mal).
- **El token se renueva solo** un minuto antes de vencer, una renovación a la vez aunque muchas pantallas lo pidan. Un
  fallo pasajero (sin red, servicio caído o con límite de uso) **no cierra la sesión**: se reintenta. Solo cierra una
  respuesta del servicio que dice que el token ya no sirve.
- **La API recibe el token de la sesión** (`HttpApiGateway`) y nada más: solo acepta rutas (`/v1/...`), nunca
  direcciones completas, para que el token no pueda salir hacia otro servidor. Lee `Retry-After` y
  `Idempotent-Replayed`, y clasifica cada fallo en las clases del [ADR 0009](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0009-motor-offline-y-libro-de-movimientos.md).
- **«Quién soy»** es `GET /v1/me`: la persona y, si ya trabaja en un negocio, su rol. Una cuenta pasa por cuatro estados
  (`useAccount`): sin sesión, cargando, lista, o **falló** (hay sesión pero no se pudo preguntar; se conserva y se puede
  reintentar o cerrar).
- **Las pantallas por rol** salen de `contract/permissions.json`, una copia **exacta** de la tabla de permisos del backend
  (`npm run contract:sync` la trae y `contract:check` la compara). El menú solo ofrece lo que el rol puede usar y quien
  escribe la dirección a mano ve «No tienes acceso». **Es cortesía, no seguridad:** el servidor aplica la misma tabla en
  cada petición.
- **Las puertas de las rutas** (`presentation/routes/`): sin sesión, todo lleva a `/ingresar`; con sesión y sin negocio, a
  `/empezar`; con negocio, al marco de la aplicación (`/`, `/catalogo`, `/inventario`, `/compras`, `/personas`). Cada
  ruta tiene su guarda, la misma tabla de permisos que usa el menú.
- **Sin conexión:** una pantalla que lista o cambia algo necesita al servidor y lo dice («Esta pantalla necesita
  conexión») en vez de mostrarse vacía. La base local del Ciclo 3 es lo que lo cambiará.

### Almacenamiento local y mostrador sin conexión

Lo que este equipo guarda de cada persona (ADR 0018, 0022 y 0016); el detalle y las comprobaciones en un navegador real están en
[`docs/almacenamiento-local.md`](docs/almacenamiento-local.md).

- **Una base de IndexedDB por persona** (`vsd-stock-<su identificador>`), con el contenido de cada registro cifrado con
  **AES-GCM** y una clave **no extraíble**. Nada secreto se guarda: la sesión sigue viviendo solo en memoria.
- **El mostrador se reanuda sin conexión hasta 72 horas** después de que el servidor confirmó a la persona: la pantalla de entrar
  ofrece «Continuar sin conexión» y lleva a `/mostrador`. Pasado el plazo se bloquea y lo guardado se conserva.
- **«Cambiar de persona»** conserva lo guardado; **«Cerrar sesión»** lo olvida en un paso, y si hay operaciones sin enviar dice
  cuántas son y pide confirmación.
- **El folio** (`AA-000142`) lo numera una serie que solo crece, reservada en una transacción propia de IndexedDB: dos pestañas
  nunca reciben el mismo número. El código del dispositivo lo reparte el servidor (`POST /v1/devices`) al registrarlo.

### Envío sin conexión: la cola y el motor de sincronización

Lo que el dispositivo hizo sin conexión (abrir un turno, cerrarlo, vender) espera en una cola cifrada y se envía a `POST /v1/sync`
(ADR 0009 y 0028); el detalle está en [`docs/sincronizacion.md`](docs/sincronizacion.md).

- **Se envía cuando el servidor confirma que hay conexión**, de a un lote (20 operaciones o 64 KB) y **una pestaña a la vez**
  (Web Locks). Cada resultado se clasifica como cualquier respuesta: lo que el servidor tiene **sale de la cola**; un conflicto o un
  rechazo permanente **se aparta y pide atención** sin frenar a las demás; lo transitorio **se reintenta con una espera** que se
  duplica de 2 segundos a 5 minutos; y un `401` **detiene todo y conserva la cola**.
- **El marco de la aplicación dice la verdad del envío** en todas las páginas: «Todo enviado», «Sin conexión» con cuántos registros
  esperan y que están guardados solo en este equipo, «Enviando…», «No se pudo enviar» con «Reintentar ahora», «N requieren
  atención» y «Tu sesión caducó» con «Entrar de nuevo». Nunca dice «en línea» mientras solo comprueba.

### Pantallas de acceso y personas

| Ruta              | Pantalla             | Quién la ve                                                                |
| ----------------- | -------------------- | -------------------------------------------------------------------------- |
| `/ingresar`       | Ingresar             | Quien no tiene sesión                                                      |
| `/registrarse`    | Crear cuenta         | Quien no tiene sesión                                                      |
| `/empezar`        | Crea tu negocio      | Quien tiene sesión y todavía no tiene negocio; queda como dueño            |
| `/invitacion`     | Unirme a un negocio  | Quien tiene sesión y todavía no tiene negocio; usa el código que le dieron |
| `/personas`       | Personas del negocio | Quien puede gestionar personas (`user:manage-cashiers`)                    |
| `/personas/nueva` | Invitar a alguien    | Igual; muestra el código **una sola vez** para copiarlo                    |
| `/personas/:id`   | Una persona          | Igual; cambia nombre, rol y si está activa, o renueva su invitación        |

- **Cómo se construyen.** Las tres piezas que todas las pantallas con formulario reutilizan están en
  `presentation/forms/` y `presentation/components/`: `useSubmit` (un envío a la vez, traduce el error de la API a
  mensaje y campos con `problemOf`, y cierra la sesión si la API dice que ya no sirve), `useLoad` (carga con estado de
  carga, de fallo con «Reintentar» y de datos) y `FormField` (etiqueta, ayuda y error unidos al campo por `aria-*`).
- **Qué dice cuando algo sale mal.** Cada error del servidor tiene un mensaje en español en `domain/model/messages.ts`
  (correo ya registrado, código vencido, último dueño…). Si se envía con un campo vacío, el foco va a ese campo. Ninguna pantalla muestra el texto crudo de la API ni un código.
- **La contraseña** viaja del formulario directo al servicio de identidad y no pasa por la API ni se guarda en ningún
  lado (ADR 0022). El código de invitación se muestra una vez, con un botón para copiarlo, y no se vuelve a pedir al
  servidor: si se pierde, se renueva.
- **Qué falta.** El ingreso con una cuenta nueva exige confirmar el correo si el proyecto de Supabase lo pide: la
  pantalla lo dice («Revisa tu correo»). Recuperar la contraseña no está en el Ciclo 2.

**Diseño:** las pantallas, en claro y oscuro, y sus estados (cargando, error, vacío, sin permiso) están en la
[página de Ciclo 2 de Figma](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L?node-id=3-181).

### Catálogo

| Ruta                   | Pantalla       | Quién la ve                                                                   |
| ---------------------- | -------------- | ----------------------------------------------------------------------------- |
| `/catalogo`            | Catálogo       | Todos los roles (`product:view`); solo quien administra abre y crea productos |
| `/catalogo/nuevo`      | Nuevo producto | Quien administra (`product:manage`: dueño y administrador)                    |
| `/catalogo/:id`        | Un producto    | Igual; cambia, archiva o reactiva el producto                                 |
| `/catalogo/categorias` | Categorías     | Igual; agrega, renombra y borra categorías                                    |

- **Buscar y filtrar.** La búsqueda (nombre, SKU o código de barras) se pide al servidor cuando la persona deja de escribir
  o pulsa Enter, y se combina con el filtro de estado (activos por omisión, archivados o todos). La lista carga de 50 en
  50 con «Cargar más» (`usePagedLoad`, `presentation/forms/`): lo que se sumó se olvida cuando cambia la pregunta, así no
  se mezclan resultados de dos búsquedas distintas.
- **Los números se escriben sin ambigüedad** (`domain/model/quantity.ts`). El precio son solo dígitos: un punto o una coma
  no se adivina (¿miles o centavos?), se pide quitarlos. Una cantidad usa la **coma** para los decimales y rechaza el
  punto: «1.500» podría ser uno y medio o mil quinientos, y adivinar mal descuadra el inventario. Lo que se cuenta de a
  uno (la unidad) no acepta fracciones. El IVA que va dentro del precio se separa con la misma regla del servidor
  (ADR 0014, `splitTaxIncluded`) y se muestra mientras se escribe.
- **Cuando el SKU o el código de barras ya es de otro producto**, el servidor solo dice `sku-taken` o `barcode-taken`. La
  pantalla busca quién lo tiene (`findProductByCode`, con la misma búsqueda del catálogo) y lo dice: «ARR-500 es de «Arroz
  Diana 500 g», que está archivado», con un enlace al producto. Si no puede saberlo, dice lo general.
- **Un producto no se borra, se archiva**: deja de venderse y conserva su historia. La unidad no se cambia si el producto
  ya tiene movimientos de existencias (`unit-locked`), y la pantalla lo dice en el campo.
- **Una diferencia con el diseño:** la lista de categorías del Figma muestra cuántos productos tiene cada una, pero la
  API no entrega ese dato (`CategoryDto` trae solo el nombre). No lo calculamos con una petición por categoría; si hace
  falta se agrega al contrato.

**Diseño:** el catálogo, el formulario del producto (también el caso del SKU repetido) y las categorías están en la
[página de Ciclo 2 de Figma](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L?node-id=3-181).

### Inventario y compras

| Ruta                      | Pantalla                 | Quién la ve                                                             |
| ------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `/inventario`             | Existencias              | Todos los roles (`stock:view`)                                          |
| `/inventario/:id`         | Historial de un producto | Igual; quien ajusta (`stock:adjust`: dueño y administrador) ve el botón |
| `/inventario/:id/ajustar` | Ajustar existencia       | Quien ajusta                                                            |
| `/compras`                | Compras                  | Quien registra compras (`purchase:create`: dueño y administrador)       |
| `/compras/nueva`          | Nueva compra             | Igual                                                                   |
| `/compras/proveedores`    | Proveedores              | Igual                                                                   |

- **La existencia nunca se edita a mano** (ADR 0013): es la suma de los movimientos. Un ajuste es un movimiento más, con un
  motivo **obligatorio** (hasta 500 letras) que queda escrito en el historial. La pantalla pide si **suma o resta** sin
  elegir por la persona, y dice cuánto quedaría («Quedarían 4 und.», también si queda negativa).
- **Las operaciones que no se pueden repetir llevan su llave** (ADR 0019): cada pantalla de ajuste o de compra genera un
  `operationId` **una sola vez**. Si el envío falla (se cayó la conexión antes de ver la respuesta), reintentar usa **la misma**
  llave y el servidor no ajusta ni suma dos veces. Si la respuesta dice que ya lo había hecho (`Idempotent-Replayed`), la
  pantalla lo dice («Ya estaba registrada…»). Si la persona cambia los datos tras un fallo incierto y el servidor dice
  `operation-id-reused`, se le manda a revisar lo que ya quedó guardado.
- **Existencias:** busca por nombre, SKU o código de barras, filtra «Por debajo del mínimo» (la alerta se dice con palabras
  además del color: «Bajo el mínimo»; una existencia negativa lleva «Negativa») y carga de 50 en 50. Un producto archivado
  sigue apareciendo con su etiqueta.
- **Historial:** lo más nuevo primero, con el signo del movimiento (`+ 24`, `− 2`), su motivo y el momento. La API no da la
  existencia de **un** producto: se averigua su SKU y se busca entre las existencias.
- **Compra:** un proveedor opcional, una nota opcional y una o más líneas (producto activo, cantidad en su unidad y costo por
  unidad en pesos enteros). El producto se busca como en el catálogo y **no se repite** en otra línea. Si la línea que se está
  escribiendo está completa al registrar, se suma sola para no perderla; si está a medias, se dice qué le falta. Lo que el
  servidor objeta de una línea (`/lines/1/productId`…) se muestra **en esa línea**.
- **Proveedores:** agregar, cambiar el nombre y el contacto y borrar (con confirmación); si ya tiene compras, dice por qué no
  se puede borrar.
- **Lo que no hace todavía:** la lista de compras no abre el detalle de cada una (la API lo da en `GET /v1/purchases/{id}`) y
  no calcula totales (el servidor no los devuelve, y una cantidad con decimales por un costo no siempre da pesos enteros).

**Diseño:** las existencias, el historial, el ajuste, las compras, la nueva compra, la línea con problema, la compra repetida y
los proveedores están en la [página de Ciclo 2 de Figma](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L?node-id=3-181).

## Contrato OpenAPI

El único acoplamiento con el backend es su contrato (ADR 0001). Aquí vive de cinco formas:

- [`contract/openapi.json`](contract/openapi.json): una copia **exacta** del contrato del backend. No se edita
  a mano.
- [`contract/calculation-vectors.json`](contract/calculation-vectors.json): una copia **exacta** de los vectores de
  cálculo del backend (ver abajo). Tampoco se edita a mano.
- [`contract/permissions.json`](contract/permissions.json): una copia **exacta** de la tabla de permisos por rol del
  backend (ADR 0017). De ella salen el menú y las guardas de las rutas.
- [`src/adapters/out/api/schema.d.ts`](src/adapters/out/api/schema.d.ts): los tipos que `openapi-typescript`
  (solo de desarrollo) genera de esa copia. Solo tienen tipos: no pesan nada en el navegador, y tampoco entra una
  biblioteca de cliente HTTP, el adaptador usa `fetch`.
- [`scripts/contract.ts`](scripts/contract.ts): `npm run contract:sync` trae el contrato y los vectores de la rama
  `desarrollo` del backend (o la de `CONTRACT_REF`) y regenera los tipos; `npm run contract:check` comprueba que
  las copias siguen coincidiendo.

**Qué comprueba el CI.** El trabajo _Calidad del codigo_ incluye una prueba de que `schema.d.ts` es exactamente
lo que se genera de la copia. El trabajo _Contrato con el backend_ compara la copia con el contrato de la rama
correspondiente del backend y, si no coinciden, **lista qué operaciones y esquemas se añadieron o quitaron**.
Cuando el backend cambia su API, este trabajo se pone en rojo: se ejecuta `npm run contract:sync`, se revisa la
diferencia y se adapta el código. El backend se fusiona antes que el frontend que depende de él.

**Los datos de la red no son de fiar aunque el contrato diga otra cosa.** El adaptador `HttpHealthApi` comprueba
la forma de lo que recibe (y su compilación depende de los tipos generados: si el contrato cambia, deja de
compilar hasta que se adapte).

### Cómo se lee un error de la API

Todo error del backend es un `application/problem+json` con un `code` estable, el estado HTTP y un `traceId`
(ADR 0019). El dominio ([`src/domain/model/problem.ts`](src/domain/model/problem.ts)) tiene tres funciones puras,
sin red ni React:

- `parseProblem` lee el cuerpo (devuelve `null` si no tiene la forma del contrato y **nunca lanza**): el cliente
  decide por `code` y por el estado, nunca por el texto.
- `classifyFailure` da la clase de un fallo del ADR 0009 a partir del estado: **red** (sin respuesta), **sesión**
  (401), **pasajero** (408, 425, 429 y 5xx), **conflicto** (409) o **permanente** (el resto de los 4xx).
- `parseRetryAfter` convierte el encabezado `Retry-After` en milisegundos de espera, con tope de una hora.

Una prueba (`test/contract/problem-shape.spec.ts`) comprueba que lo que lee el dominio sigue siendo lo que declara
el contrato. Todavía ninguna pantalla los usa: los consume el motor sin conexión (Ciclo 3).

### El dinero se calcula igual que en el servidor

El punto de venta cobra cuando no hay red, así que el cálculo del dinero, del IVA y del redondeo vive aquí también
(ADR 0014): `Money`, `splitTaxIncluded`, `summarizeSale` y compañía, en `src/domain/model/`, sin React ni
navegador. Es el **mismo cálculo que el del backend, escrito dos veces a propósito**, y lo que impide que diverjan
son los vectores: [`test/contract/calculation-vectors.spec.ts`](test/contract/calculation-vectors.spec.ts) ejecuta
cada caso de `contract/calculation-vectors.json` contra el dominio, y el trabajo _Contrato con el backend_ del CI
comprueba que la copia es idéntica a la del backend. Si el backend cambia una regla, su CI regenera los vectores y
este falla hasta que se ejecute `npm run contract:sync` y se adapte el cálculo.

## Sistema de diseño

Estilo con **Tailwind CSS 4** y movimiento con **Framer Motion** (ADR 0008). La página de inicio es la
muestra: marca, botón de tema, estado de la conexión, tokens, un skeleton animado y entradas con movimiento.

**Diseño en Figma:** [VSD Stock — Sistema de diseño](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L).
Tiene la paleta en los dos temas con sus contrastes calculados (incluidos los colores de estado), los
componentes (botón, botón de tema, fila de producto, estado de conexión) y las pantallas de inicio en claro y
oscuro, con contenido, en estado de carga, en línea y sin conexión. Las variables de Figma tienen los mismos
nombres que los tokens del CSS (`color/surface` ↔ `--color-surface`): si cambia una, cambia la otra en el
mismo PR.

**Los tokens se definen una sola vez**, en [`src/presentation/styles/index.css`](src/presentation/styles/index.css)
(`@theme static`), y se usan como utilidades de Tailwind (`bg-surface`, `text-fg-muted`, `rounded-lg`,
`px-gutter`, `min-h-touch`…):

| Familia       | Tokens                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color         | `surface`, `surface-raised`, `fg`, `fg-muted`, `primary`, `primary-hover`, `on-primary`, `accent`, `accent-hover`, `on-accent`, `accent-text`, `success`, `border`, `focus`, `skeleton`, `band`, `on-band` |
| Tipografía    | `font-sans` (fuentes del sistema: la primera pantalla no espera ninguna descarga), `font-mono` y la escala `text-xs` a `text-3xl`                                                                          |
| Espacio       | base de 4 px, `gutter` (margen lateral) y `touch` (44 px, el objetivo táctil mínimo)                                                                                                                       |
| Radio, sombra | `rounded-sm` a `rounded-xl`, `shadow-sm` a `shadow-lg`                                                                                                                                                     |
| Movimiento    | duraciones `fast`, `base`, `slow` y `pulse`; curvas `standard` y `exit`                                                                                                                                    |

- **Contraste AA comprobado por pruebas:** `test/design/tokens.spec.ts` lee el CSS y exige 4,5:1 al texto y
  3:1 a bordes y foco, en los dos temas. Un color nuevo debe declararse también en el tema oscuro.
- **Las duraciones y curvas existen también en TypeScript**
  ([`motion/tokens.ts`](src/presentation/motion/tokens.ts)) porque Framer las necesita ahí. La misma prueba
  comprueba que ambos lados digan lo mismo.

### Paleta de marca y tema claro/oscuro

La identidad sale del logo de VSD Stock de la landing de VSD Company: **azul oscuro y blanco como base, y el
naranja del logo (`#f97801`) solo como acento.**

| Token         | Tema claro               | Tema oscuro              |
| ------------- | ------------------------ | ------------------------ |
| `surface`     | blanco                   | azul oscuro `#07122b`    |
| `fg`          | azul oscuro `#0a1a3f`    | blanco azulado `#f3f6ff` |
| `primary`     | azul oscuro `#123a8c`    | blanco                   |
| `accent`      | naranja `#f97801`        | naranja `#f97801`        |
| `accent-text` | naranja oscuro `#b04a00` | naranja claro `#ff9a3d`  |
| `success`     | verde `#0b7a43`          | verde claro `#4ade80`    |
| `band`        | azul oscuro `#0a1a3f`    | azul oscuro `#0e1f44`    |

- **El naranja puro no sirve para texto sobre blanco** (contraste 2,7:1): como relleno lleva texto azul oscuro, y
  para texto suelto existe `accent-text`.
- **Los estados usan color más icono más texto, nunca solo color.** `success` (verde) es «En línea» y
  `accent-text` es «Sin conexión»; los dos cumplen 4,5:1 sobre las superficies, así que valen también para texto.
- **La banda de marca** (`band`) es azul oscuro en los dos temas: las letras blancas del logo no se leen sobre
  fondo blanco. El logo (`presentation/assets/logo-stock.webp`, 27 KB) siempre va sobre ella.
- **El tema se marca con `data-theme` en la raíz** (`<html data-theme="dark">`). Los tokens oscuros viven en
  `:root[data-theme='dark']` y reemplazan a los claros, así que las clases no cambian de un tema al otro.
- **Quién decide el tema.** El botón de tema (`ThemeToggle`, 44 px, con el nombre «Cambiar a tema oscuro» o
  «Cambiar a tema claro») llama a `ThemePreference`. Esa preferencia es un caso de uso de `application/`:
  arranca con lo que la persona eligió la última vez y, si nunca eligió, con la preferencia del sistema; solo
  guarda una elección hecha a propósito. Detrás hay tres puertos de `domain/ports/out/`: `ThemeStorage`,
  `SystemTheme` y `ThemeApplier`, que implementan los adaptadores de `adapters/out/theme/` (almacenamiento
  local, `prefers-color-scheme` y `data-theme`). `infrastructure/create-theme-preference.ts` los cablea.
- **Sin destello al cargar.** `index.html` tiene un script en línea que pone `data-theme` antes de que arranque
  React. No pasa por el caso de uso, así que `test/design/theme-bootstrap.spec.ts` lo ejecuta de verdad y
  comprueba que decida igual que el resto (misma clave de almacenamiento y misma consulta de medios).
- **Si el navegador bloquea el almacenamiento** (ventana privada, datos del sitio bloqueados), el tema cambia
  igual durante la visita y simplemente no se recuerda.

### Reglas del movimiento

- **Solo `transform` y `opacity`**, salvo justificación escrita en el PR. Por eso el color de un botón cambia
  al instante y no con una transición.
- **`useReducedMotion` se respeta siempre.** Las variantes y los gestos salen de
  [`motion/presets.ts`](src/presentation/motion/presets.ts) y se piden con los hooks de
  [`motion/use-motion.ts`](src/presentation/motion/use-motion.ts), que ya consultan la preferencia: con
  movimiento reducido la entrada es un fundido, el skeleton queda quieto, las filas entran todas a la vez, el
  icono del botón de tema solo se desvanece y el gesto de presionar no hace nada.
- **Se usa `m`, no `motion`**, dentro de `MotionProvider` (`LazyMotion` en modo `strict`): usar `motion` por
  descuido lanza un error. Las cifras de peso están en [`docs/rendimiento.md`](docs/rendimiento.md).
- **Los objetivos táctiles miden al menos 44 px** (`min-h-touch min-w-touch`), y el foco del teclado se ve
  con el color `focus`.
- **El skeleton reproduce el diseño real:** cada línea tiene la misma altura que la del contenido, para que la
  pantalla no salte cuando termina de cargar.

## Calidad

- **Pruebas primero:** cada pieza nace de una prueba que se vio fallar (ADR 0007).
- **Hooks de Husky:** antes de cada commit se corren ESLint y Prettier sobre lo que cambia, y se valida el
  mensaje con commitlint.
- **CI** (GitHub Actions), siete trabajos:
  - escaneo de secretos (gitleaks sobre todo el historial);
  - convención de commits;
  - calidad del código (estilo y fronteras, formato, tipos, pruebas con cobertura —incluidos los tipos
    generados del contrato— y compilación);
  - contrato con el backend (las copias de `contract/openapi.json` y de `contract/calculation-vectors.json`
    coinciden con las del backend);
  - accesibilidad y rendimiento con Lighthouse (accesibilidad 100; la emulación es un Moto G Power con la CPU 4
    veces más lenta y red 4G lenta, ver [`docs/rendimiento.md`](docs/rendimiento.md));
  - análisis de código con CodeQL;
  - vulnerabilidades de las dependencias de producción.

## Documentación

- Cómo contribuir (ramas, commits, PR, comprobaciones, contrato y diseño): [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Rendimiento y Lighthouse: [`docs/rendimiento.md`](docs/rendimiento.md).
- La aplicación instalable (qué guarda el service worker y qué nunca, cómo se actualiza, el almacenamiento
  protegido y el presupuesto de peso): [`docs/aplicacion-instalable.md`](docs/aplicacion-instalable.md).
- Lo que se guarda en el equipo, cómo se protege y cuándo se olvida: [`docs/almacenamiento-local.md`](docs/almacenamiento-local.md).
- Cómo se envía la cola sin conexión y qué dice la pantalla mientras tanto: [`docs/sincronizacion.md`](docs/sincronizacion.md).
- El recorrido de la aplicación completa con el que se cierra cada ciclo, paso a paso y con lo que debe pasar:
  [`docs/recorrido-del-ciclo-2.md`](docs/recorrido-del-ciclo-2.md).
- Todos los ADR del proyecto, también los de este repositorio, viven en el backend:
  [`vsd-stock-backend/docs/adr`](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/tree/desarrollo/docs/adr).
- El flujo de trabajo (ramas, Issues, commits y PR) está en el
  [ADR 0010](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0010-flujo-de-trabajo-en-github.md);
  el CORS que necesita la API, en el
  [ADR 0012](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0012-cors-con-lista-explicita-de-origenes-y-sin-credenciales.md).
