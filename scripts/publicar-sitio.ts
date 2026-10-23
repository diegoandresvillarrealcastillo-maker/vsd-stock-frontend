// Publica la landing en Cloudflare Pages (C4-L8, ADR 0033 del backend), en su propio proyecto y con un comando que se puede repetir.
// Corre directamente en Node 24, que ejecuta TypeScript quitando los tipos: por eso este archivo no importa otros archivos del proyecto
// (la lista de pendientes la carga con `import()` de una hoja sin imports).
//
//   node scripts/publicar-sitio.ts --vista-previa [--simular]    una vista previa de la rama en la que estas
//   node scripts/publicar-sitio.ts --produccion   [--simular]    la direccion publica, solo desde `desarrollo` ya fusionado
//
// `--simular` dice si se podria publicar y con que comando, sin compilar ni subir nada. La sesion de Cloudflare es la de `wrangler login`
// (se entra en el navegador): este script no lee ni imprime ninguna clave.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROYECTO_DEL_SITIO = 'vsd-stock-sitio';
/** La rama de produccion del proyecto de Pages: lo que se sube con esta rama es la direccion publica, cualquier otra es una vista previa. */
export const RAMA_DE_PRODUCCION = 'desarrollo';
export const CARPETA_DEL_SITIO = 'sitio/dist';
/** Se fija la version mayor: una nueva no cambia el comportamiento sin que nadie lo note. */
const WRANGLER = 'wrangler@4';

export type Modo = 'vista-previa' | 'produccion';

/**
 * Lo unico que se acepta como nombre de rama: letras, numeros, punto, guion, guion bajo y barra, y que no empiece por un signo. El
 * nombre llega a un comando (en Windows, a traves de un interprete), asi que lo que ese interprete lee como otra cosa no entra.
 */
const RAMA_VALIDA = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export interface EntradaDeDecision {
  readonly modo: Modo;
  readonly rama: string;
  readonly sinConfirmar: boolean;
  readonly alDiaConOrigen: boolean;
  /** Lo que sigue pendiente de resolver, ya escrito para una persona (`puedePublicar(...).pendientes`). */
  readonly pendientes: readonly string[];
}

export interface Decision {
  readonly permitida: boolean;
  readonly razones: readonly string[];
  readonly ramaEnCloudflare: string;
}

/**
 * Decide si se puede publicar y, si no, dice todas las razones juntas. Una vista previa sale de cualquier rama menos la de produccion
 * (la direccion publica nunca puede ser una vista previa por descuido); la direccion publica sale solo de `desarrollo`, sin cambios
 * sueltos, en el mismo commit que `origin/desarrollo` y sin nada pendiente.
 */
export function decidirPublicacion(entrada: EntradaDeDecision): Decision {
  const razones: string[] = [];
  const { modo, rama } = entrada;

  if (modo === 'vista-previa') {
    if (rama === '') {
      razones.push(
        'No hay rama (estas en un commit suelto): Cloudflare necesita una rama para nombrar la vista previa.',
      );
    } else if (rama === RAMA_DE_PRODUCCION) {
      razones.push(
        `\`${rama}\` es la rama de produccion del proyecto: una vista previa no puede salir de ella. Para la direccion publica usa --produccion.`,
      );
    } else if (!RAMA_VALIDA.test(rama)) {
      razones.push(
        `El nombre de la rama (${JSON.stringify(rama)}) lleva caracteres que no se aceptan: solo letras, numeros, punto, guion, guion bajo y barra.`,
      );
    }
    return { permitida: razones.length === 0, razones, ramaEnCloudflare: rama };
  }

  if (modo === 'produccion') {
    if (rama !== RAMA_DE_PRODUCCION) {
      razones.push(
        `La direccion publica solo sale de \`${RAMA_DE_PRODUCCION}\` y estas en ${rama === '' ? 'ninguna rama' : `\`${rama}\``}.`,
      );
    }
    if (entrada.sinConfirmar) {
      razones.push(
        'Hay cambios sin confirmar: lo que sale tiene que ser lo que esta en el repositorio.',
      );
    }
    if (!entrada.alDiaConOrigen) {
      razones.push(
        `\`${RAMA_DE_PRODUCCION}\` no esta en el mismo commit que \`origin/${RAMA_DE_PRODUCCION}\`: solo sale lo que ya se fusiono (git pull --ff-only).`,
      );
    }
    for (const pendiente of entrada.pendientes) razones.push(`Pendiente: ${pendiente}`);
    return { permitida: razones.length === 0, razones, ramaEnCloudflare: RAMA_DE_PRODUCCION };
  }

  throw new Error(
    `Modo desconocido: ${JSON.stringify(modo)}. Los modos son vista-previa y produccion.`,
  );
}

/**
 * Los argumentos de `npx` para subir la carpeta del sitio como proyecto de Pages (`wrangler pages deploy`, nunca `wrangler deploy`, que
 * crea un Worker). La vista previa acepta cambios sin confirmar; la direccion publica no.
 */
export function argumentosDeWrangler({
  rama,
  produccion,
}: {
  readonly rama: string;
  readonly produccion: boolean;
}): string[] {
  if (!RAMA_VALIDA.test(rama)) {
    throw new Error(
      `El nombre de la rama (${JSON.stringify(rama)}) no se acepta para el comando de Cloudflare.`,
    );
  }
  if (produccion && rama !== RAMA_DE_PRODUCCION) {
    throw new Error(`La direccion publica solo sale de la rama ${RAMA_DE_PRODUCCION}.`);
  }
  if (!produccion && rama === RAMA_DE_PRODUCCION) {
    throw new Error(
      `Cloudflare toma la rama ${RAMA_DE_PRODUCCION} como la de produccion: de ella no sale una vista previa.`,
    );
  }
  return [
    '--yes',
    WRANGLER,
    'pages',
    'deploy',
    CARPETA_DEL_SITIO,
    '--project-name',
    PROYECTO_DEL_SITIO,
    '--branch',
    rama,
    ...(produccion ? [] : ['--commit-dirty=true']),
  ];
}

/** Lo que se lee de git para decidir. */
export interface EstadoDeGit {
  readonly rama: string;
  readonly sinConfirmar: boolean;
  readonly alDiaConOrigen: boolean;
}

export interface Plan {
  /** 0 se puede publicar, 1 se niega, 2 se pidio mal el comando. */
  readonly salida: 0 | 1 | 2;
  /** Lo que se le dice a la persona: a la salida de errores si `salida` no es 0. */
  readonly mensajes: readonly string[];
  /** Los argumentos de `npx` para subir; `null` si no se sube nada. */
  readonly comando: readonly string[] | null;
  readonly simulacion: boolean;
}

/**
 * Todo lo que el comando decide, sin tocar git, la red ni el disco: `leerEstado` le da el estado de git para el modo pedido (el unico
 * que hace falta leer: la direccion publica trae `origin` antes de comparar) y `pendientes` ya viene escrito para una persona.
 */
export function planear(
  argumentos: readonly string[],
  leerEstado: (modo: Modo) => EstadoDeGit,
  pendientes: readonly string[],
): Plan {
  const produccion = argumentos.includes('--produccion');
  const simulacion = argumentos.includes('--simular');
  if (produccion === argumentos.includes('--vista-previa')) {
    return {
      salida: 2,
      mensajes: ['Uso: node scripts/publicar-sitio.ts --vista-previa | --produccion  [--simular]'],
      comando: null,
      simulacion,
    };
  }
  const modo: Modo = produccion ? 'produccion' : 'vista-previa';

  const decision = decidirPublicacion({ modo, ...leerEstado(modo), pendientes });
  if (!decision.permitida) {
    return {
      salida: 1,
      mensajes: [`No se publica (${modo}):`, ...decision.razones.map((razon) => `  - ${razon}`)],
      comando: null,
      simulacion,
    };
  }

  const comando = argumentosDeWrangler({ rama: decision.ramaEnCloudflare, produccion });
  const mensajes: string[] = [];
  // En produccion no llega aqui con pendientes: la decision ya se nego.
  if (pendientes.length > 0) {
    mensajes.push(
      `Aviso: quedan ${String(pendientes.length)} pendiente(s) para la direccion publica. Una vista previa puede mostrarse con ellos, pero no la compartas como la definitiva.`,
    );
  }
  if (simulacion) {
    mensajes.push(
      `Se podria publicar (${modo}). Con --simular no se compila ni se sube. Comando:`,
      `  npm run build:sitio\n  npx ${comando.join(' ')}`,
    );
  }
  return { salida: 0, mensajes, comando, simulacion };
}

/** Su salida de errores se guarda (sale en el mensaje si git falla) en vez de ensuciar la terminal con el "From ..." del fetch. */
function git(cwd: string | undefined, ...argumentos: string[]): string {
  return execFileSync('git', argumentos, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
}

/** Lo que se lee de git para decidir. Para la direccion publica trae `origin` antes de comparar; una vista previa no toca la red. */
export function leerEstadoDeGit(modo: Modo, cwd?: string): EstadoDeGit {
  const rama = git(cwd, 'branch', '--show-current');
  const sinConfirmar = git(cwd, 'status', '--porcelain') !== '';
  let alDiaConOrigen = true;
  if (modo === 'produccion') {
    git(cwd, 'fetch', 'origin', RAMA_DE_PRODUCCION);
    alDiaConOrigen =
      git(cwd, 'rev-parse', 'HEAD') === git(cwd, 'rev-parse', `origin/${RAMA_DE_PRODUCCION}`);
  }
  return { rama, sinConfirmar, alDiaConOrigen };
}

/** En Windows `npm` y `npx` son `.cmd` y Node 24 solo los lanza a traves de un interprete: los argumentos ya estan validados. */
function lanzar(comando: string, argumentos: readonly string[]): void {
  execFileSync(comando, [...argumentos], { stdio: 'inherit', shell: process.platform === 'win32' });
}

async function main(): Promise<void> {
  const hoja = (await import(pathToFileURL(resolve('sitio/pagina/pendientes.ts')).href)) as {
    PENDIENTES_DE_PUBLICAR: readonly { que: string; quien: string }[];
    puedePublicar: (pendientes: readonly { que: string; quien: string }[]) => {
      pendientes: string[];
    };
  };
  const pendientes = hoja.puedePublicar(hoja.PENDIENTES_DE_PUBLICAR).pendientes;

  const plan = planear(process.argv.slice(2), leerEstadoDeGit, pendientes);
  for (const mensaje of plan.mensajes) (plan.salida === 0 ? console.log : console.error)(mensaje);
  if (plan.salida !== 0) process.exit(plan.salida);
  if (plan.simulacion || plan.comando === null) return;

  lanzar('npm', ['run', 'build:sitio']);
  lanzar('npx', plan.comando);
  console.log(
    `\nSubido. Comprueba lo publicado con la direccion que imprimio Cloudflare:\n  npm run verify:sitio -- <direccion>`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
