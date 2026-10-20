import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { boundaries } from './eslint/boundaries.mjs';

/**
 * Configuracion de ESLint para vsd-stock-frontend.
 *
 * Las fronteras de la arquitectura hexagonal (ADR 0002) se imponen en
 * eslint/boundaries.mjs. Aqui van las reglas generales.
 */
export default tseslint.config(
  {
    // Los archivos de configuracion en .mjs quedan fuera del analisis con
    // tipos: no forman parte del codigo del proyecto y no estan en tsconfig.
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '*.config.mjs',
      'eslint/**',
      // Lo escribe openapi-typescript: no es codigo del proyecto.
      'src/adapters/out/api/schema.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json', './tsconfig.sw.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ---------- Fronteras de la arquitectura hexagonal (ADR 0002) ----------
  ...boundaries,

  // ---------- Reglas de los hooks de React ----------
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },

  // ---------- Convencion del guion bajo ----------
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          // Un nombre que empieza por guion bajo se descarta a proposito.
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },

  // ---------- Eval ----------
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.spec.{ts,tsx}'],
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
    },
  },

  // ---------- Pruebas ----------
  {
    files: ['src/**/*.spec.{ts,tsx}', 'test/**/*.spec.ts'],
    rules: {
      // En las pruebas se construyen dobles y datos a proposito imperfectos.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
);
