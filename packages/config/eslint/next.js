import reactHooks from 'eslint-plugin-react-hooks';
import base from './base.js';

/**
 * ESLint config for the two Next.js applications.
 * Adds React Hooks correctness on top of the shared base.
 */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Server-only code may log through the structured logger, which wraps console.
    files: ['**/lib/logger.ts', '**/scripts/**', '**/*.config.{ts,mjs}'],
    rules: { 'no-console': 'off' },
  },
];
