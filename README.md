# vsd-stock-frontend

PWA de **VSD Stock**: inventario, punto de venta, caja y reportes para MiPymes. Está pensada para
seguir vendiendo aunque se caiga el internet.

> **Estado: Ciclo 0 (fundaciones).** Hoy muestra una página de inicio con la identidad de marca (azul oscuro,
> blanco y naranja), un botón de tema claro/oscuro y la muestra del sistema de diseño. Es el esqueleto con
> las capas, las fronteras impuestas por ESLint, el CI y los tokens de diseño; la pantalla que consume la
> API llega con el ticket C0-08 y la funcionalidad de negocio, en los ciclos siguientes.

## Requisitos

- Node 24 (la versión exacta está en `.nvmrc`) y npm.

## Primeros pasos

```bash
npm ci
npm run dev
```

La aplicación queda en <http://localhost:5173>.

## Scripts

| Script                  | Qué hace                                                                   |
| ----------------------- | -------------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo de Vite.                                            |
| `npm run build`         | Revisa los tipos y genera la versión de producción en `dist/`.             |
| `npm run preview`       | Sirve `dist/` para probar la versión de producción.                        |
| `npm test`              | Ejecuta las pruebas (Vitest, jsdom y Testing Library).                     |
| `npm run test:coverage` | Pruebas con cobertura; falla si `domain/` o `application/` bajan del 80 %. |
| `npm run lint`          | ESLint, incluidas las **fronteras de la arquitectura**.                    |
| `npm run format:check`  | Comprueba el formato con Prettier (`npm run format` lo corrige).           |
| `npm run typecheck`     | Revisa los tipos de la aplicación y de las herramientas.                   |

## Arquitectura

Hexagonal, con la dependencia siempre hacia adentro (ADR 0002):

```
presentation, adapters, infrastructure  →  application  →  domain
```

```
src/
├── domain/           model/  ports/{in,out}/        ← el núcleo: sin framework, sin React, sin navegador
├── application/      usecases/                      ← casos de uso y, después, el motor de sincronización
├── adapters/         in/  out/                      ← conexión, API, almacén local cifrado, cámara…
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

## Sistema de diseño

Estilo con **Tailwind CSS 4** y movimiento con **Framer Motion** (ADR 0008). La página de inicio es la
muestra: marca, botón de tema, tokens, un skeleton animado y entradas con movimiento.

**Diseño en Figma:** [VSD Stock — Sistema de diseño](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L).
Tiene la paleta en los dos temas con sus contrastes calculados, los componentes (botón, botón de tema, fila
de producto) y las pantallas de inicio en claro y oscuro, con contenido y en estado de carga. Las variables
de Figma tienen los mismos nombres que los tokens del CSS (`color/surface` ↔ `--color-surface`): si cambia
una, cambia la otra en el mismo PR.

**Los tokens se definen una sola vez**, en [`src/presentation/styles/index.css`](src/presentation/styles/index.css)
(`@theme static`), y se usan como utilidades de Tailwind (`bg-surface`, `text-fg-muted`, `rounded-lg`,
`px-gutter`, `min-h-touch`…):

| Familia       | Tokens                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color         | `surface`, `surface-raised`, `fg`, `fg-muted`, `primary`, `primary-hover`, `on-primary`, `accent`, `accent-hover`, `on-accent`, `accent-text`, `border`, `focus`, `skeleton`, `band`, `on-band` |
| Tipografía    | `font-sans` (fuentes del sistema: la primera pantalla no espera ninguna descarga), `font-mono` y la escala `text-xs` a `text-3xl`                                                               |
| Espacio       | base de 4 px, `gutter` (margen lateral) y `touch` (44 px, el objetivo táctil mínimo)                                                                                                            |
| Radio, sombra | `rounded-sm` a `rounded-xl`, `shadow-sm` a `shadow-lg`                                                                                                                                          |
| Movimiento    | duraciones `fast`, `base`, `slow` y `pulse`; curvas `standard` y `exit`                                                                                                                         |

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
| `band`        | azul oscuro `#0a1a3f`    | azul oscuro `#0e1f44`    |

- **El naranja puro no sirve para texto sobre blanco** (contraste 2,7:1): como relleno lleva texto azul oscuro, y
  para texto suelto existe `accent-text`.
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
- **CI** (GitHub Actions), tres trabajos: escaneo de secretos, convención de commits y calidad del código
  (estilo y fronteras, formato, tipos, pruebas con cobertura y compilación).

## Documentación

Todos los ADR del proyecto, también los de este repositorio, viven en el backend:
[`vsd-stock-backend/docs/adr`](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/tree/desarrollo/docs/adr).
El flujo de trabajo (ramas, Issues, commits y PR) está en el
[ADR 0010](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0010-flujo-de-trabajo-en-github.md).
La guía `CONTRIBUTING.md` llega con el ticket C0-08.
