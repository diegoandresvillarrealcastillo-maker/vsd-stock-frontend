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
└── presentation/     pages/  components/  theme/  motion/  styles/  assets/   ← lo único que conoce React
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

## Contrato OpenAPI

El único acoplamiento con el backend es su contrato (ADR 0001). Aquí vive de cuatro formas:

- [`contract/openapi.json`](contract/openapi.json): una copia **exacta** del contrato del backend. No se edita
  a mano.
- [`contract/calculation-vectors.json`](contract/calculation-vectors.json): una copia **exacta** de los vectores de
  cálculo del backend (ver abajo). Tampoco se edita a mano.
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
- Todos los ADR del proyecto, también los de este repositorio, viven en el backend:
  [`vsd-stock-backend/docs/adr`](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/tree/desarrollo/docs/adr).
- El flujo de trabajo (ramas, Issues, commits y PR) está en el
  [ADR 0010](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0010-flujo-de-trabajo-en-github.md);
  el CORS que necesita la API, en el
  [ADR 0012](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0012-cors-con-lista-explicita-de-origenes-y-sin-credenciales.md).
