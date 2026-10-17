// @vitest-environment node
import { readFileSync } from 'node:fs';
import openapiTS, { astToString } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';

const CONTRACT = new URL('../../contract/openapi.json', import.meta.url);
const SCHEMA = new URL('../../src/adapters/out/api/schema.d.ts', import.meta.url);

// openapi-typescript antepone un comentario de "archivo generado" que no forma
// parte de los tipos; se quita para comparar solo lo que importa.
function withoutBanner(source: string): string {
  return source.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '');
}

describe('generated API types', () => {
  it('are exactly what openapi-typescript generates from contract/openapi.json', async () => {
    const generated = astToString(await openapiTS(CONTRACT));

    const committed = withoutBanner(readFileSync(SCHEMA, 'utf8'));

    expect(
      committed,
      'schema.d.ts no coincide con contract/openapi.json: ejecuta `npm run contract:generate` y sube el resultado',
    ).toBe(generated);
  });

  it('describe GET /health with the fields the backend declares', () => {
    const source = readFileSync(SCHEMA, 'utf8');

    expect(source).toContain('"/health"');
    expect(source).toContain('status: "ok"');
    expect(source).toContain('timestamp: string');
  });
});
