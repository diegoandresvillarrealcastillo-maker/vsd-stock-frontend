// @vitest-environment node
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { boundaries } from '../../eslint/boundaries.mjs';

/**
 * Prueba de las fronteras de la arquitectura (ADR 0002).
 *
 * Cada caso lleva un archivo virtual en una capa y un trozo de codigo con un
 * import. Se ejecuta ESLint de verdad: si una frontera deja de imponerse, el
 * caso prohibido deja de fallar y esta prueba se rompe. Los casos permitidos
 * evitan el error contrario: una regla tan ancha que bloquee lo legitimo.
 */

const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.{ts,tsx}'], languageOptions: { parser: tseslint.parser } },
    ...boundaries,
  ],
});

async function lint(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages ?? [];
}

interface Violation {
  readonly name: string;
  readonly file: string;
  readonly code: string;
  readonly rule: 'no-restricted-imports' | 'no-restricted-syntax';
  /** Palabra que el mensaje debe contener para que explique que hacer. */
  readonly hint: string;
}

const DOMAIN = 'src/domain/model/example.ts';
const DOMAIN_SPEC = 'src/domain/model/example.spec.ts';
const APPLICATION = 'src/application/usecases/example.ts';
const APPLICATION_SPEC = 'src/application/usecases/example.spec.ts';
const ADAPTER_IN = 'src/adapters/in/connection/example.ts';
const ADAPTER_OUT = 'src/adapters/out/api/example.ts';
const PRESENTATION = 'src/presentation/components/example.tsx';
const SITE = 'sitio/pagina/example.tsx';

const forbidden: readonly Violation[] = [
  // ---------- domain ----------
  {
    name: 'domain imports application',
    file: DOMAIN,
    code: "import { x } from '../../application/usecases/get-status.js';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'domain imports a type from adapters',
    file: DOMAIN,
    code: "import type { x } from '../../adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'domain imports infrastructure',
    file: DOMAIN,
    code: "import { x } from '../../infrastructure/config';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'domain imports presentation',
    file: DOMAIN,
    code: "import { x } from '../../presentation/App';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'domain imports React',
    file: DOMAIN,
    code: "import { useState } from 'react';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'domain re-exports from adapters',
    file: DOMAIN,
    code: "export { x } from '../../adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'domain uses a dynamic import',
    file: DOMAIN,
    code: "const load = () => import('./other');",
    rule: 'no-restricted-syntax',
    hint: 'import estatico',
  },
  {
    name: 'domain uses require',
    file: DOMAIN,
    code: "const other = require('./other');",
    rule: 'no-restricted-syntax',
    hint: 'import estatico',
  },
  {
    name: 'a domain test imports application',
    file: DOMAIN_SPEC,
    code: "import { x } from '../../application/usecases/get-status';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  // ---------- application ----------
  {
    name: 'application imports adapters',
    file: APPLICATION,
    code: "import { x } from '../../adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'application imports infrastructure',
    file: APPLICATION,
    code: "import { x } from '../../infrastructure/config';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'application imports presentation',
    file: APPLICATION,
    code: "import { x } from '../../presentation/hooks/use-status';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'application imports React',
    file: APPLICATION,
    code: "import { useEffect } from 'react';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'application imports an animation library',
    file: APPLICATION,
    code: "import { motion } from 'framer-motion';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'an application test imports adapters (not even tests may)',
    file: APPLICATION_SPEC,
    code: "import { x } from '../../adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'puerto',
  },
  {
    name: 'application uses a dynamic import',
    file: APPLICATION,
    code: "const load = () => import('./other');",
    rule: 'no-restricted-syntax',
    hint: 'import estatico',
  },
  // ---------- adapters ----------
  {
    name: 'an input adapter imports infrastructure',
    file: ADAPTER_IN,
    code: "import { x } from '../../../infrastructure/config';",
    rule: 'no-restricted-imports',
    hint: 'infrastructure',
  },
  {
    name: 'an input adapter imports presentation',
    file: ADAPTER_IN,
    code: "import { x } from '../../../presentation/App';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'an input adapter imports React',
    file: ADAPTER_IN,
    code: "import { useState } from 'react';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'an input adapter imports an output adapter',
    file: ADAPTER_IN,
    code: "import { x } from '../../out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'adapters/out',
  },
  {
    name: 'an output adapter imports infrastructure',
    file: ADAPTER_OUT,
    code: "import { x } from '../../../infrastructure/config';",
    rule: 'no-restricted-imports',
    hint: 'infrastructure',
  },
  {
    name: 'an output adapter imports presentation',
    file: ADAPTER_OUT,
    code: "import { x } from '../../../presentation/App';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'an output adapter imports React',
    file: ADAPTER_OUT,
    code: "import { useState } from 'react';",
    rule: 'no-restricted-imports',
    hint: 'presentation',
  },
  {
    name: 'an output adapter imports an input adapter',
    file: ADAPTER_OUT,
    code: "import { x } from '../../in/connection/listener';",
    rule: 'no-restricted-imports',
    hint: 'adapters/in',
  },
  // ---------- presentation ----------
  {
    name: 'presentation imports an adapter directly',
    file: PRESENTATION,
    code: "import { x } from '../../adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'casos de uso',
  },
  {
    name: 'presentation imports infrastructure directly',
    file: PRESENTATION,
    code: "import { x } from '../../infrastructure/config';",
    rule: 'no-restricted-imports',
    hint: 'casos de uso',
  },
  // ---------- sitio (la landing, ADR 0033): del dominio y las mascotas, nada mas ----------
  {
    name: 'the site imports a use case of the application, and is told what to do instead',
    file: SITE,
    code: "import { x } from '../../src/application/usecases/selling';",
    rule: 'no-restricted-imports',
    hint: 'que viva en domain/',
  },
  {
    name: 'a section of the site, in a folder of its own, imports a use case',
    file: 'sitio/pagina/secciones/hero.tsx',
    code: "import { x } from '../../../src/application/usecases/selling';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'a plain .ts file of the site imports an adapter',
    file: 'sitio/pagina/contenido.ts',
    code: "import { x } from '../../src/adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'the site imports an adapter',
    file: SITE,
    code: "import { x } from '../../src/adapters/out/api/client';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'the site imports infrastructure',
    file: SITE,
    code: "import { x } from '../../src/infrastructure/api-base-url';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'the site imports a screen of the app',
    file: SITE,
    code: "import { App } from '../../src/presentation/App';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'the site imports a component of the app, not only its screens',
    file: SITE,
    code: "import { Button } from '../../src/presentation/components/button';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'the site imports the logo of the app, which is not a mascot',
    file: SITE,
    code: "import logo from '../../src/presentation/assets/logo-stock.webp';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'the site re-exports from the application',
    file: SITE,
    code: "export { x } from '../../src/application/usecases/selling';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
  {
    name: 'a test of the site imports a use case too',
    file: 'sitio/pagina/example.spec.tsx',
    code: "import { x } from '../../src/application/usecases/selling';",
    rule: 'no-restricted-imports',
    hint: 'sitio/',
  },
];

const allowed: readonly { readonly name: string; readonly file: string; readonly code: string }[] =
  [
    {
      name: 'domain imports another file of the domain',
      file: DOMAIN,
      code: "import type { Clock } from '../ports/out/clock';",
    },
    {
      name: 'a domain test imports the test runner',
      file: DOMAIN_SPEC,
      code: "import { describe, it } from 'vitest';",
    },
    {
      name: 'application imports the domain',
      file: APPLICATION,
      code: "import type { Clock } from '../../domain/ports/out/clock';",
    },
    {
      name: 'an application test imports the test runner',
      file: APPLICATION_SPEC,
      code: "import { describe, it } from 'vitest';",
    },
    {
      name: 'an input adapter imports application and domain',
      file: ADAPTER_IN,
      code: [
        "import type { CheckConnection } from '../../../application/usecases/check-connection';",
        "import type { Clock } from '../../../domain/ports/out/clock';",
      ].join('\n'),
    },
    {
      name: 'an output adapter implements a port of the domain and uses a browser library',
      file: ADAPTER_OUT,
      code: [
        "import { openDB } from 'idb';",
        "import type { Clock } from '../../../domain/ports/out/clock';",
      ].join('\n'),
    },
    {
      name: 'presentation imports React, an animation library, application and domain',
      file: PRESENTATION,
      code: [
        "import { useState } from 'react';",
        "import { motion } from 'framer-motion';",
        "import type { CheckConnection } from '../../application/usecases/check-connection';",
        "import type { ConnectionStatus } from '../../domain/model/connection-status';",
        "import { Button } from './button';",
      ].join('\n'),
    },
    {
      name: 'the site imports the pure domain and the mascots of the app',
      file: SITE,
      code: [
        "import { splitTaxIncluded } from '../../src/domain/model/tax';",
        "import ori from '../../src/presentation/assets/mascotas/ori-dormida.webp';",
      ].join('\n'),
    },
    {
      name: 'the site imports React, an animation library, fonts and its own files',
      file: SITE,
      code: [
        "import { useState } from 'react';",
        "import { m } from 'framer-motion';",
        "import '@fontsource-variable/inter/wght.css';",
        "import { Hero } from './secciones/hero';",
        "import { contenido } from '../contenido';",
      ].join('\n'),
    },
    {
      name: 'infrastructure wires adapters, application, presentation and React',
      file: 'src/infrastructure/example.ts',
      code: [
        "import { createRoot } from 'react-dom/client';",
        "import { App } from '../presentation/App';",
        "import { ApiClient } from '../adapters/out/api/client';",
        "import { CheckConnection } from '../application/usecases/check-connection';",
        "import type { Clock } from '../domain/ports/out/clock';",
      ].join('\n'),
    },
  ];

describe('architecture boundaries (ADR 0002)', () => {
  it.each(forbidden)('rejects: $name', async ({ file, code, rule, hint }) => {
    const messages = await lint(file, code);

    expect(messages.filter((m) => m.fatal === true)).toEqual([]);
    const violation = messages.find((m) => m.ruleId === rule);
    expect(violation, `${file} should be rejected by ${rule}`).toBeDefined();
    expect(violation?.severity).toBe(2);
    expect(violation?.message).toContain(hint);
  });

  it.each(allowed)('accepts: $name', async ({ file, code }) => {
    const messages = await lint(file, code);

    expect(messages).toEqual([]);
  });

  it('is applied by the real ESLint config of the project, not only by this test', async () => {
    const real = new ESLint({ cwd: process.cwd() });

    const config = (await real.calculateConfigForFile('src/domain/model/example.ts')) as {
      rules?: Record<string, unknown>;
    };

    const rule = config.rules?.['no-restricted-imports'];
    expect(Array.isArray(rule) ? rule[0] : rule).toBeOneOf([2, 'error']);
  });
});
