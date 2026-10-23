# Cómo contribuir al frontend de VSD Stock

Esta guía resume el flujo. Las decisiones y su porqué están en el
[ADR 0010](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0010-flujo-de-trabajo-en-github.md)
(todos los ADR del proyecto viven en el repositorio del backend); si algo de aquí lo contradice, manda el ADR.

## Antes de empezar

1. **Un ticket por cambio.** Cada trabajo tiene un Issue con el prefijo de su ciclo (`[C1-07] …`), asignado a
   una persona, y se crea **antes** de empezar. Sin Issue no hay rama. Parte de la plantilla de Issue
   ([`ticket.md`](.github/ISSUE_TEMPLATE/ticket.md)): trae el objetivo, los criterios de aceptación, de qué
   depende y la definición de terminado. Según la documentación de GitHub, las plantillas se leen de la rama por
   defecto (`produccion`); mientras no se promuevan, es probable que no se precargue y haya que copiar el
   esqueleto desde el archivo.
2. **Una rama corta por ticket**, creada desde `desarrollo` actualizado:

   ```bash
   git switch desarrollo && git pull --ff-only
   git switch -c feat/c1-07-descripcion-corta
   ```

   Tipos: `feat`, `fix`, `chore`, `ci`, `docs` y `test`. Nadie escribe directo en `desarrollo`,
   `preproduccion` ni `produccion`: están protegidas.

3. **El backend se fusiona antes que el frontend que depende de él.** Si tu cambio necesita algo nuevo de la
   API, ese PR va primero y el tuyo espera a que esté en `desarrollo`.

## Mientras trabajas

- **La prueba va primero.** Escribe la prueba, **ejecútala y comprueba que falla por la razón correcta** (no por
  un error de escritura), y solo entonces escribe el código mínimo que la hace pasar. Deja esa evidencia en el
  PR (ADR 0007).
- **Respeta las capas.** `domain/` y `application/` no conocen React ni el navegador; los adaptadores no importan
  `infrastructure/` ni `presentation/`; y la interfaz no importa los adaptadores: recibe los casos de uso ya
  cableados. Si cruzas una frontera, `npm run lint` falla y el mensaje te dice qué hacer (ADR 0002).
- **La lógica del cliente vive fuera de React.** Un caso de uso (`application/usecases/`) con puertos en
  `domain/ports/` y adaptadores en `adapters/`; la interfaz solo lo adapta (`presentation/…/XProvider.tsx` con
  `useSyncExternalStore`). Los casos de uso se prueban con dobles en memoria de sus puertos
  (`test/support/`), no con simulacros del propio caso de uso.
- **Lo que no puede probar jsdom, míralo en un navegador real.** jsdom no calcula estilos ni diseño ni
  animaciones: antes de dar por terminada una pantalla, ábrela en `npm run dev` en tema claro y oscuro, con y
  sin movimiento reducido y a 375 px de ancho. En la práctica es donde aparecen los defectos que las pruebas no
  ven.
- **Si cambias la API que consumes**, sincroniza el contrato y adapta el código (ver más abajo).
- **Si tomas una decisión de arquitectura**, escríbela como ADR en el repositorio del backend
  (`docs/adr/`) en un PR de allá, y enlázalo desde el tuyo. Un ADR no se edita: si la decisión cambia, se escribe
  uno nuevo que lo reemplaza.
- **Documenta en el mismo PR** lo que cambias. Cambiar el código sin cambiar su documento hace fallar la revisión.

## El contrato con el backend

El único acoplamiento con el backend es su contrato OpenAPI (ADR 0001). Este repositorio guarda una copia en
[`contract/openapi.json`](contract/openapi.json) y de ella genera los tipos que usa el adaptador de la API
(`src/adapters/out/api/schema.d.ts`). Guarda además una copia de los **vectores de cálculo** del dinero
([`contract/calculation-vectors.json`](contract/calculation-vectors.json), ADR 0014), que el dominio ejecuta en sus
pruebas.

```bash
npm run contract:sync     # copia el contrato y los vectores de la rama desarrollo del backend y regenera los tipos
npm run contract:check    # comprueba que las copias coinciden con el backend (lo mismo que hace el CI)
npm run contract:generate # solo regenera los tipos a partir de la copia
```

- Con `CONTRACT_REF=otra-rama` apuntas a otra rama del backend (por ejemplo, la de un PR que todavía no se
  fusiona).
- En el CI, la rama del backend es la base del Pull Request (o, en un push, la rama que lo recibe) **si el backend
  la tiene**. Un PR apilado tiene por base la rama de otro PR del frontend, que el backend no tiene: ahí el CI usa
  `desarrollo`. Si un ticket necesita cambios del backend, su rama allá se llama igual que la base y el CI la
  encuentra.
- **No edites `contract/openapi.json`, `contract/calculation-vectors.json` ni `schema.d.ts` a mano.** Una prueba
  compara los tipos con lo que genera la herramienta y dice qué comando ejecutar. El CI compara las copias con el
  backend y lista lo que cambió (en los vectores, qué secciones).
- **Si cambias una regla de dinero, IVA o redondeo**, el cambio nace en el backend (ADR 0014): allí se regeneran
  los vectores y aquí se copian con `npm run contract:sync`. Nunca se adapta un vector para que pase la prueba.
- Los datos que llegan de la red **no son de fiar aunque el contrato diga otra cosa**: el adaptador comprueba la
  forma de lo que recibe y rechaza lo demás.

## Hablar con el backend en local

1. En el backend: `CORS_ORIGINS=http://localhost:5173` en su `.env` (ya viene en su `.env.example`) y `npm start`.
2. Aquí: `npm run dev`. Sin configurar nada, apunta a `http://localhost:3000`; para otra dirección, copia
   `.env.example` como `.env` y define `VITE_API_URL`. **Todo lo que lleva el prefijo `VITE_` termina en el
   paquete que descarga el navegador: nunca un secreto.**
3. Si la pantalla dice «Sin conexión» con el backend en marcha, abre la consola del navegador: casi siempre es
   que falta el origen en `CORS_ORIGINS` (ADR 0012) o que `VITE_API_URL` apunta a otro lado.

## Diseño

- **El diseño sale de Figma**:
  [VSD Stock — Sistema de diseño](https://www.figma.com/design/BDeOxwJeQ3AfUThABfmC3L). Si una pantalla o un
  componente nuevo no está ahí, se diseña primero. Las variables de Figma tienen los mismos nombres que los tokens
  del CSS: **si cambia un color, cambia en Figma y en `src/presentation/styles/index.css` en el mismo PR**.
- **Tokens, no valores sueltos**: `bg-surface`, `text-fg-muted`, `px-gutter`… Un color nuevo se declara también
  en el tema oscuro y cumple contraste AA (lo comprueba `test/design/tokens.spec.ts`).
- **El color nunca es lo único que cuenta algo**: cada estado lleva además un icono y un texto.
- **Movimiento**: solo `transform` y `opacity`, siempre con los hooks de `presentation/motion/` (respetan
  `prefers-reduced-motion`) y con `m`, no `motion` (ADR 0008).
- **Objetivos táctiles de al menos 44 px** (`min-h-touch min-w-touch`) y foco visible con el teclado.

## Comprobaciones locales

Antes de empujar, estas cinco deben pasar (son las del CI):

```bash
npm run lint
npm run format:check      # npm run format lo corrige
npm run typecheck
npm run test:coverage
npm run build
```

Además, el CI ejecuta `npm run contract:check` y `npm run lighthouse` (necesita Chrome; audita `dist/`, así que
primero `npm run build`). Con Lighthouse la accesibilidad tiene que dar 100.

Si tocas la landing (`sitio/`), el CI también compila `npm run build:sitio` y ejecuta `npm run lighthouse:sitio` (audita
`sitio/dist/`, la accesibilidad también tiene que dar 100) y `npm run e2e:sitio` (axe en claro y oscuro, movimiento reducido y el peso
de la carga inicial contra `scripts/presupuesto-sitio.json`). Qué mide cada uno y cómo correrlo:
[`docs/rendimiento-de-la-landing.md`](docs/rendimiento-de-la-landing.md).

Husky corre ESLint y Prettier sobre lo que cambia antes de cada commit, y valida el mensaje. **No uses
`--no-verify`**: el CI repite todo y no se puede saltar.

### Pruebas en un navegador de verdad (C3-15)

Las pruebas de `e2e/` abren la web ya compilada en Chromium, Firefox y WebKit contra la API y la base reales (sin red, recargando, con
dos pestañas y con varios dispositivos) y pasan axe por cada pantalla. Necesitan el backend clonado al lado y su base de trabajo
(`npm run db:up` allá):

```bash
npm run e2e:chromium      # el que bloquea el CI; npm run e2e corre los tres
```

Cuando cambies algo de lo que se ve o de cómo se envía, corre al menos Chromium. En el CI el trabajo es **«Navegador real
(chromium)»**: es el que Diego marca como obligatorio cuando esté en verde; Firefox y WebKit se corren y se informan, pero no
bloquean. Cómo está armada la pila, qué probó cada archivo y qué encontró: [`docs/pruebas-en-navegador.md`](docs/pruebas-en-navegador.md).
Si cambias de qué dirección habla la web, **vuelve a compilar con `npm run build:e2e`** y las direcciones de la pila.

### Roturas a propósito con Stryker (C3-17)

Una prueba que pasa no prueba que vigile algo. [Stryker](https://stryker-mutator.io) rompe el código **a propósito**, de a una
cosa por vez (invierte una condición, quita una rama, cambia un `<` por `<=`), corre las pruebas que tocan esa línea y cuenta
cuántas roturas **notó alguna prueba**. Lo que ninguna prueba nota es un hueco: un comportamiento que nadie vigila.

```bash
npm run mutation          # la primera vez, ~30 min con ocho núcleos; el informe queda en reports/mutation/mutation.html
```

- **Qué rompe:** solo `domain/` y `application/`, las capas con lógica. No rompe la interfaz, los adaptadores ni el cableado.
  Repite solo las pruebas de esas capas y los vectores de cálculo del contrato (`vitest.mutation.config.ts`).
- **Cómo leer el informe:** abre `reports/mutation/mutation.html`. Cada rotura queda _muerta_ (una prueba la notó), _sobrevivió_
  (ninguna la notó: falta una prueba o el código sobra), _sin cobertura_ (ninguna prueba pasa por ahí) o _tiempo agotado_
  (la rotura hizo que el código se colgara, y cuenta como notada). Empieza por las que sobrevivieron.
- **Puntaje:** el porcentaje de roturas notadas. La base de `desarrollo` dio **95,68 %** (1.860 notadas, 79 sobrevivientes y 5 sin
  cobertura, de 1.944). Verde desde 95 %, aviso por debajo de 92 % y **rojo por debajo de 90 %** (`thresholds` en
  `stryker.config.json`). El piso se sube a medida que se cubren los huecos; nunca se baja para que pase.
- **Es incremental:** Stryker guarda lo que aprendió en `reports/stryker-incremental.json` y la siguiente corrida solo repite lo
  que cambió (el código roto o las pruebas que lo tocan). Así, después de la primera vez, `npm run mutation` tarda minutos. Para
  empezar de cero, borra ese archivo. En el CI la memoria se guarda en la caché del repositorio: la corrida de un PR parte de la
  de su rama y, si no hay, de la de `desarrollo`.
- **En el CI** corre como el trabajo **«Roturas a proposito (Stryker)»** y guarda el informe como artefacto
  (`informes-roturas`). Por ahora **no es obligatorio**: no está en el conjunto de reglas de las ramas y no bloquea ningún PR hasta
  que Diego lo marque. Aun así queda en rojo si el puntaje baja del piso: es una señal, no un adorno. Y recuerda que **un check del CI es su
  nombre**: renombrarlo equivale a quitar el check exigido.
- **Cuando cambias `domain/` o `application/`,** corre `npm run mutation` y mira solo lo que tocaste: `npx stryker run
--mutate "src/domain/model/mi-archivo.ts"` tarda un par de minutos.
- **Una rotura que sobrevive y es equivalente** (cambia el código pero no el comportamiento) se deja y se anota en el PR; no se
  escribe una prueba que fuerce un detalle sin importancia.
- **Por qué existe `scripts/mutation.ts`:** el runner de Vitest de Stryker 10.0.0 es anterior a Vitest 5 y busca cada prueba por su
  nombre con los nombres unidos por espacios, mientras Vitest 5 los une con « > ». No encuentra ninguna, no corre ninguna prueba y
  todas las roturas «sobreviven» (puntaje 0 con un código bien probado). El script repara esa línea del runner antes de correr y se
  detiene si el runner cambia. Cuando Stryker publique un runner con soporte para Vitest 5, se borran el script y su prueba y el
  script `mutation` vuelve a ser `stryker run`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) **en español, en plural, con tildes** y tono
profesional. El encabezado, de hasta 100 caracteres y sin punto final; cada línea del cuerpo, de hasta 100. Cada
commit cita su Issue con una línea `Refs: #N`:

```
feat(conexion): sumamos el estado de la conexión y el caso de uso que la vigila

Cuerpo opcional que explica el porqué.

Refs: #3
```

**Sin líneas `Co-Authored-By` ni marcas de «generado con…»**, en commits ni en PR.

## Pull Request

1. Abre el PR contra **`desarrollo`** (la rama por defecto del repositorio es `produccion`, así que indica la
   base de forma explícita). Usa la plantilla.
2. **Queda en borrador hasta que el CI esté en verde.** Después lo marcas como listo y pides la revisión.
3. **Quien abre un PR no lo aprueba ni lo fusiona.** Lo revisa y lo fusiona la otra persona del equipo, con
   «Create a merge commit». Si pide cambios, se corrigen en el mismo PR.
4. Al fusionar, la rama se borra sola. Actualiza tu copia: `git fetch --prune` y borra la rama local.

Un PR está **listo** solo si el CI está en verde y no tiene conflictos; el estado `BLOCKED` solo porque falta la
aprobación es lo esperado.

## Seguridad

- **Nada de secretos en el repositorio**: ni claves, ni contraseñas, ni `.env`, ni datos personales. Gitleaks
  revisa todo el historial y un secreto borrado después sigue estando en él.
- **Nada de datos reales en las pruebas ni en el código de muestra**: los datos ficticios se marcan como tales.

## Trampas conocidas del entorno

- **Windows y PowerShell 5.1:** al pasar texto por una tubería antepone un carácter invisible (BOM) y commitlint
  lo rechaza con «header must not start with whitespace». Escribe el mensaje en un archivo y usa
  `git commit -F archivo`.
- **`npm` en Windows es `npm.cmd`:** con `Start-Process` hay que lanzar `npm.cmd`.
- **Husky tras `npm install <paquete>`:** si los hooks no se activan, ejecuta `npm run prepare`.
- **`npm install` de `openapi-typescript`:** declara compatibilidad con TypeScript 5 y aquí usamos 6; el
  `overrides` de `package.json` lo dice de forma explícita. Si lo quitas, `npm install` falla con `ERESOLVE`.
- **`node scripts/contract.ts`** necesita Node 24 (ejecuta TypeScript sin compilar) y red.
