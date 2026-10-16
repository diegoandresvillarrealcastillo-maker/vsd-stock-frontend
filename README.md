# vsd-stock-frontend

PWA de **VSD Stock**: inventario, punto de venta, caja y reportes para MiPymes. Está pensada para
seguir vendiendo aunque se caiga el internet.

> **Estado: Ciclo 0 (fundaciones).** Hoy muestra una página de inicio. Es el esqueleto con las capas, las
> fronteras impuestas por ESLint y el CI; la pantalla que consume la API llega con el ticket C0-08 y la
> funcionalidad de negocio, en los ciclos siguientes.

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
└── presentation/     pages/  components/  hooks/    ← lo único que conoce React
```

Dos reglas que conviene recordar:

- **Solo `presentation/` conoce React** y las bibliotecas de interfaz. La lógica del cliente (el motor de
  sincronización, las reglas de la venta sin conexión) tiene que poder ejecutarse y probarse sin un navegador.
- **La interfaz no importa los adaptadores.** Recibe los casos de uso ya cableados desde `infrastructure/` y
  llama a esos casos de uso, para no saltarse las reglas que viven en ellos.

Cruzar una frontera **rompe el build**: `npm run lint` falla con un mensaje que explica qué hacer, y
`test/architecture/boundaries.spec.ts` comprueba que cada regla se sigue imponiendo.

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
