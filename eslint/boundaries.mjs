/**
 * Fronteras de la arquitectura hexagonal del frontend (ADR 0002).
 *
 * Regla de dependencia, siempre hacia adentro:
 *
 *   presentation, adapters, infrastructure  ->  application  ->  domain
 *
 * Ademas, solo presentation/ conoce React y las bibliotecas de interfaz. La
 * logica del cliente (el motor de sincronizacion, las reglas de la venta
 * offline) tiene que poder ejecutarse y probarse sin un navegador.
 *
 * La interfaz no llega a los adaptadores por su cuenta: usa los casos de uso
 * que infrastructure/ le entrega ya cableados. Si presentation/ importara un
 * adaptador, saltaria los casos de uso y las reglas que viven en ellos.
 *
 * Los patrones se escriben sobre el texto del import (la ruta relativa), no
 * sobre el grafo real de dependencias. Por eso el proyecto usa rutas
 * relativas: si algun dia se introduce un alias, estas reglas y su prueba
 * (test/architecture/boundaries.spec.ts) se actualizan en el mismo PR.
 *
 * Cada mensaje dice que hacer, no solo que esta prohibido.
 */

const DOMINIO_A_CAPAS =
  'domain/ no puede depender de application/, adapters/, infrastructure/ ni presentation/: las dependencias apuntan hacia adentro. Si el dominio necesita algo de afuera, lo que falta es un puerto en domain/ports/out/ que un adaptador implemente.';

const DOMINIO_EXTERNO =
  'domain/ no puede importar paquetes externos (React incluido) ni modulos del navegador: el nucleo debe poder probarse sin framework. Si necesitas algo del exterior (hora, almacenamiento, red), declara un puerto en domain/ports/out/ y ponle un adaptador en adapters/out/.';

const APLICACION_A_EXTERIOR =
  'application/ no puede depender de adapters/, infrastructure/ ni presentation/, ni siquiera en sus pruebas. Depende del puerto que declara domain/, y es infrastructure/ quien decide que adaptador se inyecta.';

const APLICACION_REACT =
  'application/ no conoce React ni bibliotecas de interfaz: solo presentation/ las usa. La logica del cliente debe poder ejecutarse sin un navegador. Expone un caso de uso y que presentation/ lo llame desde un hook.';

const ADAPTADOR_A_CAPAS =
  'adapters/ no puede depender de infrastructure/ ni de presentation/: es infrastructure/ quien importa los adaptadores para cablearlos. Un adaptador solo habla con application/ y domain/ a traves de los puertos.';

const ADAPTADOR_REACT =
  'adapters/ no conoce React ni bibliotecas de interfaz: solo presentation/ las usa. Un adaptador implementa un puerto de domain/ports/ con APIs del navegador, no con componentes.';

const ENTRADA_A_SALIDA =
  'adapters/in no puede importar de adapters/out. Un adaptador de entrada habla con application/ a traves de los puertos de domain/ports/in/, no con otro adaptador.';

const SALIDA_A_ENTRADA =
  'adapters/out no puede importar de adapters/in. Un adaptador de salida solo implementa un puerto de domain/ports/out/; no conoce a quien lo llama.';

const PRESENTACION_A_ADAPTADORES =
  'presentation/ no importa de adapters/ ni de infrastructure/: salta los casos de uso. La interfaz recibe los casos de uso ya cableados (por un contexto o un hook en presentation/hooks/) y llama a esos casos de uso; es infrastructure/ quien los construye.';

const SITIO_A_APLICACION =
  'sitio/ (la landing, ADR 0033) solo importa de la aplicacion el dominio puro (src/domain/) y las imagenes de las mascotas (src/presentation/assets/mascotas/): es otro producto, para otras personas, y no comparte casos de uso, pantallas ni componentes. Si necesita un calculo, que viva en domain/ y asi lo usan los dos.';

const DINAMICO =
  'En domain/ y application/ no se usan require ni import() dinamico: esconden dependencias que no-restricted-imports no ve. Usa un import estatico y, si hace falta algo de afuera, un puerto en domain/ports/out/.';

// React y las bibliotecas de interfaz: solo presentation/ puede importarlas.
const PAQUETES_DE_INTERFAZ =
  '^(react|react-dom|react-router|react-router-dom|framer-motion|motion)(/|$)';

/** @type {import('eslint').Linter.Config[]} */
export const boundaries = [
  // ---------- El dominio no depende de nadie ----------
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    // Las pruebas necesitan importar el ejecutor de pruebas y no forman parte
    // de lo que se despliega: se les prohiben las capas, no los paquetes.
    ignores: ['src/domain/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/application/**',
                '**/adapters/**',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message: DOMINIO_A_CAPAS,
            },
            {
              // Todo lo que no empiece por "." es un paquete externo o un
              // modulo del entorno. El dominio no puede usar ninguno.
              regex: '^[^.]',
              message: DOMINIO_EXTERNO,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/application/**',
                '**/adapters/**',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message: DOMINIO_A_CAPAS,
            },
          ],
        },
      ],
    },
  },

  // ---------- La aplicacion no conoce el exterior ni React ----------
  {
    files: ['src/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '**/infrastructure/**', '**/presentation/**'],
              message: APLICACION_A_EXTERIOR,
            },
            { regex: PAQUETES_DE_INTERFAZ, message: APLICACION_REACT },
          ],
        },
      ],
    },
  },

  // ---------- Los adaptadores no conocen infrastructure, presentation ni React ----------
  {
    files: ['src/adapters/in/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/infrastructure/**', '**/presentation/**'], message: ADAPTADOR_A_CAPAS },
            { regex: PAQUETES_DE_INTERFAZ, message: ADAPTADOR_REACT },
            {
              // Desde adapters/in, llegar a adapters/out es subir con "../" y
              // entrar en "out/". Un "../domain/ports/out/..." no coincide
              // porque tras los "../" viene "domain/".
              regex: '^(\\.\\./)+out/',
              message: ENTRADA_A_SALIDA,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/adapters/out/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/infrastructure/**', '**/presentation/**'], message: ADAPTADOR_A_CAPAS },
            { regex: PAQUETES_DE_INTERFAZ, message: ADAPTADOR_REACT },
            { regex: '^(\\.\\./)+in/', message: SALIDA_A_ENTRADA },
          ],
        },
      ],
    },
  },

  // ---------- La interfaz no salta los casos de uso ----------
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/**', '**/infrastructure/**'],
              message: PRESENTACION_A_ADAPTADORES,
            },
          ],
        },
      ],
    },
  },

  // ---------- La landing toma del producto el dominio y las mascotas, nada mas (ADR 0033) ----------
  {
    files: ['sitio/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Todo import que entra en el `src/` de la aplicacion y no va al dominio ni a las mascotas. La carpeta de la
              // propia landing se llama `pagina/`, no `src/`, para que esta regla no confunda lo suyo con lo de la aplicacion.
              regex: '(^|/)src/(?!domain/|presentation/assets/mascotas/)',
              message: SITIO_A_APLICACION,
            },
          ],
        },
      ],
    },
  },

  // ---------- Sin require ni import() dinamico en el nucleo ----------
  {
    files: ['src/domain/**/*.{ts,tsx}', 'src/application/**/*.{ts,tsx}'],
    ignores: ['src/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'ImportExpression', message: DINAMICO },
        { selector: "CallExpression[callee.name='require']", message: DINAMICO },
      ],
    },
  },
];
