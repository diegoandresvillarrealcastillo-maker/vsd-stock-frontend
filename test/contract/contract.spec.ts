// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  CONTRACT_PATH,
  PERMISSIONS_PATH,
  VECTORS_PATH,
  backendFileUrl,
  compareContracts,
  comparePermissions,
  compareVectors,
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

const VECTORS = {
  version: 1,
  currency: 'COP',
  breakdown: [{ total: 1000, rateBp: 1900, base: 840, tax: 160 }],
  gross: [{ unitPrice: 2500, quantityMilli: 1500, total: 3750 }],
};

const PERMISSIONS = {
  version: 1,
  roles: ['owner', 'admin', 'cashier'],
  actions: {
    'sale:create': { roles: ['owner', 'admin', 'cashier'], offline: true },
    'product:manage': { roles: ['owner', 'admin'], offline: false },
  },
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

describe('backendFileUrl', () => {
  it('points at any file of the backend repository, on the given branch, through the GitHub API', () => {
    expect(backendFileUrl('contract/calculation-vectors.json', 'desarrollo')).toBe(
      'https://api.github.com/repos/diegoandresvillarrealcastillo-maker/vsd-stock-backend/contents/contract/calculation-vectors.json?ref=desarrollo',
    );
  });

  it('keeps contractUrl as the address of openapi.json', () => {
    expect(contractUrl('desarrollo')).toBe(backendFileUrl('openapi.json', 'desarrollo'));
  });

  it('encodes a branch name that has a slash', () => {
    expect(backendFileUrl('openapi.json', 'feat/c1-02-dinero')).toContain(
      '?ref=feat%2Fc1-02-dinero',
    );
  });
});

describe('compareVectors', () => {
  it('treats identical vectors as equal even when whitespace and line endings differ', () => {
    const windows = text(VECTORS).replaceAll('\n', '\r\n');

    expect(compareVectors(JSON.stringify(VECTORS), windows)).toEqual({
      same: true,
      differences: [],
    });
  });

  it('treats identical vectors as equal when their keys come in another order', () => {
    const reordered = {
      gross: [{ total: 3750, quantityMilli: 1500, unitPrice: 2500 }],
      currency: VECTORS.currency,
      version: VECTORS.version,
      breakdown: [{ tax: 160, base: 840, rateBp: 1900, total: 1000 }],
    };

    expect(compareVectors(text(VECTORS), text(reordered)).same).toBe(true);
  });

  it('names the sections that changed and how many cases each one has on each side', () => {
    const backend = {
      ...VECTORS,
      breakdown: [...VECTORS.breakdown, { total: 119, rateBp: 1900, base: 100, tax: 19 }],
    };

    const result = compareVectors(text(VECTORS), text(backend));

    expect(result.same).toBe(false);
    expect(result.differences).toEqual(['La sección «breakdown» cambió: 1 aquí y 2 en el backend']);
  });

  it('reports a changed value inside a section that keeps its size', () => {
    const backend = { ...VECTORS, gross: [{ unitPrice: 2500, quantityMilli: 1500, total: 3751 }] };

    const result = compareVectors(text(VECTORS), text(backend));

    expect(result.differences).toEqual(['La sección «gross» cambió']);
  });

  it('reports a section that only one side has', () => {
    const backend = { ...VECTORS, percent: [] };

    const result = compareVectors(text(VECTORS), text(backend));

    expect(result.differences).toEqual(['La sección «percent» solo existe en el backend']);
  });

  it('says which side is broken when a document is not JSON', () => {
    expect(() => compareVectors('<html>', text(VECTORS))).toThrow(/copia local/);
    expect(() => compareVectors(text(VECTORS), '<html>')).toThrow(/backend/);
  });
});

describe('comparePermissions', () => {
  it('treats identical tables as equal even when whitespace and key order differ', () => {
    const reordered = {
      actions: {
        'product:manage': PERMISSIONS.actions['product:manage'],
        'sale:create': PERMISSIONS.actions['sale:create'],
      },
      roles: PERMISSIONS.roles,
      version: 1,
    };

    expect(comparePermissions(text(PERMISSIONS), JSON.stringify(reordered))).toEqual({
      same: true,
      differences: [],
    });
  });

  it('names an action that only the backend has, and one that only this copy has', () => {
    const backend = {
      ...PERMISSIONS,
      actions: {
        ...PERMISSIONS.actions,
        'report:sales': { roles: ['owner', 'admin'], offline: false },
      },
    };
    const { 'sale:create': _removed, ...withoutSale } = backend.actions;

    expect(comparePermissions(text(PERMISSIONS), text(backend)).differences).toEqual([
      'El backend agregó la acción «report:sales»',
    ]);
    expect(
      comparePermissions(text(PERMISSIONS), text({ ...backend, actions: withoutSale })).differences,
    ).toEqual([
      'El backend agregó la acción «report:sales»',
      'El backend quitó la acción «sale:create»',
    ]);
  });

  it('names the action whose roles or offline flag changed', () => {
    const roles = {
      ...PERMISSIONS,
      actions: { ...PERMISSIONS.actions, 'product:manage': { roles: ['owner'], offline: false } },
    };
    const offline = {
      ...PERMISSIONS,
      actions: {
        ...PERMISSIONS.actions,
        'sale:create': { roles: ['owner', 'admin', 'cashier'], offline: false },
      },
    };

    expect(comparePermissions(text(PERMISSIONS), text(roles)).differences).toEqual([
      'La acción «product:manage» cambió de roles',
    ]);
    expect(comparePermissions(text(PERMISSIONS), text(offline)).differences).toEqual([
      'La acción «sale:create» cambió si funciona sin conexión',
    ]);
  });

  it('reports a change in the list of roles', () => {
    const backend = { ...PERMISSIONS, roles: ['owner', 'cashier'] };

    expect(comparePermissions(text(PERMISSIONS), text(backend)).differences).toEqual([
      'La lista de roles cambió',
    ]);
  });

  it('still reports a change that is not an action or the roles', () => {
    const backend = { ...PERMISSIONS, version: 2 };

    const result = comparePermissions(text(PERMISSIONS), text(backend));

    expect(result.same).toBe(false);
    expect(result.differences).toEqual([
      'El contenido cambió sin que cambie ninguna acción ni la lista de roles',
    ]);
  });

  it('says which side is broken when a document is not JSON', () => {
    expect(() => comparePermissions('no es json', text(PERMISSIONS))).toThrow('La copia local');
    expect(() => comparePermissions(text(PERMISSIONS), 'no es json')).toThrow('del backend');
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
  type Answer = Response | Error;
  interface Backend {
    openapi: Answer;
    vectors: Answer;
    permissions: Answer;
  }

  // Cada archivo del backend tiene su propia respuesta; una Response solo se lee una vez, por eso se clona.
  function fakeIo(files: Record<string, string>, backend: Backend) {
    const logs: string[] = [];
    const errors: string[] = [];
    const written: Record<string, string> = {};
    const urls: string[] = [];
    const answer = (value: Answer) =>
      value instanceof Error ? Promise.reject(value) : Promise.resolve(value.clone());
    const io: Io = {
      fetch: (input) => {
        urls.push(input);
        if (input.includes('/contents/openapi.json')) return answer(backend.openapi);
        if (input.includes('/contents/contract/permissions.json'))
          return answer(backend.permissions);
        return answer(backend.vectors);
      },
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
    return { io, logs, errors, written, urls };
  }

  const bothLocal = {
    [CONTRACT_PATH]: text(CONTRACT),
    [VECTORS_PATH]: text(VECTORS),
    [PERMISSIONS_PATH]: text(PERMISSIONS),
  };
  const bothRemote = (): Backend => ({
    openapi: new Response(text(CONTRACT)),
    vectors: new Response(text(VECTORS)),
    permissions: new Response(text(PERMISSIONS)),
  });

  it('check passes when every local copy is the one of the backend', async () => {
    const { io, logs } = fakeIo(bothLocal, bothRemote());

    const code = await run(['check'], { CONTRACT_REF: 'preproduccion' }, io);

    expect(code).toBe(0);
    expect(logs.join('\n')).toContain('preproduccion');
    expect(logs.join('\n')).toContain('vectores');
    expect(logs.join('\n')).toContain('permisos');
  });

  it('check asks the backend for every file on the same branch', async () => {
    const { io, urls } = fakeIo(bothLocal, bothRemote());

    await run(['check'], { CONTRACT_REF: 'preproduccion' }, io);

    expect(urls.sort()).toEqual(
      [
        contractUrl('preproduccion'),
        backendFileUrl('contract/calculation-vectors.json', 'preproduccion'),
        backendFileUrl('contract/permissions.json', 'preproduccion'),
      ].sort(),
    );
  });

  it('check fails, lists what changed and says how to fix it', async () => {
    const backend = { ...CONTRACT, paths: { ...CONTRACT.paths, '/products': { get: {} } } };
    const { io, errors } = fakeIo(bothLocal, {
      ...bothRemote(),
      openapi: new Response(text(backend)),
    });

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('El backend agregó GET /products');
    expect(errors.join('\n')).toContain('npm run contract:sync');
  });

  it('check fails when the calculation vectors of the backend changed, and names the section', async () => {
    const backend = { ...VECTORS, gross: [] };
    const { io, errors } = fakeIo(bothLocal, {
      ...bothRemote(),
      vectors: new Response(text(backend)),
    });

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('vectores de cálculo');
    expect(errors.join('\n')).toContain('La sección «gross» cambió');
    expect(errors.join('\n')).toContain('npm run contract:sync');
  });

  it('check reports both files when both changed', async () => {
    const backendContract = { ...CONTRACT, paths: {} };
    const backendVectors = { ...VECTORS, gross: [] };
    const { io, errors } = fakeIo(bothLocal, {
      ...bothRemote(),
      openapi: new Response(text(backendContract)),
      vectors: new Response(text(backendVectors)),
    });

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('El backend quitó GET /health');
    expect(errors.join('\n')).toContain('La sección «gross» cambió');
  });

  it('check fails when the permission table of the backend changed, and names the action', async () => {
    const backend = {
      ...PERMISSIONS,
      actions: { ...PERMISSIONS.actions, 'product:manage': { roles: ['owner'], offline: false } },
    };
    const { io, errors } = fakeIo(bothLocal, {
      ...bothRemote(),
      permissions: new Response(text(backend)),
    });

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('tabla de permisos');
    expect(errors.join('\n')).toContain('La acción «product:manage» cambió de roles');
    expect(errors.join('\n')).toContain('npm run contract:sync');
  });

  it('check fails and names the file when the backend branch does not have the permissions yet', async () => {
    const { io, errors } = fakeIo(bothLocal, {
      ...bothRemote(),
      permissions: new Response('Not Found', { status: 404 }),
    });

    const code = await run(['check'], { CONTRACT_REF: 'desarrollo' }, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('permissions.json');
    expect(errors.join('\n')).toContain('404');
  });

  it('check fails and names the file when the backend branch does not have the vectors yet', async () => {
    const { io, errors } = fakeIo(bothLocal, {
      ...bothRemote(),
      vectors: new Response('Not Found', { status: 404 }),
    });

    const code = await run(['check'], { CONTRACT_REF: 'desarrollo' }, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('calculation-vectors.json');
    expect(errors.join('\n')).toContain('404');
    expect(errors.join('\n')).toContain('desarrollo');
  });

  it('check fails when it cannot reach the backend: an unverified contract is not a verified one', async () => {
    const { io, errors } = fakeIo(bothLocal, {
      openapi: new TypeError('offline'),
      vectors: new TypeError('offline'),
      permissions: new TypeError('offline'),
    });

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain('No se pudo consultar');
  });

  it('check fails and says how to create the copy when a local file does not exist', async () => {
    const { io, errors } = fakeIo({ [CONTRACT_PATH]: text(CONTRACT) }, bothRemote());

    const code = await run(['check'], {}, io);

    expect(code).toBe(1);
    expect(errors.join('\n')).toContain(VECTORS_PATH);
    expect(errors.join('\n')).toContain('npm run contract:sync');
  });

  it('sync writes every file of the backend exactly as they are', async () => {
    const openapi = text({ ...CONTRACT, info: { title: 'VSD Stock API' } });
    const vectors = text({ ...VECTORS, version: 2 });
    const permissions = text({ ...PERMISSIONS, version: 2 });
    const { io, written } = fakeIo(
      {},
      {
        openapi: new Response(openapi),
        vectors: new Response(vectors),
        permissions: new Response(permissions),
      },
    );

    const code = await run(['sync'], {}, io);

    expect(code).toBe(0);
    expect(written[CONTRACT_PATH]).toBe(openapi);
    expect(written[VECTORS_PATH]).toBe(vectors);
    expect(written[PERMISSIONS_PATH]).toBe(permissions);
  });

  it('sync does not write anything when the backend does not answer', async () => {
    const { io, written } = fakeIo(
      {},
      {
        openapi: new Response('Not Found', { status: 404 }),
        vectors: new Response('Not Found', { status: 404 }),
        permissions: new Response('Not Found', { status: 404 }),
      },
    );

    const code = await run(['sync'], {}, io);

    expect(code).toBe(1);
    expect(written).toEqual({});
  });

  it('sync does not write anything either when only the permissions are missing in the backend', async () => {
    const { io, written } = fakeIo(
      {},
      { ...bothRemote(), permissions: new Response('Not Found', { status: 404 }) },
    );

    const code = await run(['sync'], {}, io);

    expect(code).toBe(1);
    expect(written).toEqual({});
  });

  it('sync does not write the contract either when only the vectors are missing in the backend', async () => {
    const { io, written } = fakeIo(
      {},
      { ...bothRemote(), vectors: new Response('Not Found', { status: 404 }) },
    );

    const code = await run(['sync'], {}, io);

    expect(code).toBe(1);
    expect(written).toEqual({});
  });

  it('uses desarrollo when CONTRACT_REF is not set and passes the token along', async () => {
    const { io, urls } = fakeIo(bothLocal, bothRemote());
    const tokens: (string | null)[] = [];
    const original = io.fetch;
    io.fetch = (input, init) => {
      tokens.push(new Headers(init?.headers).get('authorization'));
      return original(input, init);
    };

    await run(['check'], { GITHUB_TOKEN: 'secreto' }, io);

    expect(urls).toContain(contractUrl('desarrollo'));
    expect(tokens).toEqual(['Bearer secreto', 'Bearer secreto', 'Bearer secreto']);
  });

  it.each([[[]], [['otra-cosa']]])(
    'prints the usage and fails for the command %j',
    async (args) => {
      const { io, errors } = fakeIo({}, bothRemote());

      const code = await run(args, {}, io);

      expect(code).toBe(2);
      expect(errors.join('\n')).toContain('contract:sync');
    },
  );
});
