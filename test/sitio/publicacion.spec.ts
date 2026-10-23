// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CARPETA_DEL_SITIO,
  PROYECTO_DEL_SITIO,
  RAMA_DE_PRODUCCION,
  argumentosDeWrangler,
  decidirPublicacion,
  leerEstadoDeGit,
  planear,
  type EstadoDeGit,
  type Modo,
} from '../../scripts/publicar-sitio';
import { PENDIENTES_DE_PUBLICAR } from '../../sitio/pagina/contenido';

// La landing se publica en su propio proyecto de Cloudflare Pages (C4-L8, ADR 0033 del backend), con un comando que se puede repetir. Aqui
// se vigila lo que lo hace seguro: una vista previa nunca puede ser la direccion publica, y la direccion publica solo sale de `desarrollo`
// ya fusionado, sin cambios sueltos y con nada pendiente por resolver.
const ROOT = resolve(import.meta.dirname, '../..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

/** Un estado en el que todo esta en orden para publicar en produccion; cada prueba lo estropea de a una cosa. */
const enOrden = {
  modo: 'produccion',
  rama: 'desarrollo',
  sinConfirmar: false,
  alDiaConOrigen: true,
  pendientes: [] as readonly string[],
} as const;

describe('where the landing is published', () => {
  it('is its own Cloudflare Pages project, with the production branch of the repository and the folder that the build leaves', () => {
    expect(PROYECTO_DEL_SITIO).toBe('vsd-stock-sitio');
    expect(RAMA_DE_PRODUCCION).toBe('desarrollo');
    expect(CARPETA_DEL_SITIO).toBe('sitio/dist');
  });

  it('is a project other than the one of the app of PRE, so that publishing one never touches the other', () => {
    expect(PROYECTO_DEL_SITIO).not.toBe('vsd-stock-pre');
  });
});

describe('a preview', () => {
  it('can be published from any branch but the production one, with changes on the way and things pending', () => {
    const decision = decidirPublicacion({
      modo: 'vista-previa',
      rama: 'feat/c4-l8-publicacion',
      sinConfirmar: true,
      alDiaConOrigen: false,
      pendientes: ['Leer el texto en voz alta (Diego)'],
    });

    expect(decision).toEqual({
      permitida: true,
      razones: [],
      ramaEnCloudflare: 'feat/c4-l8-publicacion',
    });
  });

  it('is refused from the production branch: a preview must never be the public address', () => {
    const decision = decidirPublicacion({ ...enOrden, modo: 'vista-previa' });

    expect(decision.permitida).toBe(false);
    expect(decision.razones.join(' ')).toContain('--produccion');
  });

  it('is refused without a branch, because Cloudflare needs one to name the preview', () => {
    const decision = decidirPublicacion({ ...enOrden, modo: 'vista-previa', rama: '' });

    expect(decision.permitida).toBe(false);
    expect(decision.razones.join(' ')).toMatch(/sin rama|no hay rama/i);
  });

  it.each([
    'una rama',
    'a;b',
    'a&b',
    'a|b',
    '$(x)',
    '`x`',
    "a'b",
    'a"b',
    '--help',
    '-rf',
    '../x',
    'feat/ñandú',
    'a\nb',
  ])(
    'is refused with the branch name %j, which a shell or the command could read as something else',
    (rama) => {
      const decision = decidirPublicacion({ ...enOrden, modo: 'vista-previa', rama });

      expect(decision.permitida).toBe(false);
    },
  );

  it.each(['feat/c4-l8-publicacion', 'fix/c4-algo.2', 'docs/c4_l8', 'x'])(
    'is accepted with the branch name %s',
    (rama) => {
      expect(decidirPublicacion({ ...enOrden, modo: 'vista-previa', rama }).permitida).toBe(true);
    },
  );
});

describe('the public address', () => {
  it('is published from desarrollo, with nothing loose, at the same commit as origin and nothing pending', () => {
    expect(decidirPublicacion(enOrden)).toEqual({
      permitida: true,
      razones: [],
      ramaEnCloudflare: 'desarrollo',
    });
  });

  it('is refused from any other branch, because only what was merged goes out', () => {
    const decision = decidirPublicacion({ ...enOrden, rama: 'feat/c4-l8-publicacion' });

    expect(decision.permitida).toBe(false);
    expect(decision.razones.join(' ')).toContain('desarrollo');
  });

  it('is refused with changes that were not committed: what goes out must be what is in the repository', () => {
    const decision = decidirPublicacion({ ...enOrden, sinConfirmar: true });

    expect(decision.permitida).toBe(false);
    expect(decision.razones.join(' ')).toMatch(/sin confirmar/i);
  });

  it('is refused when desarrollo is not at the same commit as origin/desarrollo, behind or ahead', () => {
    const decision = decidirPublicacion({ ...enOrden, alDiaConOrigen: false });

    expect(decision.permitida).toBe(false);
    expect(decision.razones.join(' ')).toContain('origin/desarrollo');
  });

  it('is refused while something is pending, and says what and who', () => {
    const decision = decidirPublicacion({
      ...enOrden,
      pendientes: ['Leer el texto en voz alta (Diego)', 'La prueba en un Android real (Samuel)'],
    });

    expect(decision.permitida).toBe(false);
    const dicho = decision.razones.join('\n');
    expect(dicho).toContain('Pendiente: Leer el texto en voz alta (Diego)');
    expect(dicho).toContain('Pendiente: La prueba en un Android real (Samuel)');
  });

  it('lists every reason at once, so that nobody fixes one and finds out the next one later', () => {
    const decision = decidirPublicacion({
      modo: 'produccion',
      rama: 'otra',
      sinConfirmar: true,
      alDiaConOrigen: false,
      pendientes: ['Algo (Diego)'],
    });

    expect(decision.permitida).toBe(false);
    expect(decision.razones).toHaveLength(4);
  });

  it('always goes to the production branch of the project, whatever the local branch is', () => {
    expect(decidirPublicacion({ ...enOrden, rama: 'otra' }).ramaEnCloudflare).toBe('desarrollo');
  });

  it('does not accept a mode that it does not know', () => {
    expect(() => decidirPublicacion({ ...enOrden, modo: 'prueba' as never })).toThrow(/modo/i);
  });
});

describe('the command for Cloudflare', () => {
  it('deploys the folder of the site as a Pages project, never as a Worker', () => {
    const args = argumentosDeWrangler({ rama: 'feat/x', produccion: false });

    expect(args).toEqual([
      '--yes',
      'wrangler@4',
      'pages',
      'deploy',
      'sitio/dist',
      '--project-name',
      'vsd-stock-sitio',
      '--branch',
      'feat/x',
      '--commit-dirty=true',
    ]);
    expect(args).not.toContain('--production');
  });

  it('publishes the public address from the production branch and without accepting loose changes', () => {
    const args = argumentosDeWrangler({ rama: 'desarrollo', produccion: true });

    expect(args).toEqual([
      '--yes',
      'wrangler@4',
      'pages',
      'deploy',
      'sitio/dist',
      '--project-name',
      'vsd-stock-sitio',
      '--branch',
      'desarrollo',
    ]);
  });

  it('pins the major version of Wrangler, so that a new one does not change how it behaves without anyone noticing', () => {
    expect(argumentosDeWrangler({ rama: 'x', produccion: false })).toContain('wrangler@4');
  });

  it.each(['', 'a b', 'a;b', '$(x)', '-x'])(
    'refuses to build the command with the branch %j',
    (rama) => {
      expect(() => argumentosDeWrangler({ rama, produccion: false })).toThrow(/rama/i);
    },
  );

  it('refuses a production publication from a branch that is not desarrollo', () => {
    expect(() => argumentosDeWrangler({ rama: 'feat/x', produccion: true })).toThrow(/desarrollo/);
  });

  it('refuses a preview from desarrollo: Cloudflare takes the production branch of the project as the public address', () => {
    expect(() => argumentosDeWrangler({ rama: 'desarrollo', produccion: false })).toThrow(
      /producci[oó]n/,
    );
  });
});

describe('the plan of the command: what it does with what it was asked and with what it finds', () => {
  const enOrdenGit: EstadoDeGit = { rama: 'desarrollo', sinConfirmar: false, alDiaConOrigen: true };

  /** Planea con un estado de git inventado y deja anotado para que modo se pidio leerlo. */
  function planeado(
    argumentos: string[],
    estado: EstadoDeGit = enOrdenGit,
    pendientes: readonly string[] = [],
  ) {
    const modos: Modo[] = [];
    const plan = planear(
      argumentos,
      (modo) => {
        modos.push(modo);
        return estado;
      },
      pendientes,
    );
    return { plan, modos, dicho: plan.mensajes.join('\n') };
  }

  it.each([[[]], [['--simular']], [['--produccion', '--vista-previa']]])(
    'asks for exactly one mode: %j is a wrong request, with the usage and without reading git',
    (argumentos) => {
      const { plan, modos, dicho } = planeado(argumentos);

      expect(plan.salida).toBe(2);
      expect(plan.comando).toBeNull();
      expect(dicho).toContain('Uso:');
      expect(modos).toEqual([]);
    },
  );

  it('reads the state of git for the mode that was asked, and only that one', () => {
    expect(planeado(['--produccion']).modos).toEqual(['produccion']);
    expect(planeado(['--vista-previa'], { ...enOrdenGit, rama: 'feat/x' }).modos).toEqual([
      'vista-previa',
    ]);
  });

  it('goes out to the public address when everything is in order, with the command of production', () => {
    const { plan, dicho } = planeado(['--produccion']);

    expect(plan.salida).toBe(0);
    expect(plan.simulacion).toBe(false);
    expect(plan.comando).toEqual(argumentosDeWrangler({ rama: 'desarrollo', produccion: true }));
    expect(dicho).not.toMatch(/aviso/i);
  });

  it('refuses the public address while something is pending, says what, and does not give a command', () => {
    const { plan, dicho } = planeado(['--produccion'], enOrdenGit, ['Algo por resolver (Diego)']);

    expect(plan.salida).toBe(1);
    expect(plan.comando).toBeNull();
    expect(dicho).toContain('No se publica (produccion)');
    expect(dicho).toContain('Algo por resolver (Diego)');
  });

  it('refuses with --simular too: a simulation never says that something that is refused could go out', () => {
    const { plan, dicho } = planeado(['--produccion', '--simular'], {
      ...enOrdenGit,
      sinConfirmar: true,
    });

    expect(plan.salida).toBe(1);
    expect(plan.comando).toBeNull();
    expect(dicho).not.toContain('Se podria publicar');
  });

  it('lets a preview go out from a branch of work, with the command of a preview', () => {
    const { plan } = planeado(['--vista-previa'], { ...enOrdenGit, rama: 'feat/x' });

    expect(plan.salida).toBe(0);
    expect(plan.comando).toEqual(argumentosDeWrangler({ rama: 'feat/x', produccion: false }));
  });

  it('warns on a preview that there are pending things, with how many, and does not warn when there are none', () => {
    const rama = { ...enOrdenGit, rama: 'feat/x' };

    expect(planeado(['--vista-previa'], rama, ['Uno (Diego)', 'Dos (Samuel)']).dicho).toMatch(
      /aviso.*2 pendiente/i,
    );
    expect(planeado(['--vista-previa'], rama).dicho).not.toMatch(/aviso/i);
  });

  it('refuses a preview from desarrollo, because it would be the public address', () => {
    const { plan } = planeado(['--vista-previa']);

    expect(plan.salida).toBe(1);
    expect(plan.comando).toBeNull();
  });

  it('with --simular it says that it could be published and gives the command, and marks the plan as a simulation', () => {
    const { plan, dicho } = planeado(['--produccion', '--simular']);

    expect(plan.salida).toBe(0);
    expect(plan.simulacion).toBe(true);
    expect(dicho).toContain('Se podria publicar (produccion)');
    expect(dicho).toContain('npm run build:sitio');
    expect(dicho).toContain('npx --yes wrangler@4 pages deploy sitio/dist');
  });

  it('without --simular it is not a simulation and says nothing of the command, which the script launches itself', () => {
    const { plan, dicho } = planeado(['--produccion']);

    expect(plan.simulacion).toBe(false);
    expect(dicho).not.toContain('Se podria publicar');
  });
});

describe('what is read from git to decide', () => {
  const identidad = ['-c', 'user.name=prueba', '-c', 'user.email=prueba@example.com'];
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', [...identidad, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  let carpeta = '';
  let trabajo = '';
  let otro = '';

  /** Un `origin` de verdad (un repositorio vacio al que se empuja) y dos copias de trabajo, con `desarrollo` ya publicado. */
  beforeEach(() => {
    carpeta = mkdtempSync(join(tmpdir(), 'vsd-git-'));
    const origen = join(carpeta, 'origin.git');
    trabajo = join(carpeta, 'trabajo');
    otro = join(carpeta, 'otro');
    git(carpeta, 'init', '--bare', '-b', 'desarrollo', origen);
    git(carpeta, 'clone', origen, trabajo);
    git(trabajo, 'checkout', '-b', 'desarrollo');
    writeFileSync(join(trabajo, 'a.txt'), 'uno');
    git(trabajo, 'add', '.');
    git(trabajo, 'commit', '-m', 'uno');
    git(trabajo, 'push', '-u', 'origin', 'desarrollo');
    git(carpeta, 'clone', origen, otro);
  });
  afterEach(() => {
    rmSync(carpeta, { recursive: true, force: true });
  });

  it('says the branch, that nothing is loose and that it is at the same commit as origin', () => {
    expect(leerEstadoDeGit('produccion', trabajo)).toEqual({
      rama: 'desarrollo',
      sinConfirmar: false,
      alDiaConOrigen: true,
    });
  });

  it('says the name of the branch of work', () => {
    git(trabajo, 'checkout', '-b', 'feat/algo');

    expect(leerEstadoDeGit('vista-previa', trabajo).rama).toBe('feat/algo');
  });

  it('says there is nothing to name on a loose commit: the branch is empty', () => {
    git(trabajo, 'checkout', '--detach');

    expect(leerEstadoDeGit('vista-previa', trabajo).rama).toBe('');
  });

  it.each([
    ['a file that is not tracked', (c: string) => writeFileSync(join(c, 'nuevo.txt'), 'x')],
    ['a change in a tracked file', (c: string) => writeFileSync(join(c, 'a.txt'), 'dos')],
  ])('says that something is loose with %s', (_, ensuciar) => {
    ensuciar(trabajo);

    expect(leerEstadoDeGit('vista-previa', trabajo).sinConfirmar).toBe(true);
  });

  it('says it is not at the same commit as origin when it is ahead', () => {
    writeFileSync(join(trabajo, 'a.txt'), 'dos');
    git(trabajo, 'commit', '-am', 'dos');

    expect(leerEstadoDeGit('produccion', trabajo).alDiaConOrigen).toBe(false);
  });

  /** Otra persona empuja a `desarrollo` y `trabajo` todavia no se ha enterado. */
  function otraPersonaEmpuja(): void {
    writeFileSync(join(otro, 'a.txt'), 'de otra persona');
    git(otro, 'commit', '-am', 'otra');
    git(otro, 'push', 'origin', 'desarrollo');
  }

  it('brings origin before comparing: it says it is not at the same commit when someone else already pushed', () => {
    otraPersonaEmpuja();

    // Sin traer `origin` creeria que esta al dia: su copia de `origin/desarrollo` es la vieja.
    expect(leerEstadoDeGit('produccion', trabajo).alDiaConOrigen).toBe(false);
  });

  it('does not touch the network for a preview, which does not compare with origin', () => {
    otraPersonaEmpuja();
    git(trabajo, 'checkout', '-b', 'feat/algo');

    expect(leerEstadoDeGit('vista-previa', trabajo).alDiaConOrigen).toBe(true);
    expect(git(trabajo, 'rev-parse', 'origin/desarrollo')).not.toBe(
      git(otro, 'rev-parse', 'origin/desarrollo'),
    );
  });
});

describe('what stops a publication to the public address', () => {
  it('is the list of what is pending, which the script reads from a sheet without imports that Node can load', () => {
    const hoja = read('sitio/pagina/pendientes.ts');

    expect(hoja).not.toMatch(/^\s*import\s/m);
    expect(hoja).toContain('PENDIENTES_DE_PUBLICAR');
    expect(hoja).toContain('puedePublicar');
  });

  it('is the same list that the content of the page exposes, not a copy that could go out of date', async () => {
    const { PENDIENTES_DE_PUBLICAR: laHoja } = await import('../../sitio/pagina/pendientes');

    expect(PENDIENTES_DE_PUBLICAR).toBe(laHoja);
  });

  it('is asked by the script of publication, from that sheet, before it builds or uploads anything', () => {
    const script = read('scripts/publicar-sitio.ts');

    expect(script).toContain('sitio/pagina/pendientes.ts');
    expect(script).toContain('puedePublicar');
    // La ultima aparicion es la llamada (la primera es la definicion) y 'build:sitio' entre comillas es el comando que se lanza.
    expect(script.lastIndexOf('planear(')).toBeLessThan(script.indexOf("'build:sitio'"));
    expect(script).toContain('decidirPublicacion({');
    // Lo que se le pasa al plan es la lista real de la hoja, no una lista que alguien dejo vacia.
    expect(script).toContain('hoja.puedePublicar(hoja.PENDIENTES_DE_PUBLICAR).pendientes');
    expect(script).toContain('planear(process.argv.slice(2), leerEstadoDeGit, pendientes)');
  });

  it('stops with the exit code of the plan, and a simulation returns before it builds or uploads anything', () => {
    const script = read('scripts/publicar-sitio.ts');
    const retorno = 'if (plan.simulacion || plan.comando === null) return;';

    expect(script).toContain('if (plan.salida !== 0) process.exit(plan.salida);');
    expect(script).toContain(retorno);
    expect(script.indexOf(retorno)).toBeLessThan(script.indexOf("lanzar('npm'"));
  });

  it('uploads with the command of the plan, as a Pages project, and never launches wrangler deploy', () => {
    const script = read('scripts/publicar-sitio.ts');

    expect(script).toContain("lanzar('npx', plan.comando);");
    expect(script).not.toMatch(/['"]wrangler['"]\s*,\s*['"]deploy['"]/);
  });
});

describe('the commands to publish and to check what was published', () => {
  const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;

  it('are publish:sitio and verify:sitio', () => {
    expect(scripts['publish:sitio']).toContain('scripts/publicar-sitio.ts');
    expect(scripts['verify:sitio']).toContain('scripts/verificar-sitio.ts');
  });

  it('do not touch the build of the app: nothing of the publication travels in its package', () => {
    expect(scripts['build']).not.toContain('publicar');
    expect(scripts['build:sitio']).not.toContain('publicar');
  });
});
