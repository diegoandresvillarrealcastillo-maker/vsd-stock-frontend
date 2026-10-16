# vsd-stock-frontend

PWA de **VSD Stock**: inventario, punto de venta, caja y reportes para MiPymes. Está pensada para
seguir vendiendo aunque se caiga el internet.

> **Estado: Ciclo 0 (fundaciones).** Hoy muestra una página de inicio con la muestra del sistema de diseño.
> Es el esqueleto con las capas, las fronteras impuestas por ESLint, el CI y los tokens de diseño; la
> pantalla que consume la API llega con el ticket C0-08 y la funcionalidad de negocio, en los ciclos
> siguientes.

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
├── application/      casos de uso y motor de sincronización
├── adapters/         in/  out/                      ← conexión, API, almacén local cifrado, cámara…
├── infrastructure/   cableado y arranque (main.tsx)
└── presentation/     pages/  components/  motion/  styles/   ← lo único que conoce React
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
muestra: tokens, un skeleton animado y una entrada con movimiento.

**Los tokens se definen una sola vez**, en [`src/presentation/styles/index.css`](src/presentation/styles/index.css)
(`@theme static`), y se usan como utilidades de Tailwind (`bg-surface`, `text-fg-muted`, `rounded-lg`,
`px-gutter`, `min-h-touch`…):

| Familia       | Tokens                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Color         | `surface`, `surface-raised`, `fg`, `fg-muted`, `accent`, `accent-hover`, `on-accent`, `border`, `focus`, `skeleton`               |
| Tipografía    | `font-sans` (fuentes del sistema: la primera pantalla no espera ninguna descarga), `font-mono` y la escala `text-xs` a `text-3xl` |
| Espacio       | base de 4 px, `gutter` (margen lateral) y `touch` (44 px, el objetivo táctil mínimo)                                              |
| Radio, sombra | `rounded-sm` a `rounded-xl`, `shadow-sm` a `shadow-lg`                                                                            |
| Movimiento    | duraciones `fast`, `base`, `slow` y `pulse`; curvas `standard` y `exit`                                                           |

- **Claro y oscuro** siguen la preferencia del sistema (`prefers-color-scheme`). El modo oscuro reemplaza los
  mismos tokens de color, así que las clases no cambian de un modo al otro.
- **Contraste AA comprobado por pruebas:** `test/design/tokens.spec.ts` lee el CSS y exige 4,5:1 al texto y
  3:1 a bordes y foco, en los dos modos. Un color nuevo debe declararse también en el modo oscuro.
- **Las duraciones y curvas existen también en TypeScript**
  ([`motion/tokens.ts`](src/presentation/motion/tokens.ts)) porque Framer las necesita ahí. La misma prueba
  comprueba que ambos lados digan lo mismo.

### Reglas del movimiento

- **Solo `transform` y `opacity`**, salvo justificación escrita en el PR. Por eso el color de un botón cambia
  al instante y no con una transición.
- **`useReducedMotion` se respeta siempre.** Las variantes y los gestos salen de
  [`motion/presets.ts`](src/presentation/motion/presets.ts) y se piden con los hooks de
  [`motion/use-motion.ts`](src/presentation/motion/use-motion.ts), que ya consultan la preferencia: con
  movimiento reducido la entrada es un fundido, el skeleton queda quieto y el gesto de presionar no hace nada.
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
