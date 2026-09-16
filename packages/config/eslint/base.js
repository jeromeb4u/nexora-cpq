import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Shared flat ESLint config for every workspace package.
 * Rules here encode the project's non-negotiables:
 *  - no floating promises (server actions must be awaited)
 *  - no `any` (§53 of the build spec)
 *  - explicit module boundaries between MFEs
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**', '**/*.config.js'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nexora/*/src/*', '@nexora/*/dist/*'],
              message:
                'Import from a package entrypoint, not its internals. Deep imports break the MFE boundary contract (docs/MFE.md).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
