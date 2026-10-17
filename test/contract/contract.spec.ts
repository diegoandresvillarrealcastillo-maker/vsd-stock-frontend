// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CONTRACT_PATH,
  compareContracts,
  contractUrl,
  fetchBackendContract,
  run,
  type Io,
} from '../../scripts/contract';

const CONTRACT = {
  openapi: '3.0.0',
  paths: {
    '/health': { get: { operationId: 'HealthController_check' } },
  },
  components: { schemas: { HealthReportDto: { type: 'object' } } },
};

function text(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

describe('contractUrl', () => {
  it('points at openapi.json in the backend repository, on the given branch, through the GitHub API', () => {
    expect(contractUrl('desarrollo')).toBe(
      'https://api.github.com/repos/diegoandresvillarrealcastillo-maker/vsd-stock-backend/contents/openapi.json?ref=desarrollo',
    );
  });

  it('encodes a branch name that has a slash', () => {
    expect(contractUrl('feat/c0-11-cors')).toContain('?ref=feat%2Fc0-11-cors');
  });
});

describe('compareContracts', () => {
  it('treats the same document as equal even when whitespace and line endings differ', () => {
    const compact = JSON.stringify(CONTRACT);
    const windows = text(CONTRACT).replaceAll('\n', '\r\n');

    expect(compareContracts(compact, windows)).toEqual({ same: true, differences: [] });
  });

  it('treats the same document as equal when its keys come in another order', () => {
    const reordered = {
      components: CONTRACT.components,
      paths: CONTRACT.paths,
      openapi: CONTRACT.openapi,
    };

    expect(compareContracts(text(CONTRACT), text(reordered)).same).toBe(true);
  });

  it('reports a new operation of the backend by its method and path', () => {
    const backend = {
      ...CONTRACT,
      paths: { ...CONTRACT.paths, '/products': { get: {}, post: {} } },
    };

    const result = compareContracts(text(CONTRACT), text(backend));

    expect(result.same).toBe(false);
    expect(result.differences).toContain('El backend agregó GET /products');
    expect(result.differences).toContain('El backend agregó POST /products');
  });

  it('reports an operation that the backend no longer has', () => {
    const backend = { ...CONTRACT, paths: {} };

    const result = compareContracts(text(CONTRACT), text(backend));

    expect(result.differences).toContain('El backend quitó GET /health');
  });

  it('reports added and removed schemas by name', () => {
    const backend = {
      ...CONTRACT,
      components: { schemas: { ProductDto: { type: 'object' } } },
    };

    const result = compareContracts(text(CONTRACT), text(backend));

    expect(result.differences).toContain('El backend agregó el esquema ProductDto');
    expect(result.differences).toContain('El backend quitó el esquema HealthReportDto');
  });

  it('still reports a change that is not an operation or a schema name', () => {
    const backend = {
      ...CONTRACT,
      components: { schemas: { HealthReportDto: { type: 'object', required: ['status'] } } },
    };

    const result = compareContracts(text(CONTRACT), text(backend));

    expect(result.same).toBe(false);
    expect(result.differences).toEqual([
      'El contenido cambió (un campo, un tipo o una descripción) sin que cambie la lista de operaciones ni de esquemas',
    ]);
  });

  it('says which side is broken when a document is not JSON', () => {
    expect(() => compareContracts('<html>', text(CONTRACT))).toThrow(/copia local/);
    expect(() => compareContracts(text(CONTRACT), '<html>')).toThrow(/backend/);
  });
});

describe('fetchBackendContract', () => {
  function fakeFetch(answer: Response | Error) {
    const requests: { url: string; headers: Headers }[] = [];
    const fetch = (input: string, init?: RequestInit) => {
      requests.push({ url: input, headers: new Headers(init?.headers) });
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    };
    return { fetch, requests };
  }

  it('asks the GitHub API for the raw file and returns it as text', async () => {
    const { fetch, requests } = fakeFetch(new Response(text(CONTRACT)));

    const body = await fetchBackendContract('desarrollo', { fetch });

    expect(body).toBe(text(CONTRACT));
    expect(requests[0]?.url).toBe(contractUrl('desarrollo'));
    expect(requests[0]?.headers.get('accept')).toBe('application/vnd.github.raw+json');
  });

  it('sends the token when there is one and nothing when there is not', async () => {
    const withToken = fakeFetch(new Response(text(CONTRACT)));
    const withoutToken = fakeFetch(new Response(text(CONTRACT)));

    await fetchBackendContract('desarrollo', { fetch: withToken.fetch, token: 'abc' });
    await fetchBackendContract('desarrollo', { fetch: withoutToken.fetch });

    expect(withToken.requests[0]?.headers.get('authorization')).toBe('Bearer abc');
    expect(withoutToken.requests[0]?.headers.get('authorization')).toBeNull();
  });

  it('names the branch and the status when GitHub answers an error', async () => {
    const { fetch } = fakeFetch(new Response('Not Found', { status: 404 }));

    await expect(fetchBackendContract('no-existe', { fetch })).rejects.toThrow(
      /no-existe.*404|404.*no-existe/,
    );
  });

  it('explains that the comparison could not be made when there is no network', async () => {
    const { fetch } = fakeFetch(new TypeError('fetch failed'));

    await expect(fetchBackendContract('desarrollo', { fetch })).rejects.toThrow(
      /No se pudo consultar/,
    );
  });
});

describe('run', () => {
  function fakeIo(files: Record<string, string>, remote: Response | Error) {
    const logs: string[] = [];
    const errors: string[] = [];
    const written: Record<string, string> = {};
    const io: Io = {
      fetch: () => (remote instanceof Error ? Promise.reject(remote) : Promise.resolve(remote)),
      readFile: (path) => {
        const content = files[path];
        if (content === undefined) throw new Error(`no existe ${path}`);
        return content;
      },
      writeFile: (path, content) => {
        written[path] = content;
      },
      log: (line) => logs.push(line),
      error: (line) => errors.push(line),
    };
    return { io, logs, errors, written };
  }

  it('check passes when the local copy is the contract of the backend', async () => {
    const { io, logs } = fakeIo({ [CONTRACT_PATH]: text(CONTRACT) }, new Response(text(CONTRACT)));

    const code = await run(['check'], { CONTRACT_REF: 'preproduccion' }, io);

    expect(code).toBe(0);
    expect(logs.join('\n')).toContain('preproduccion');
  });

  it('check fails, lists what changed and says how to fix it', async () => {
    const backend = { ...CONTRACT, paths: { ...CONTRACT.paths, '/products': { get: {} } } };
    const { io, errors } = fakeIo({ [CONTRACT_PATH]: text(CONTRACT) }, new Response(text(backend)));

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('El backend agregó GET /products');
    expect(errors.join('\n')).toContain('npm run contract:sync');
  });

  it('check fails when it cannot reach the backend: an unverified contract is not a verified one', async () => {
    const { io, errors } = fakeIo({ [CONTRACT_PATH]: text(CONTRACT) }, new TypeError('offline'));

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('No se pudo consultar');
  });

  it('sync writes the contract of the backend exactly as it is', async () => {
    const backend = text({ ...CONTRACT, info: { title: 'VSD Stock API' } });
    const { io, written } = fakeIo({}, new Response(backend));

    const code = await run(['sync'], {}, io);

    expect(code).toBe(0);
    expect(written[CONTRACT_PATH]).toBe(backend);
  });

  it('sync does not write anything when the backend does not answer', async () => {
    const { io, written } = fakeIo({}, new Response('Not Found', { status: 404 }));

    const code = await run(['sync'], {}, io);

    expect(code).toBe(1);
    expect(written).toEqual({});
  });

  it('uses desarrollo when CONTRACT_REF is not set and passes the token along', async () => {
    const urls: string[] = [];
    const tokens: (string | null)[] = [];
    const { io } = fakeIo({ [CONTRACT_PATH]: text(CONTRACT) }, new Response(text(CONTRACT)));
    io.fetch = (input, init) => {
      urls.push(input);
      tokens.push(new Headers(init?.headers).get('authorization'));
      return Promise.resolve(new Response(text(CONTRACT)));
    };

    await run(['check'], { GITHUB_TOKEN: 'secreto' }, io);

    expect(urls[0]).toBe(contractUrl('desarrollo'));
    expect(tokens[0]).toBe('Bearer secreto');
  });

  it.each([[[]], [['otra-cosa']]])(
    'prints the usage and fails for the command %j',
    async (args) => {
      const { io, errors } = fakeIo({}, new Response(''));

      const code = await run(args, {}, io);

      expect(code).toBe(2);
      expect(errors.join('\n')).toContain('contract:sync');
    },
  );
});
