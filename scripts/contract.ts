// Herramienta de linea de comandos que mantiene al dia la copia del contrato
// OpenAPI del backend (ADR 0001). Corre directamente en Node 24, que ejecuta
// TypeScript quitando los tipos: por eso este archivo no usa sintaxis que
// necesite compilarse (enums, propiedades de parametro) ni importa otros
// archivos del proyecto.
//
//   node scripts/contract.ts sync    copia el contrato del backend a contract/openapi.json
//   node scripts/contract.ts check   falla si esa copia ya no coincide con el backend
//
// La rama del backend se elige con CONTRACT_REF (por omision, desarrollo). Si
// hay GITHUB_TOKEN se envia, para no depender del limite de consultas anonimas.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BACKEND_REPOSITORY = 'diegoandresvillarrealcastillo-maker/vsd-stock-backend';
export const CONTRACT_PATH = 'contract/openapi.json';
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

/** Direccion del contrato en la rama pedida del backend, por la API de GitHub (sin cache de CDN). */
export function contractUrl(ref: string): string {
  return `https://api.github.com/repos/${BACKEND_REPOSITORY}/contents/openapi.json?ref=${encodeURIComponent(ref)}`;
}

/** Pide el contrato al backend. Falla con un mensaje que dice que rama y que respondio GitHub. */
export async function fetchBackendContract(
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
    response = await fetch(contractUrl(ref), { headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo consultar el contrato del backend (rama ${ref}): ${reason}`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new Error(
      `GitHub respondió ${response.status} al pedir el contrato del backend en la rama ${ref}`,
    );
  }
  return response.text();
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

const USAGE = [
  'Uso: node scripts/contract.ts <comando>',
  '  sync    copia el contrato del backend a contract/openapi.json (npm run contract:sync)',
  '  check   comprueba que la copia coincide con el backend (npm run contract:check)',
  'La rama del backend se elige con CONTRACT_REF (por omisión, desarrollo).',
].join('\n');

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
  let remote: string;
  try {
    remote = await fetchBackendContract(
      ref,
      token === undefined ? { fetch: io.fetch } : { fetch: io.fetch, token },
    );
  } catch (error) {
    io.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (command === 'sync') {
    io.writeFile(CONTRACT_PATH, remote);
    io.log(`Copiado el contrato del backend (rama ${ref}) en ${CONTRACT_PATH}.`);
    return 0;
  }

  const result = compareContracts(io.readFile(CONTRACT_PATH), remote);
  if (result.same) {
    io.log(`El contrato coincide con el del backend (rama ${ref}).`);
    return 0;
  }
  io.error(`El contrato de ${CONTRACT_PATH} ya no coincide con el del backend (rama ${ref}):`);
  for (const line of result.differences) io.error(`  - ${line}`);
  io.error(
    'Ejecuta `npm run contract:sync`, revisa la diferencia, adapta el código que la use y sube el resultado.',
  );
  return 1;
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
