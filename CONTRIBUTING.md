# Cómo contribuir al frontend de VSD Stock

Esta guía resume el flujo. Las decisiones y su porqué están en el
[ADR 0010](https://github.com/diegoandresvillarrealcastillo-maker/vsd-stock-backend/blob/desarrollo/docs/adr/0010-flujo-de-trabajo-en-github.md)
(todos los ADR del proyecto viven en el repositorio del backend); si algo de aquí lo contradice, manda el ADR.

## Antes de empezar

1. **Un ticket por cambio.** Cada trabajo tiene un Issue con el prefijo de su ciclo (`[C1-07] …`), asignado a
   una persona, y se crea **antes** de empezar. Sin Issue no hay rama.
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
(`src/adapters/out/api/schema.d.ts`).

```bash
npm run contract:sync     # copia el contrato de la rama desarrollo del backend y regenera los tipos
npm run contract:check    # comprueba que la copia coincide con el backend (lo mismo que hace el CI)
npm run contract:generate # solo regenera los tipos a partir de la copia
```

- Con `CONTRACT_REF=otra-rama` apuntas a otra rama del backend (por ejemplo, la de un PR que todavía no se
  fusiona).
- **No edites `contract/openapi.json` ni `schema.d.ts` a mano.** Una prueba compara los tipos con lo que genera la
  herramienta y dice qué comando ejecutar. El CI compara la copia con el backend y lista lo que cambió.
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

Husky corre ESLint y Prettier sobre lo que cambia antes de cada commit, y valida el mensaje. **No uses
`--no-verify`**: el CI repite todo y no se puede saltar.

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
