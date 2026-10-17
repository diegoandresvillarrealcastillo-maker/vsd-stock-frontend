// Herramienta de linea de comandos que mantiene al dia las copias de lo que el
// backend publica para el frontend: el contrato OpenAPI (ADR 0001) y los
// vectores de calculo compartidos (ADR 0014). Corre directamente en Node 24, que
// ejecuta TypeScript quitando los tipos: por eso este archivo no usa sintaxis que
// necesite compilarse (enums, propiedades de parametro) ni importa otros
// archivos del proyecto.
//
//   node scripts/contract.ts sync    copia los dos archivos del backend a contract/
//   node scripts/contract.ts check   falla si alguna copia ya no coincide con el backend
//
// La rama del backend se elige con CONTRACT_REF (por omision, desarrollo). Si
// hay GITHUB_TOKEN se envia, para no depender del limite de consultas anonimas.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BACKEND_REPOSITORY = 'diegoandresvillarrealcastillo-maker/vsd-stock-backend';
export const CONTRACT_PATH = 'contract/openapi.json';
export const VECTORS_PATH = 'contract/calculation-vectors.json';
export const PERMISSIONS_PATH = 'contract/permissions.json';
const DEFAULT_REF = 'desarrollo';
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

type FetchFunction = (input: string, init?: RequestInit) => Promise<Response>;

export interface Io {
  fetch: FetchFunction;
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  log: (line: string) => void;
  error: (line: string) => void;
}

export interface ContractComparison {
  same: boolean;
  differences: string[];
}

/** Direccion de un archivo del backend en la rama pedida, por la API de GitHub (sin cache de CDN). */
export function backendFileUrl(path: string, ref: string): string {
  return `https://api.github.com/repos/${BACKEND_REPOSITORY}/contents/${path}?ref=${encodeURIComponent(ref)}`;
}

/** Direccion del contrato en la rama pedida del backend. */
export function contractUrl(ref: string): string {
  return backendFileUrl('openapi.json', ref);
}

/** Pide un archivo al backend. Falla con un mensaje que dice que archivo, que rama y que respondio GitHub. */
async function fetchBackendFile(
  file: { path: string; label: string },
  ref: string,
  { fetch, token }: { fetch: FetchFunction; token?: string },
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.raw+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token !== undefined && token !== '') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(backendFileUrl(file.path, ref), { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo consultar ${file.label} del backend (rama ${ref}): ${reason}`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(
      `GitHub respondió ${response.status} al pedir ${file.label} (${file.path}) del backend en la rama ${ref}`,
    );
  }
  return response.text();
}

/** Pide el contrato al backend. Falla con un mensaje que dice que rama y que respondio GitHub. */
export function fetchBackendContract(
  ref: string,
  deps: { fetch: FetchFunction; token?: string },
): Promise<string> {
  return fetchBackendFile({ path: 'openapi.json', label: 'el contrato' }, ref, deps);
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function parse(source: string, side: string): Json {
  try {
    return JSON.parse(source) as Json;
  } catch {
    throw new Error(`${side} no es un JSON válido`);
  }
}

// Las claves se ordenan para que dos documentos iguales con las claves en otro
// orden cuenten como iguales.
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key] as Json)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function asRecord(value: Json | undefined): Record<string, Json> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function operationsOf(document: Json): Set<string> {
  const operations = new Set<string>();
  const paths = asRecord(asRecord(document)['paths']);
  for (const [path, item] of Object.entries(paths)) {
    for (const method of Object.keys(asRecord(item))) {
      if (HTTP_METHODS.includes(method)) operations.add(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations;
}

function schemasOf(document: Json): Set<string> {
  const components = asRecord(asRecord(document)['components']);
  return new Set(Object.keys(asRecord(components['schemas'])));
}

function difference(from: Set<string>, to: Set<string>): string[] {
  return [...from].filter((item) => !to.has(item)).sort();
}

/** Compara la copia local con el contrato del backend e indica que cambio. */
export function compareContracts(local: string, remote: string): ContractComparison {
  const mine = parse(local, 'La copia local');
  const theirs = parse(remote, 'El contrato del backend');
  if (canonical(mine) === canonical(theirs)) {
    return { same: true, differences: [] };
  }

  const differences = [
    ...difference(operationsOf(theirs), operationsOf(mine)).map(
      (item) => `El backend agregó ${item}`,
    ),
    ...difference(operationsOf(mine), operationsOf(theirs)).map(
      (item) => `El backend quitó ${item}`,
    ),
    ...difference(schemasOf(theirs), schemasOf(mine)).map(
      (name) => `El backend agregó el esquema ${name}`,
    ),
    ...difference(schemasOf(mine), schemasOf(theirs)).map(
      (name) => `El backend quitó el esquema ${name}`,
    ),
  ];
  if (differences.length === 0) {
    differences.push(
      'El contenido cambió (un campo, un tipo o una descripción) sin que cambie la lista de operaciones ni de esquemas',
    );
  }
  return { same: false, differences };
}

/**
 * Compara la copia local de los vectores de calculo con la del backend (ADR 0014) e indica que
 * secciones cambiaron. Dos documentos iguales con otro orden de claves o de espacios son iguales.
 */
export function compareVectors(local: string, remote: string): ContractComparison {
  const mine = asRecord(parse(local, 'La copia local de los vectores'));
  const theirs = asRecord(parse(remote, 'Los vectores del backend'));
  const differences: string[] = [];
  for (const key of [...new Set([...Object.keys(theirs), ...Object.keys(mine)])]) {
    const here = mine[key];
    const there = theirs[key];
    if (here === undefined) {
      differences.push(`La sección «${key}» solo existe en el backend`);
    } else if (there === undefined) {
      differences.push(`La sección «${key}» solo existe aquí`);
    } else if (canonical(here) !== canonical(there)) {
      differences.push(
        Array.isArray(here) && Array.isArray(there) && here.length !== there.length
          ? `La sección «${key}» cambió: ${here.length} aquí y ${there.length} en el backend`
          : `La sección «${key}» cambió`,
      );
    }
  }
  return { same: differences.length === 0, differences };
}

function rolesOf(action: Json | undefined): string {
  const roles = asRecord(action)['roles'];
  return Array.isArray(roles) ? [...roles].map(String).sort().join(',') : '';
}

/**
 * Compara la copia local de la tabla de permisos con la del backend (ADR 0017 y 0022) e indica que acciones cambiaron
 * de roles o de disponibilidad sin conexion. Dos documentos iguales con otro orden de claves o de espacios son iguales.
 */
export function comparePermissions(local: string, remote: string): ContractComparison {
  const mine = asRecord(parse(local, 'La copia local de la tabla de permisos'));
  const theirs = asRecord(parse(remote, 'La tabla de permisos del backend'));
  if (canonical(mine) === canonical(theirs)) return { same: true, differences: [] };

  const here = asRecord(mine['actions']);
  const there = asRecord(theirs['actions']);
  const differences: string[] = [];
  for (const name of Object.keys(there).sort()) {
    if (here[name] === undefined) differences.push(`El backend agregó la acción «${name}»`);
  }
  for (const name of Object.keys(here).sort()) {
    if (there[name] === undefined) differences.push(`El backend quitó la acción «${name}»`);
  }
  for (const name of Object.keys(here).sort()) {
    const mineAction = here[name];
    const theirAction = there[name];
    if (mineAction === undefined || theirAction === undefined) continue;
    if (rolesOf(mineAction) !== rolesOf(theirAction)) {
      differences.push(`La acción «${name}» cambió de roles`);
    }
    if (asRecord(mineAction)['offline'] !== asRecord(theirAction)['offline']) {
      differences.push(`La acción «${name}» cambió si funciona sin conexión`);
    }
  }
  if (canonical(mine['roles'] ?? null) !== canonical(theirs['roles'] ?? null)) {
    differences.push('La lista de roles cambió');
  }
  if (differences.length === 0) {
    differences.push('El contenido cambió sin que cambie ninguna acción ni la lista de roles');
  }
  return { same: false, differences };
}

const USAGE = [
  'Uso: node scripts/contract.ts <comando>',
  '  sync    copia el contrato, los vectores de cálculo y la tabla de permisos del backend a contract/ (npm run contract:sync)',
  '  check   comprueba que las copias coinciden con el backend (npm run contract:check)',
  'La rama del backend se elige con CONTRACT_REF (por omisión, desarrollo).',
].join('\n');

interface SharedFile {
  /** Como se nombra en los mensajes: «el contrato», «los vectores de cálculo». */
  label: string;
  /** Donde vive la copia en este repositorio. */
  local: string;
  /** Donde vive el original en el backend. */
  remote: string;
  compare: (local: string, remote: string) => ContractComparison;
  /** Las dos frases del mensaje: «coincide con» y «ya no coincide con». */
  verb: { same: string; different: string };
}

const SHARED_FILES: readonly SharedFile[] = [
  {
    label: 'el contrato',
    local: CONTRACT_PATH,
    remote: 'openapi.json',
    compare: compareContracts,
    verb: { same: 'coincide con el del', different: 'ya no coincide con el del' },
  },
  {
    label: 'los vectores de cálculo',
    local: VECTORS_PATH,
    remote: 'contract/calculation-vectors.json',
    compare: compareVectors,
    verb: { same: 'coinciden con los del', different: 'ya no coinciden con los del' },
  },
  {
    label: 'la tabla de permisos',
    local: PERMISSIONS_PATH,
    remote: 'contract/permissions.json',
    compare: comparePermissions,
    verb: { same: 'coincide con la del', different: 'ya no coincide con la del' },
  },
];

const capitalize = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Ejecuta un comando y devuelve el codigo de salida. Todo lo externo llega por `io`. */
export async function run(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: Io,
): Promise<number> {
  const command = args[0];
  if (command !== 'sync' && command !== 'check') {
    io.error(USAGE);
    return 2;
  }

  const ref = env['CONTRACT_REF']?.trim() || DEFAULT_REF;
  const token = env['GITHUB_TOKEN'];
  const deps = token === undefined ? { fetch: io.fetch } : { fetch: io.fetch, token };

  // Se piden todos antes de escribir o comparar nada: si falta uno, no se toca ninguno.
  const remotes: string[] = [];
  try {
    for (const file of SHARED_FILES) {
      remotes.push(await fetchBackendFile({ path: file.remote, label: file.label }, ref, deps));
    }
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (command === 'sync') {
    SHARED_FILES.forEach((file, index) => {
      io.writeFile(file.local, remotes[index] ?? '');
      io.log(`Copiado ${file.label} del backend (rama ${ref}) en ${file.local}.`);
    });
    return 0;
  }

  let failed = false;
  SHARED_FILES.forEach((file, index) => {
    let local: string;
    try {
      local = io.readFile(file.local);
    } catch {
      io.error(
        `No existe la copia local ${file.local}: ejecuta \`npm run contract:sync\` para crearla.`,
      );
      failed = true;
      return;
    }
    const result = file.compare(local, remotes[index] ?? '');
    if (result.same) {
      io.log(`${capitalize(file.label)} ${file.verb.same} backend (rama ${ref}).`);
      return;
    }
    failed = true;
    io.error(
      `${capitalize(file.label)} de ${file.local} ${file.verb.different} backend (rama ${ref}):`,
    );
    for (const line of result.differences) io.error(`  - ${line}`);
  });
  if (failed) {
    io.error(
      'Ejecuta `npm run contract:sync`, revisa la diferencia, adapta el código que la use y sube el resultado.',
    );
    return 1;
  }
  return 0;
}

const realIo: Io = {
  fetch: (input, init) => fetch(input, init),
  readFile: (path) => readFileSync(path, 'utf8'),
  writeFile: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  },
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

// Solo se ejecuta cuando es el archivo que se lanza, no cuando una prueba lo importa.
const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await run(process.argv.slice(2), process.env, realIo);
}
