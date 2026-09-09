// Flat config. Kept deliberately small: the rules that matter here are the ones that
// protect determinism in the rule engine (P1) — no floating promises, no implicit any,
// no unchecked non-null assertions on rule-pack data.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '.tscache/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/android/**',
      '**/ios/**',
      'docs/_build/**',
      'eval/gold/**',
      // Demo-only (docs/DEMO_PLAN.md). mobile/ is not an npm workspace and its tsconfig
      // is outside the root project graph, so type-aware linting cannot resolve it.
      // It is typechecked by `npm run typecheck` inside mobile/ instead. Removed with
      // the demo, or folded in properly at T-1.12.
      'mobile/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-level tool configs sit outside every package's tsconfig.
          allowDefaultProject: ['*.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
